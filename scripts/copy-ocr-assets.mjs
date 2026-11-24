// Copies the text-recognition (OCR) engine out of node_modules into
// public/ocr so the label scanner can load it from this site instead of from
// an outside CDN. Runs automatically before `npm run dev` and `npm run build`.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'public/ocr');

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];

mkdirSync(target, { recursive: true });
let copied = 0;
for (const [from, to] of files) {
  const source = resolve(root, from);
  if (!existsSync(source)) {
    console.warn(`[ocr] missing ${from} — run "npm install" first. Label text reading will be unavailable.`);
    continue;
  }
  copyFileSync(source, resolve(target, to));
  copied += 1;
}
console.log(`[ocr] ${copied}/${files.length} files ready in public/ocr`);
