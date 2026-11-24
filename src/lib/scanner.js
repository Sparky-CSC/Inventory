// Barcode / QR reading, label text reading and product lookup — all done in
// the browser. This replaces the AI service the Base44 version relied on.

const MAX_SCAN_EDGE = 1600;

// Barcode reading uses the browser's own detector where it has one (Chrome on
// Android, for example) and otherwise a bundled reader (ZXing compiled to
// WebAssembly). Both are used through the same "BarcodeDetector" interface.
const FORMATS = [
  'qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93',
  'codabar', 'itf', 'data_matrix', 'pdf417', 'aztec',
];

let detectorPromise = null;

async function createBundledDetector() {
  const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  // Load the reader's engine from this site rather than from an outside CDN.
  prepareZXingModule({
    overrides: {
      locateFile: (file, prefix) => (file.endsWith('.wasm') ? wasm.default : prefix + file),
    },
  });
  return new BarcodeDetector({ formats: FORMATS });
}

function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = FORMATS.filter((format) => supported.includes(format));
          if (formats.includes('qr_code') && formats.includes('ean_13')) {
            return new window.BarcodeDetector({ formats });
          }
        } catch {
          /* fall through to the bundled reader */
        }
      }
      return createBundledDetector();
    })();
    detectorPromise.catch(() => {
      detectorPromise = null;
    });
  }
  return detectorPromise;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be opened. Try a JPG or PNG photo.'));
    };
    image.src = url;
  });
}

function drawToCanvas(image, maxEdge, rotateQuarterTurns = 0) {
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const sideways = rotateQuarterTurns % 2 === 1;
  canvas.width = sideways ? height : width;
  canvas.height = sideways ? width : height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((Math.PI / 2) * rotateQuarterTurns);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas;
}

const isQrFormat = (format) => /qr|data_?matrix|aztec|pdf_?417/i.test(String(format || ''));

const toResult = (found) => ({
  text: String(found.rawValue || '').trim(),
  format: found.format,
  isQr: isQrFormat(found.format),
});

async function detectIn(source) {
  const detector = await getDetector();
  const results = await detector.detect(source);
  const found = (results || []).find((result) => result.rawValue);
  return found ? toResult(found) : null;
}

/**
 * Find a barcode or QR code in a photo.
 * Resolves to { text, format, isQr } or null when nothing readable is found.
 */
export async function decodeCodeFromImage(file) {
  const image = await loadImageElement(file);
  // Phone photos are large; a couple of sizes cover both tiny and huge codes.
  for (const edge of [MAX_SCAN_EDGE, 900, 2600]) {
    if (edge > MAX_SCAN_EDGE && Math.max(image.naturalWidth, image.naturalHeight) <= MAX_SCAN_EDGE) continue;
    const found = await detectIn(drawToCanvas(image, edge, 0));
    if (found) return found;
  }
  return null;
}

/**
 * Read codes continuously from the camera into a <video> element.
 * Calls onResult({ text, format, isQr }) for the first code seen.
 * Returns a function that stops the camera.
 */
export async function startCameraScanner(videoElement, onResult, onError) {
  let stopped = false;
  let stream = null;
  let timer = null;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoElement && videoElement.srcObject === stream) videoElement.srcObject = null;
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    if (stopped) {
      stop();
      return stop;
    }
    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', 'true');
    await videoElement.play().catch(() => {});
    // Start loading the reader while the camera warms up.
    await getDetector();
  } catch (error) {
    stop();
    if (onError) onError(error);
    else throw error;
    return stop;
  }

  const tick = async () => {
    if (stopped) return;
    try {
      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        const found = await detectIn(videoElement);
        if (found && !stopped) {
          stop();
          onResult(found);
          return;
        }
      }
    } catch (error) {
      // A single bad frame is not a problem; keep looking.
      console.debug('Scan attempt failed:', error);
    }
    timer = setTimeout(tick, 180);
  };
  tick();

  return stop;
}

// ---------------------------------------------------------------------------
// Label text (OCR)
// ---------------------------------------------------------------------------

let ocrWorkerPromise = null;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const base = new URL('./ocr/', window.location.href.split('#')[0]).href;
      return createWorker('eng', 1, {
        workerPath: `${base}worker.min.js`,
        // One engine file that runs on every browser (no special CPU features needed).
        corePath: `${base}tesseract-core-lstm.wasm.js`,
        langPath: base,
        gzip: true,
      });
    })();
    ocrWorkerPromise.catch(() => {
      ocrWorkerPromise = null;
    });
  }
  return ocrWorkerPromise;
}

const SERIAL_PATTERNS = [
  /\b(?:S\s*\/\s*N|SN|SER(?:IAL)?(?:\s*(?:NO|NUMBER|NUM|#))?)\s*[.:#-]?\s*([A-Z0-9][A-Z0-9\-/]{3,24})/i,
];
const MODEL_PATTERNS = [
  /\b(?:MODEL(?:\s*(?:NO|NUMBER|NUM|#))?|MOD(?:\.|EL)?|M\s*\/\s*N|P\s*\/\s*N|PART(?:\s*(?:NO|NUMBER|#))?|TYPE)\s*[.:#-]?\s*([A-Z0-9][A-Z0-9\-/.]{2,24})/i,
];

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && /\d/.test(match[1])) return match[1].replace(/[.\-/]+$/, '');
  }
  return '';
}

/** Pick serial and model numbers out of text read from a label. */
export function parseLabelText(text) {
  const clean = String(text || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return {
    serial_number: firstMatch(clean, SERIAL_PATTERNS),
    model_number: firstMatch(clean, MODEL_PATTERNS),
    text_content: clean,
  };
}

/**
 * Read the printed text on a product label.
 * Resolves to { serial_number, model_number, text_content }.
 */
export async function readLabelText(file) {
  const image = await loadImageElement(file);
  const canvas = drawToCanvas(image, 2000, 0);
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  // Throw away low-confidence noise (photos of non-text objects).
  const text = (data?.confidence ?? 0) < 35 ? '' : data?.text || '';
  return parseLabelText(text);
}

// ---------------------------------------------------------------------------
// Product lookup
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS = [
  ['lighting', /\b(lamp|bulb|led|light|lighting|fixture|gel|dimmer|par can|fresnel|ellipsoidal)\b/i],
  ['sound', /\b(microphone|mic|speaker|audio|headphone|amplifier|mixer|cable xlr|xlr)\b/i],
  ['costume', /\b(dress|shirt|pants|trouser|jacket|coat|skirt|gown|suit|costume|shoe|boot|hat|wig|glove|apparel|clothing)\b/i],
  ['fabric', /\b(fabric|textile|muslin|velvet|cotton|thread|yarn|felt)\b/i],
  ['furniture', /\b(chair|table|sofa|couch|desk|stool|bench|cabinet|shelf|furniture)\b/i],
  ['accessory', /\b(jewel|necklace|bracelet|ring|scarf|belt|bag|purse|glasses|watch|makeup|cosmetic|lipstick)\b/i],
  ['equipment', /\b(tool|drill|saw|ladder|battery|charger|tape|clamp|hardware|equipment|power)\b/i],
  ['scenery', /\b(flat|platform|backdrop|curtain|drape|scenery|paint)\b/i],
];

function guessCategory(...parts) {
  const text = parts.filter(Boolean).join(' ');
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return 'prop';
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fromUpcItemDb(json) {
  const item = json?.items?.[0];
  if (!item?.title) return null;
  return {
    found_info: true,
    source: 'UPCitemdb',
    name: item.title,
    description: item.description || '',
    manufacturer: item.brand || '',
    model_number: item.model || '',
    dimensions: item.dimension || '',
    material: '',
    color: item.color || '',
    size: item.size || '',
    subcategory: (item.category || '').split('>').pop().trim(),
    category: guessCategory(item.category, item.title, item.description),
  };
}

function fromOpenFacts(json, source) {
  const product = json?.product;
  if (!json || json.status !== 1 || !product) return null;
  const name = product.product_name || product.product_name_en || product.generic_name;
  if (!name) return null;
  const categories = product.categories || '';
  return {
    found_info: true,
    source,
    name,
    description: [product.generic_name, product.brands, product.quantity].filter(Boolean).join(' · '),
    manufacturer: product.brands || '',
    model_number: '',
    dimensions: product.quantity || '',
    material: '',
    subcategory: categories.split(',').pop().trim(),
    category: guessCategory(categories, name),
  };
}

/**
 * Look a barcode number up in free public product databases.
 * Always resolves — to product details, or to { found_info: false, … }.
 */
export async function lookupProduct(code) {
  const digits = String(code || '').replace(/[^0-9]/g, '');
  const notFound = {
    found_info: false,
    name: '',
    description: 'No product information found for this code.',
  };
  // Only real retail barcodes (UPC-E / EAN-8 / UPC-A / EAN-13 / GTIN-14) can be looked up.
  if (![8, 12, 13, 14].includes(digits.length) || digits !== String(code).trim()) return notFound;

  const sources = [
    [`https://api.upcitemdb.com/prod/trial/lookup?upc=${digits}`, fromUpcItemDb],
    [`https://world.openproductsfacts.org/api/v2/product/${digits}.json`, (j) => fromOpenFacts(j, 'Open Products Facts')],
    [`https://world.openbeautyfacts.org/api/v2/product/${digits}.json`, (j) => fromOpenFacts(j, 'Open Beauty Facts')],
    [`https://world.openfoodfacts.org/api/v2/product/${digits}.json`, (j) => fromOpenFacts(j, 'Open Food Facts')],
  ];
  for (const [url, convert] of sources) {
    const result = convert(await fetchJson(url));
    if (result) return result;
  }
  return notFound;
}
