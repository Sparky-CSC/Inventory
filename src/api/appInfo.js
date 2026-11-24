// The app's name and logo, readable before anyone signs in (for the sign-in
// screen and the browser tab title).

import backend from './backends';

const CACHE_KEY = 'theatre_inventory_app_info';

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function rememberAppInfo(info) {
  try {
    const logoUrl = info?.logoUrl && info.logoUrl.length < 200000 ? info.logoUrl : '';
    localStorage.setItem(CACHE_KEY, JSON.stringify({ appName: info?.appName || '', logoUrl }));
  } catch {
    /* storage full or unavailable — not important */
  }
}

export async function getPublicAppInfo() {
  try {
    const info = await backend.getPublicAppInfo();
    if (info && (info.appName || info.logoUrl)) {
      rememberAppInfo(info);
      return { appName: info.appName || '', logoUrl: info.logoUrl || '' };
    }
  } catch (err) {
    console.warn('Could not load the app name:', err);
  }
  return readCache() || { appName: '', logoUrl: '' };
}
