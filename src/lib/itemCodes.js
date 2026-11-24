// IDs printed on labels, and finding a record from a scanned code.
//
//  - Inventory items get a permanent UID:      CST-COS-K3F9Q-7XW2M
//  - Borrowed items get a temporary tag number: LN-26-0007  (LN = loan,
//    26 = year it arrived, 0007 = the 7th loan that year)
//
// Both are checked for duplicates before saving, because two labels with the
// same code make every later scan unreliable.

import { getAppUrl } from '@/utils';

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1 and 0)

function randomCode(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** A new permanent UID for an inventory item. */
export function generateItemUid(category = 'GEN') {
  const prefix = String(category || 'GEN').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'GEN';
  return `CST-${prefix.padEnd(3, 'X')}-${randomCode(5)}-${randomCode(5)}`;
}

export const LOAN_TAG_PATTERN = /^LN-(\d{2})-(\d{3,})$/i;

/** The next free tag number for a borrowed item, e.g. LN-26-0008. */
export function nextLoanTag(borrowedItems = [], date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  let highest = 0;
  for (const item of borrowedItems) {
    const match = String(item?.tag_number || '').match(LOAN_TAG_PATTERN);
    if (match && match[1] === year) highest = Math.max(highest, Number(match[2]));
  }
  return `LN-${year}-${String(highest + 1).padStart(4, '0')}`;
}

/** Where a borrowed item's QR code points. */
export const borrowedItemUrl = (item) =>
  getAppUrl(`BorrowedItemDetails?id=${item.id}${item.tag_number ? `&tag=${encodeURIComponent(item.tag_number)}` : ''}`);

/** Where an inventory item's QR code points (unless it has its own code). */
export const inventoryItemUrl = (item) =>
  getAppUrl(`ItemDetails?id=${item.id}${item.uid ? `&uid=${encodeURIComponent(item.uid)}` : ''}`);

const norm = (value) => String(value ?? '').trim().toLowerCase();

/** Pull a record id out of a scanned app link (…#/ItemDetails?id=…). */
export function idFromScannedLink(code, pageName) {
  const text = String(code || '');
  const pattern = new RegExp(`${pageName}\\?([^#\\s]*)`, 'i');
  const match = text.match(pattern);
  if (!match) return '';
  return new URLSearchParams(match[1]).get('id') || '';
}

/**
 * Find the inventory item a scanned code belongs to: its UID, its own QR
 * code, a link to its page, a variant's SKU, or its serial number.
 */
export function findItemByCode(code, items = []) {
  const wanted = norm(code);
  if (!wanted) return null;
  const linkedId = idFromScannedLink(code, 'ItemDetails');
  if (linkedId) {
    const byId = items.find((item) => item.id === linkedId);
    if (byId) return byId;
  }
  return (
    items.find((item) => norm(item.uid) === wanted) ||
    items.find((item) => norm(item.qr_code) === wanted) ||
    items.find((item) => norm(item.id) === wanted) ||
    items.find((item) => (item.variants || []).some((v) => norm(v.sku) === wanted)) ||
    items.find((item) => item.serial_number && norm(item.serial_number) === wanted) ||
    null
  );
}

/** Find the borrowed item a scanned code belongs to (tag number or tag link). */
export function findBorrowedByCode(code, borrowedItems = []) {
  const wanted = norm(code);
  if (!wanted) return null;
  const linkedId = idFromScannedLink(code, 'BorrowedItemDetails');
  if (linkedId) {
    const byId = borrowedItems.find((item) => item.id === linkedId);
    if (byId) return byId;
  }
  return borrowedItems.find((item) => norm(item.tag_number) === wanted) || null;
}

/** Records that share a code with another record. Returns Map(code → records). */
export function findDuplicates(records, field) {
  const groups = new Map();
  for (const record of records) {
    const value = norm(record?.[field]);
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record);
  }
  return new Map([...groups].filter(([, list]) => list.length > 1));
}

/** Is a borrowed item past its due date (and still with us)? */
export function isLoanOverdue(item, today = new Date()) {
  if (!item || item.status === 'returned' || !item.due_date) return false;
  const due = new Date(`${String(item.due_date).slice(0, 10)}T23:59:59`);
  return today > due;
}

/** Whole days until (positive) or since (negative) the due date. */
export function daysUntilDue(item, today = new Date()) {
  if (!item?.due_date) return null;
  const due = new Date(`${String(item.due_date).slice(0, 10)}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - start) / 86400000);
}
