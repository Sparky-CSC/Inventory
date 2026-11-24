// Keeping inventory items in step with rental orders: an item that goes out on
// a rental is marked "Rented" (with the order it is on), and is released when
// it is checked back in, the order is completed or cancelled, or the line is
// removed from the order.

import { InventoryItem, User } from '@/api/entities';

export const OUT_STATUSES = ['rented_out', 'partially_returned'];
export const BOOKED_STATUSES = ['confirmed', 'rented_out', 'partially_returned'];

const orderLabel = (order) => order.order_number || order.quote_number || `order ${String(order.id || '').slice(-6)}`;

async function whoAmI() {
  try {
    const user = await User.me();
    return user?.full_name || user?.email || '';
  } catch {
    return '';
  }
}

async function getItem(id) {
  try {
    return await InventoryItem.get(id);
  } catch {
    return null; // the item may have been deleted since the order was made
  }
}

async function markRented(item, order) {
  if (item.status === 'rented' && item.current_rental?.order_id === order.id) return;
  await InventoryItem.update(
    item.id,
    {
      status: 'rented',
      current_rental: {
        order_id: order.id,
        order_number: orderLabel(order),
        renter_name: order.renter_name || '',
        due_date: order.rental_end_date ? new Date(order.rental_end_date).toISOString() : '',
      },
    },
    {
      activity: {
        action: 'rented_out',
        summary: `Out on rental to ${order.renter_name || 'renter'} (${orderLabel(order)})`,
        relatedId: order.id,
      },
    }
  );
}

async function release(item, order, { line, reason }) {
  // Only release an item this order is holding (or one marked rented before
  // orders kept track of which order held it).
  const heldHere = item.current_rental?.order_id === order.id;
  const heldByUnknown = !item.current_rental?.order_id && item.status === 'rented';
  if (!heldHere && !heldByUnknown) return;
  const condition = line?.condition_returned;
  const needsWork = ['poor', 'needs_repair'].includes(condition);
  await InventoryItem.update(
    item.id,
    {
      status: needsWork ? 'maintenance' : 'available',
      current_rental: null,
      ...(condition ? { condition } : {}),
    },
    {
      activity: {
        action: line?.returned ? 'rental_returned' : 'status_changed',
        summary: line?.returned
          ? `Checked in from ${order.renter_name || 'renter'} (${orderLabel(order)})${needsWork ? ' — needs repair' : ''}`
          : reason,
        notes: line?.return_notes || '',
        relatedId: order.id,
      },
    }
  );
}

/**
 * After an order is saved: mark its items rented or release them.
 * `before` is the order as it was (or null for a new order).
 */
export async function syncRentalInventory(before, after) {
  if (!after?.id) return;
  const isOut = OUT_STATUSES.includes(after.status);
  const lines = after.line_items || [];
  const reason =
    after.status === 'cancelled'
      ? `Rental ${orderLabel(after)} cancelled`
      : after.status === 'completed'
        ? `Rental ${orderLabel(after)} completed`
        : `No longer out on ${orderLabel(after)}`;

  for (const line of lines) {
    if (!line.inventory_item_id) continue;
    const item = await getItem(line.inventory_item_id);
    if (!item) continue;
    if (isOut && !line.returned) await markRented(item, after);
    else await release(item, after, { line, reason });
  }

  // Lines taken off the order give their item back.
  const stillOnOrder = new Set(lines.map((l) => l.inventory_item_id));
  for (const line of before?.line_items || []) {
    if (!line.inventory_item_id || stillOnOrder.has(line.inventory_item_id)) continue;
    const item = await getItem(line.inventory_item_id);
    if (item) await release(item, after, { reason: `Removed from ${orderLabel(after)}` });
  }
}

/** Mark the order's items as checked out now. Returns the order fields to save. */
export async function checkOutFields(order, itemsById = new Map()) {
  const by = await whoAmI();
  return {
    status: 'rented_out',
    checked_out_at: new Date().toISOString(),
    checked_out_by: by,
    line_items: (order.line_items || []).map((line) => ({
      ...line,
      condition_out: line.condition_out || itemsById.get(line.inventory_item_id)?.condition || 'good',
      returned: false,
    })),
  };
}

/**
 * Check in some lines of an order. `returns` maps line index →
 * { condition_returned, return_notes }. Returns the order fields to save.
 */
export async function checkInFields(order, returns) {
  const by = await whoAmI();
  const now = new Date().toISOString();
  const line_items = (order.line_items || []).map((line, index) =>
    returns[index]
      ? { ...line, returned: true, returned_date: now, returned_by: by, ...returns[index] }
      : line
  );
  const allBack = line_items.every((l) => l.returned);
  return { line_items, status: allBack ? 'completed' : 'partially_returned' };
}

/** Do two date ranges overlap (by day)? */
function overlaps(aStart, aEnd, bStart, bEnd) {
  const day = (d) => String(new Date(d).toISOString()).slice(0, 10);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return day(aStart) <= day(bEnd) && day(bStart) <= day(aEnd);
}

/**
 * Items on this order that are already booked on another order for some of
 * the same days. Returns [{ itemId, itemName, order }].
 */
export function findBookingConflicts(order, allOrders = []) {
  if (!order) return [];
  const mine = new Set((order.line_items || []).map((l) => l.inventory_item_id).filter(Boolean));
  const conflicts = [];
  for (const other of allOrders) {
    if (other.id === order.id || !BOOKED_STATUSES.includes(other.status)) continue;
    if (!overlaps(order.rental_start_date, order.rental_end_date, other.rental_start_date, other.rental_end_date)) continue;
    for (const line of other.line_items || []) {
      if (mine.has(line.inventory_item_id) && !line.returned) {
        conflicts.push({ itemId: line.inventory_item_id, itemName: line.item_name, order: other });
      }
    }
  }
  return conflicts;
}
