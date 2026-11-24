import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Writes dist/sw.js from service-worker.template.js, listing the files the
 * app needs to start so they can be saved for offline use.
 */
function serviceWorkerPlugin() {
  return {
    name: 'theatre-inventory-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Scripts, styles and the barcode reader's engine (so scanning works offline).
      const built = Object.keys(bundle).filter((file) => /\.(js|css|wasm)$/.test(file));
      const precache = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icons/icon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png',
        ...built.map((file) => `./${file}`),
      ];
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);
      const template = readFileSync(path.resolve(__dirname, 'service-worker.template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace("'__SW_VERSION__'", JSON.stringify(version))
          .replace('__SW_PRECACHE__', JSON.stringify(precache, null, 2)),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the built site works from any folder — a GitHub Pages
  // project site (name.github.io/repo/), a user site, or a custom domain.
  base: './',
  plugins: [react(), serviceWorkerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1800,
  },
});
