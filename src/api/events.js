// Tiny publish/subscribe helper so screens can refresh when data changes.

const DATA_EVENT = 'theatre-inventory:data-changed';

/** Tell the rest of the app that records of one type were added, edited or removed. */
export function emitDataChanged(entityName, action, record) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: { entity: entityName, action, record } }));
}

/** Listen for changes. Returns a function that stops listening. */
export function onDataChanged(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail || {});
  window.addEventListener(DATA_EVENT, handler);
  return () => window.removeEventListener(DATA_EVENT, handler);
}
