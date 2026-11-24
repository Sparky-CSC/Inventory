// A copy of the most recently loaded data, kept in this browser so shared-mode
// pages can still be *read* when the connection drops. Changes are never
// written here — they always go to the shared database.

const DB_NAME = 'TheatreInventoryReadCache';
const STORE = 'lists';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function saveCached(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, value, saved_at: new Date().toISOString() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    // The cache is a convenience; never let it break the real request.
    console.warn('Could not save offline copy:', error);
  }
}

export async function readCached(key) {
  try {
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return row ? row.value : undefined;
  } catch {
    return undefined;
  }
}

export async function clearCached() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* nothing to clear */
  }
}

/** Did a request fail because the network (not the database) said no? */
export function isOfflineError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const text = `${error?.message || ''} ${error?.cause?.message || ''} ${error?.details || ''}`;
  return /Failed to fetch|NetworkError|Load failed|fetch failed|network request failed/i.test(text);
}
