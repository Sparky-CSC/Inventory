// Checking borrowed items in and returning them to the lender.

import { BorrowedItem, User } from '@/api/entities';
import { nextLoanTag } from './itemCodes';

async function whoAmI() {
  try {
    const user = await User.me();
    return user?.full_name || user?.email || '';
  } catch {
    return '';
  }
}

/**
 * Make sure a borrowed item has a tag number no other borrowed item uses.
 * Two people checking items in at the same moment could pick the same next
 * number; the later one moves to the next free number.
 */
async function ensureUniqueTag(record) {
  const all = await BorrowedItem.list('created_date');
  const sameTag = all.filter((item) => item.tag_number && item.tag_number === record.tag_number);
  if (record.tag_number && sameTag.length <= 1) return record;
  if (record.tag_number && sameTag[0]?.id === record.id) return record; // we were first
  const tag_number = nextLoanTag(all);
  return BorrowedItem.update(record.id, { tag_number }, {
    activity: { action: 'id_assigned', summary: `Tag number ${tag_number} assigned` },
  });
}

/** Check in a newly borrowed item. Returns the saved record. */
export async function checkInBorrowedItem(data) {
  const all = await BorrowedItem.list();
  const receivedBy = data.received_by || (await whoAmI());
  const record = await BorrowedItem.create(
    {
      ...data,
      tag_number: data.tag_number || nextLoanTag(all),
      status: 'borrowed',
      received_by: receivedBy,
      checked_in_at: data.checked_in_at || new Date().toISOString(),
      returned_date: null,
      returned_by: null,
    },
    {
      activity: {
        action: 'checked_in',
        summary: [
          `Received from ${data.lender_name || 'lender'}`,
          data.quantity > 1 ? `${data.quantity} pieces` : '',
          (data.photos || []).length ? `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}` : '',
          data.storage_location ? `stored in ${data.storage_location}` : '',
        ].filter(Boolean).join(' · '),
        notes: data.condition_notes_borrowed || '',
      },
    }
  );
  return ensureUniqueTag(record);
}

/** Save changes to an existing borrowed item. */
export async function updateBorrowedItem(id, data) {
  const record = await BorrowedItem.update(id, data);
  return record.tag_number ? record : ensureUniqueTag(record);
}

/**
 * Hand a borrowed item back to its lender.
 * `info`: { returned_date, returned_by, returned_to, condition_returned,
 *           condition_notes_returned, pieces, photos, deposit_returned, notes }
 */
export async function returnBorrowedItem(item, info) {
  const returnedBy = info.returned_by || (await whoAmI());
  const pieces = info.pieces || item.pieces || [];
  const missing = pieces.filter((p) => !p.returned);
  const damaged = ['poor', 'needs_repair'].includes(info.condition_returned);
  const discrepancy = missing.length > 0 || damaged || Boolean(info.discrepancy);
  return BorrowedItem.update(
    item.id,
    {
      status: 'returned',
      returned_date: info.returned_date || new Date().toISOString().split('T')[0],
      returned_by: returnedBy,
      returned_to: info.returned_to || '',
      condition_returned: info.condition_returned || item.condition_borrowed || 'good',
      condition_notes_returned: info.condition_notes_returned || '',
      pieces,
      photos: info.photos || item.photos || [],
      deposit_returned: Boolean(info.deposit_returned),
      return_discrepancy: discrepancy,
    },
    {
      activity: {
        action: 'returned',
        summary: [
          `Returned to ${info.returned_to || item.lender_name || 'lender'}`,
          missing.length ? `${missing.length} piece${missing.length === 1 ? '' : 's'} not returned: ${missing.map((p) => p.name).join(', ')}` : '',
          damaged ? 'damage noted' : '',
        ].filter(Boolean).join(' · '),
        notes: info.condition_notes_returned || '',
      },
    }
  );
}

/** Undo a return recorded by mistake. */
export async function undoBorrowedReturn(item, reason = '') {
  return BorrowedItem.update(
    item.id,
    {
      status: 'borrowed',
      returned_date: null,
      returned_by: null,
      returned_to: null,
      return_discrepancy: false,
      pieces: (item.pieces || []).map((p) => ({ ...p, returned: false })),
    },
    { activity: { action: 'return_undone', summary: 'Return undone; item is back in our care', notes: reason } }
  );
}

/** Photos taken at check-in (older photos without a stage count as check-in). */
export const checkInPhotos = (item) => (item?.photos || []).filter((p) => !p.stage || p.stage === 'check_in');
export const returnPhotos = (item) => (item?.photos || []).filter((p) => p.stage === 'return');
export const primaryPhoto = (item) =>
  (item?.photos || []).find((p) => p.is_primary) || checkInPhotos(item)[0] || (item?.photos || [])[0] || null;
