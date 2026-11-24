/* Service worker — makes the app installable and lets it open without a
   connection. `npm run build` fills in the two placeholders below and writes
   the result to dist/sw.js. */

const VERSION = '__SW_VERSION__';
const PRECACHE = __SW_PRECACHE__;

const SHELL_CACHE = `theatre-inventory-shell-${VERSION}`;
const RUNTIME_CACHE = 'theatre-inventory-runtime';
const PHOTO_CACHE = 'theatre-inventory-photos';
const MAX_PHOTOS = 600;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('theatre-inventory-shell-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
  }
}

// The app's own page: try the network (so updates arrive), fall back to the saved copy.
async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('./index.html', response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await caches.match('./index.html')) || (await caches.match('./'));
    if (cached) return cached;
    throw error;
  }
}

// Files that never change once built (their names contain a fingerprint).
async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    if (maxEntries) trimCache(cacheName, maxEntries);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate' && sameOrigin) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (sameOrigin) {
    event.respondWith(cacheFirst(request, url.pathname.includes('/assets/') ? SHELL_CACHE : RUNTIME_CACHE));
    return;
  }

  // Photos kept in the shared database's storage: keep a copy for offline use.
  if (url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith(cacheFirst(request, PHOTO_CACHE, MAX_PHOTOS));
  }
  // Everything else (database and sign-in requests) always goes to the network.
});
