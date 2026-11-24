// QR codes are drawn in the browser, so they work offline and nothing about
// your inventory is sent to an outside QR service.

import qrcode from 'qrcode-generator';
import { normalizeQrData } from '@/utils';
import { PAGE_NAMES } from '@/lib/pages';

/** What a QR code for `data` will actually contain (see normalizeQrData). */
export const qrContent = (data) => normalizeQrData(data, PAGE_NAMES);

const cache = new Map();

function buildSvg(data, margin = 2) {
  // Type 0 = pick the smallest QR size that fits; "M" = medium error correction.
  const qr = qrcode(0, 'M');
  qr.addData(String(data), 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const size = count + margin * 2;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= count; col += 1) {
      const dark = col < count && qr.isDark(row, col);
      if (dark && runStart < 0) runStart = col;
      if (!dark && runStart >= 0) {
        path += `M${runStart + margin} ${row + margin}h${col - runStart}v1h-${col - runStart}z`;
        runStart = -1;
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}

/** Image address (a data: URL) for a QR code — use it as an <img src>. */
export function qrCodeDataUrl(data) {
  if (data === undefined || data === null || data === '') return '';
  const key = qrContent(data);
  if (!cache.has(key)) {
    try {
      cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(key))}`);
    } catch (error) {
      console.error('Could not create QR code:', error);
      return '';
    }
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

/** PNG version of a QR code, for downloading. Resolves to a data: URL. */
export function qrCodePngDataUrl(data, pixels = 600) {
  return new Promise((resolve, reject) => {
    const source = qrCodeDataUrl(data);
    if (!source) {
      reject(new Error('Nothing to encode.'));
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixels;
      canvas.height = pixels;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pixels, pixels);
      ctx.drawImage(image, 0, 0, pixels, pixels);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Could not draw the QR code.'));
    image.src = source;
  });
}
