// Code 128 barcodes drawn in the browser (no outside service).
import JsBarcode from 'jsbarcode';

const cache = new Map();

/** Image address (data: URL) of a Code 128 barcode that stretches to fit its box. */
export function barcodeDataUrl(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  if (cache.has(value)) return cache.get(value);
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2, background: '#ffffff' });
    const width = svg.getAttribute('width') || '200';
    const height = svg.getAttribute('height') || '60';
    svg.setAttribute('viewBox', `0 0 ${parseFloat(width)} ${parseFloat(height)}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.removeAttribute('style');
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    cache.set(value, url);
    return url;
  } catch (error) {
    console.error('Could not draw barcode:', error);
    return '';
  }
}
