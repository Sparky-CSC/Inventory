// Photo and logo uploads.
//
// Pictures are shrunk in the browser before they are stored, so a 6 MB phone
// photo becomes a few hundred KB. That keeps pages fast and stays well inside
// the free storage allowance.

import backend from './backends';

const MAX_IMAGE_EDGE = 1600; // pixels on the longest side
const JPEG_QUALITY = 0.82;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('The file could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be opened. Try a JPG or PNG file.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be processed.'))), type, quality);
  });
}

/** Resize a picture if it is larger than needed. Returns { blob, contentType }. */
export async function compressImage(file, { maxEdge = MAX_IMAGE_EDGE, quality = JPEG_QUALITY } = {}) {
  const type = file.type || '';
  // Vector logos and animations are kept exactly as they are.
  if (type === 'image/svg+xml' || type === 'image/gif') {
    return { blob: file, contentType: type };
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  // PNGs may be transparent (logos), so they stay PNG; photos become JPEG.
  const keepPng = type === 'image/png';
  const outputType = keepPng ? 'image/png' : 'image/jpeg';

  if (scale === 1 && file.size < 400 * 1024 && (type === 'image/jpeg' || keepPng)) {
    return { blob: file, contentType: type };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!keepPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, outputType, keepPng ? undefined : quality);
  return { blob, contentType: outputType };
}

/**
 * Store a file and return `{ file_url }` — the same shape the Base44
 * `UploadFile` integration returned.
 */
export async function uploadFile({ file }) {
  if (!file) throw new Error('No file was selected.');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is larger than 15 MB. Please choose a smaller one.');
  }

  let blob = file;
  let contentType = file.type || 'application/octet-stream';
  if (contentType.startsWith('image/')) {
    try {
      const compressed = await compressImage(file);
      blob = compressed.blob;
      contentType = compressed.contentType;
    } catch (err) {
      console.warn('Image could not be resized; storing the original.', err);
    }
  }

  const baseName = (file.name || 'upload').replace(/\.[^.]+$/, '');
  const extension =
    { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/webp': 'webp' }[
      contentType
    ] || (file.name || '').split('.').pop() || 'bin';

  const dataUrl = backend.mode === 'local' ? await blobToDataUrl(blob) : null;
  return backend.uploadFile({ blob, dataUrl, contentType, fileName: `${baseName}.${extension}` });
}

export { blobToDataUrl };
