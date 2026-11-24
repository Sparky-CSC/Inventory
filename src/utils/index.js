// Address helpers.
//
// The app uses "hash" addresses (…/#/Inventory) so it works on GitHub Pages
// from any folder without server configuration.

/** Path of a page inside the app, e.g. createPageUrl('ItemDetails?id=1') → '/ItemDetails?id=1'. */
export function createPageUrl(pageName) {
  return '/' + String(pageName).replace(/ /g, '-');
}

/** Address of the app itself, without any page: https://name.github.io/repo/ */
export function getAppBaseUrl() {
  if (typeof window === 'undefined') return '/';
  return window.location.origin + window.location.pathname;
}

/**
 * Full web address of a page — the thing to put in a QR code or an email.
 * getAppUrl('ItemDetails?id=1') → 'https://name.github.io/repo/#/ItemDetails?id=1'
 */
export function getAppUrl(pageName = '') {
  return `${getAppBaseUrl()}#${createPageUrl(pageName)}`;
}

// Pages that printed QR labels can point at.
const LABEL_PAGES = ['ItemDetails', 'LocationViewer', 'Inventory', 'Search'];

/**
 * If `text` is a link into this app (or into the old Base44 copy of it),
 * return the in-app path to open, e.g. '/ItemDetails?id=123'. Otherwise null.
 * This keeps QR labels printed before the move working with the in-app scanner.
 */
export function parseInternalLink(text, knownPages = []) {
  if (typeof text !== 'string' || !/^https?:\/\//i.test(text.trim())) return null;
  let url;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const sameSite =
    typeof window !== 'undefined' &&
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname;

  let pageName = '';
  let query = '';
  if (url.hash.startsWith('#/')) {
    // New style: https://host/repo/#/Page?x=1
    const [page, rest = ''] = url.hash.slice(2).split('?');
    pageName = page;
    query = rest ? `?${rest}` : '';
  } else {
    // Old style: https://app.base44.app/Page?x=1  (or …/items/<id>)
    const itemMatch = url.pathname.match(/\/items\/([^/?#]+)/i);
    if (itemMatch) return `/ItemDetails?id=${itemMatch[1]}`;
    pageName = url.pathname.split('/').filter(Boolean).pop() || '';
    query = url.search;
  }
  if (!pageName) return null;

  if (sameSite) {
    const known = knownPages.find((p) => p.toLowerCase() === pageName.toLowerCase());
    return known ? `/${known}${query}` : null;
  }
  // A link to somewhere else only counts when it clearly is one of our label links.
  if (LABEL_PAGES.includes(pageName) && query.length > 1) return `/${pageName}${query}`;
  return null;
}

/**
 * The text to put inside a QR code. Links into the app are rewritten to this
 * site's current address, so labels stay correct if the site ever moves.
 */
export function normalizeQrData(data, knownPages = []) {
  if (data === undefined || data === null) return '';
  const text = String(data);
  const internalPath = parseInternalLink(text, knownPages);
  return internalPath ? `${getAppBaseUrl()}#${internalPath}` : text;
}
