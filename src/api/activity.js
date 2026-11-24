// The activity log: a permanent trail of who did what to an item, and when.
//
// Every create, change and delete of the record types below is written here
// automatically by the data layer (src/api/entities.js), so no page can forget
// to record a move or a status change. Pages that carry out a named step
// (checking in a borrowed item, returning it, an inventory count, a rental
// going out) pass an `activity` note so the entry says what really happened.
//
// In shared mode entries can be added by anyone signed in but only removed by
// an administrator, and never edited (see supabase/schema.sql).

import backend from './backends';
import { emitDataChanged } from './events';

export const ACTIVITY_ENTITY = 'ActivityLog';

// Fields whose old and new values are kept in the log, per record type.
const TRACKED_FIELDS = {
  InventoryItem: ['status', 'location', 'container_id', 'condition', 'quantity', 'uid', 'qr_code', 'name', 'value'],
  BorrowedItem: [
    'status', 'storage_location', 'container_id', 'condition_borrowed', 'condition_returned',
    'due_date', 'tag_number', 'returned_date', 'lender_name', 'quantity', 'deposit_returned',
  ],
  RentalOrder: ['status', 'rental_start_date', 'rental_end_date', 'renter_name'],
  Location: ['name'],
  Container: ['name', 'location'],
};

export const LOGGED_ENTITIES = Object.keys(TRACKED_FIELDS);

// Fields that are noise in an "edited" list.
const IGNORED_FIELDS = new Set(['updated_date', 'created_date', 'id', 'created_by']);

const MOVE_FIELDS = new Set(['location', 'container_id', 'storage_location']);
const CONDITION_FIELDS = new Set(['condition', 'condition_borrowed', 'condition_returned']);

// The signed-in person, remembered for a short while so a burst of changes
// does not look them up again each time.
let userCache = { at: 0, promise: null };
async function currentUser() {
  if (!userCache.promise || Date.now() - userCache.at > 5 * 60 * 1000) {
    userCache = {
      at: Date.now(),
      promise: backend.getCurrentUser().catch(() => null),
    };
  }
  return userCache.promise;
}

/** Forget the remembered person (after signing in as someone else). */
export function resetActivityUser() {
  userCache = { at: 0, promise: null };
}

const sameValue = (a, b) => {
  const emptyA = a === undefined || a === null || a === '';
  const emptyB = b === undefined || b === null || b === '';
  if (emptyA && emptyB) return true;
  return JSON.stringify(a) === JSON.stringify(b);
};

/** The name and printed code of a record, for display even after it is deleted. */
export function describeRecord(entityType, record) {
  if (!record) return { name: '', code: '' };
  const name = record.name || record.renter_name || record.scope_label || record.location || '';
  const code =
    entityType === 'BorrowedItem'
      ? record.tag_number || ''
      : entityType === 'RentalOrder'
        ? record.order_number || record.quote_number || ''
        : record.uid || record.qr_code || '';
  return { name, code };
}

/** What changed between two versions of a record. */
export function diffRecords(entityType, before, after) {
  const tracked = TRACKED_FIELDS[entityType] || [];
  const changes = [];
  const otherFields = [];
  const keys = new Set([...Object.keys(after || {})]);
  keys.forEach((field) => {
    if (IGNORED_FIELDS.has(field)) return;
    const from = before?.[field];
    const to = after?.[field];
    if (sameValue(from, to)) return;
    if (tracked.includes(field)) changes.push({ field, from: from ?? null, to: to ?? null });
    else otherFields.push(field);
  });
  return { changes, otherFields };
}

function actionFor(changes, otherFields) {
  if (changes.length === 0) return otherFields.length ? 'updated' : null;
  const fields = changes.map((c) => c.field);
  if (fields.includes('status')) return 'status_changed';
  if (fields.every((f) => MOVE_FIELDS.has(f))) return 'moved';
  if (fields.every((f) => CONDITION_FIELDS.has(f))) return 'condition_changed';
  return 'updated';
}

/**
 * Add one entry to the log. Never throws: a log failure must not stop the
 * real work from being saved.
 */
export async function logActivity({
  entityType,
  record,
  recordId,
  action,
  summary = '',
  changes = [],
  notes = '',
  relatedId = '',
}) {
  try {
    const user = await currentUser();
    const { name, code } = describeRecord(entityType, record);
    const data = {
      entity_type: entityType,
      record_id: String(recordId || record?.id || ''),
      record_name: name,
      record_code: code,
      action,
      summary,
      changes,
      notes,
      related_id: relatedId ? String(relatedId) : '',
      user_name: user?.full_name || user?.email || '',
      user_email: user?.email || '',
      at: new Date().toISOString(),
    };
    const [saved] = await backend.insertRecords(ACTIVITY_ENTITY, [{ data }]);
    emitDataChanged(ACTIVITY_ENTITY, 'create', saved);
    return saved;
  } catch (error) {
    console.warn('Could not write to the activity log:', error);
    return null;
  }
}

/** Called by the data layer after a record was added. */
export function logCreated(entityType, record, activity) {
  if (!TRACKED_FIELDS[entityType]) return;
  logActivity({
    entityType,
    record,
    action: activity?.action || 'created',
    summary: activity?.summary || '',
    notes: activity?.notes || '',
    relatedId: activity?.relatedId,
  });
}

/** Called by the data layer after a record was changed. */
export function logUpdated(entityType, before, after, patch, activity) {
  if (!TRACKED_FIELDS[entityType]) return;
  const { changes, otherFields } = diffRecords(entityType, before, patch);
  const action = activity?.action || actionFor(changes, otherFields);
  if (!action) return;
  const summary =
    activity?.summary ||
    (otherFields.length && changes.length === 0
      ? `Edited ${otherFields.slice(0, 6).map((f) => f.replace(/_/g, ' ')).join(', ')}${otherFields.length > 6 ? '…' : ''}`
      : '');
  logActivity({
    entityType,
    record: after || before,
    action,
    summary,
    changes,
    notes: activity?.notes || '',
    relatedId: activity?.relatedId,
  });
}

/** Called by the data layer after a record was deleted. */
export function logDeleted(entityType, before, activity) {
  if (!TRACKED_FIELDS[entityType]) return;
  logActivity({
    entityType,
    record: before,
    recordId: before?.id,
    action: 'deleted',
    summary: activity?.summary || 'Deleted',
    notes: activity?.notes || '',
  });
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const ACTION_LABELS = {
  created: 'Added',
  updated: 'Edited',
  deleted: 'Deleted',
  moved: 'Moved',
  status_changed: 'Status changed',
  condition_changed: 'Condition changed',
  checked_in: 'Checked in',
  returned: 'Returned to lender',
  return_undone: 'Return undone',
  rented_out: 'Rented out',
  rental_returned: 'Rental returned',
  audited: 'Counted',
  audit_completed: 'Inventory count',
  tag_printed: 'Tag printed',
  id_assigned: 'ID assigned',
};

export const FIELD_LABELS = {
  status: 'Status',
  location: 'Location',
  storage_location: 'Storage',
  container_id: 'Container',
  condition: 'Condition',
  condition_borrowed: 'Condition in',
  condition_returned: 'Condition out',
  quantity: 'Quantity',
  uid: 'UID',
  qr_code: 'QR code',
  name: 'Name',
  value: 'Value',
  due_date: 'Due date',
  tag_number: 'Tag number',
  returned_date: 'Returned',
  lender_name: 'Lender',
  deposit_returned: 'Deposit returned',
  rental_start_date: 'Start',
  rental_end_date: 'End',
  renter_name: 'Renter',
};
