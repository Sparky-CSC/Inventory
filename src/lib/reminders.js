// Reminder templates and the logic that prepares reminders when they are due.
//
// There is no server watching the clock, so reminders are prepared whenever
// someone opens the Reminders page: every rental or borrowed item that has
// reached its reminder date gets a ready-to-send reminder in the list. Sending
// is one click — it opens your email program with everything filled in.

import { format } from 'date-fns';
import { BorrowedItem, ReminderSchedule, ReminderSettings, RentalOrder } from '@/api/entities';

export const defaultTemplates = {
  rental_order: {
    return_due: {
      subject: 'Rental Return Reminder - Order {order_number}',
      body: `Dear {renter_name},

This is a friendly reminder that your rental order {order_number} is due for return on {due_date}.

Items to return:
{items}

Please ensure all items are returned in good condition by the due date to avoid any late fees.

If you need to extend your rental or have any questions, please contact us immediately.

Thank you,
StageVault Team`
    },
    overdue: {
      subject: 'OVERDUE: Rental Return Required - Order {order_number}',
      body: `Dear {renter_name},

Your rental order {order_number} was due for return on {due_date} and is now OVERDUE.

Items that need to be returned immediately:
{items}

Please return these items as soon as possible to avoid additional late fees.

Contact us immediately to arrange return or discuss this matter.

Thank you,
StageVault Team`
    }
  },
  borrowed_item: {
    return_due: {
      subject: 'Item Return Reminder - {item_name}',
      body: `Dear {lender_name},

This is a reminder that the item "{item_name}" that we borrowed from you on {borrowed_date} is due for return on {due_date}.

We will be preparing the item for return. Please let us know your preferred pickup/return arrangement.

Thank you for lending this item to us.

Best regards,
StageVault Team`
    },
    overdue: {
      subject: 'OVERDUE: Item Return - {item_name}',
      body: `Dear {lender_name},

The item "{item_name}" that we borrowed from you was due for return on {due_date} and is now overdue.

We apologize for the delay and will arrange for immediate return. Please contact us to coordinate the return.

Thank you for your patience.

Best regards,
StageVault Team`
    }
  }
};

export const DEFAULT_REMINDER_SETTINGS = [
  // Rental reminders
  {
    entity_type: 'rental_order',
    reminder_type: 'return_due',
    is_enabled: true,
    days_before_due: 3,
    email_template_subject: defaultTemplates.rental_order.return_due.subject,
    email_template_body: defaultTemplates.rental_order.return_due.body,
    send_to_renter: true,
    send_to_staff: false
  },
  {
    entity_type: 'rental_order',
    reminder_type: 'overdue',
    is_enabled: true,
    days_before_due: -1,
    email_template_subject: defaultTemplates.rental_order.overdue.subject,
    email_template_body: defaultTemplates.rental_order.overdue.body,
    send_to_renter: true,
    send_to_staff: true
  },
  // Borrowed item reminders
  {
    entity_type: 'borrowed_item',
    reminder_type: 'return_due',
    is_enabled: true,
    days_before_due: 2,
    email_template_subject: defaultTemplates.borrowed_item.return_due.subject,
    email_template_body: defaultTemplates.borrowed_item.return_due.body,
    send_to_renter: true,
    send_to_staff: false
  },
  {
    entity_type: 'borrowed_item',
    reminder_type: 'overdue',
    is_enabled: true,
    days_before_due: -1,
    email_template_subject: defaultTemplates.borrowed_item.overdue.subject,
    email_template_body: defaultTemplates.borrowed_item.overdue.body,
    send_to_renter: true,
    send_to_staff: true
  }
];

/** Create the four standard reminder settings (fixed ids, so this is safe to repeat). */
export async function createDefaultReminderSettings() {
  return ReminderSettings.importRecords(
    DEFAULT_REMINDER_SETTINGS.map((setting) => ({
      ...setting,
      id: `default-${setting.entity_type}-${setting.reminder_type}`,
    }))
  );
}

const DAY = 24 * 60 * 60 * 1000;

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : format(date, 'MMMM d, yyyy');
}

/** Replace {placeholders} in a template. Unknown placeholders are left as they are. */
export function fillTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (whole, key) =>
    values[key] !== undefined && values[key] !== null ? String(values[key]) : whole
  );
}

function rentalDetails(order) {
  const number = order.quote_number || order.order_number || `#${String(order.id).slice(-6)}`;
  return {
    dueDate: order.rental_end_date,
    recipientEmail: order.renter_email,
    recipientName: order.renter_name,
    values: {
      order_number: number,
      renter_name: order.renter_name || 'Renter',
      due_date: formatDate(order.rental_end_date),
      items: (order.line_items || [])
        .map((line) => `- ${line.item_name}${line.quantity > 1 ? ` (x${line.quantity})` : ''}`)
        .join('\n'),
    },
  };
}

function borrowedDetails(item) {
  return {
    dueDate: item.due_date,
    recipientEmail: item.lender_email,
    recipientName: item.lender_name,
    values: {
      item_name: item.name,
      lender_name: item.lender_name || 'Lender',
      due_date: formatDate(item.due_date),
      borrowed_date: formatDate(item.borrowed_date),
    },
  };
}

let running = null;

/**
 * Prepare a reminder for everything that has reached its reminder date and
 * does not have one yet. Returns how many were added.
 */
export function generateDueReminders() {
  if (!running) {
    running = generate().finally(() => {
      running = null;
    });
  }
  return running;
}

async function generate() {
  let settings = await ReminderSettings.list();
  if (settings.length === 0) settings = await createDefaultReminderSettings();
  const enabled = settings.filter((setting) => setting.is_enabled !== false);
  if (enabled.length === 0) return 0;

  const [existing, orders, borrowed] = await Promise.all([
    ReminderSchedule.list(),
    RentalOrder.list(),
    BorrowedItem.list(),
  ]);
  const existingIds = new Set(existing.map((reminder) => reminder.id));
  const now = Date.now();

  const sources = {
    rental_order: orders
      .filter((order) => ['confirmed', 'rented_out', 'partially_returned'].includes(order.status))
      .map((order) => ({ id: order.id, ...rentalDetails(order) })),
    borrowed_item: borrowed
      .filter((item) => item.status !== 'returned')
      .map((item) => ({ id: item.id, ...borrowedDetails(item) })),
  };

  const toCreate = [];
  for (const setting of enabled) {
    for (const source of sources[setting.entity_type] || []) {
      const due = new Date(source.dueDate).getTime();
      if (!source.dueDate || Number.isNaN(due)) continue;
      const daysBefore = Number(setting.days_before_due) || 0;
      const triggerAt = due - daysBefore * DAY;
      if (now < triggerAt) continue;
      // A "coming due" reminder is pointless once the date has passed — the
      // "overdue" reminder takes over from there.
      if (setting.reminder_type === 'return_due' && now > due + DAY) continue;

      const recipients = [];
      if (setting.send_to_renter !== false && source.recipientEmail) {
        recipients.push({ kind: 'main', email: source.recipientEmail, name: source.recipientName });
      }
      if (setting.send_to_staff && setting.staff_email) {
        recipients.push({ kind: 'staff', email: setting.staff_email, name: 'Staff' });
      }

      for (const recipient of recipients) {
        // A fixed id per item + reminder type + recipient means two people
        // opening the page at once cannot create duplicates.
        const id = `auto-${source.id}-${setting.reminder_type}-${recipient.kind}`;
        if (existingIds.has(id)) continue;
        existingIds.add(id);
        toCreate.push({
          id,
          entity_type: setting.entity_type,
          entity_id: source.id,
          reminder_type: setting.reminder_type,
          recipient_email: recipient.email,
          recipient_name: recipient.name || '',
          scheduled_date: new Date(triggerAt).toISOString(),
          status: 'scheduled',
          message_subject: fillTemplate(setting.email_template_subject, source.values),
          message_body: fillTemplate(setting.email_template_body, source.values),
          days_before_due: daysBefore,
          auto_generated: true,
        });
      }
    }
  }

  if (toCreate.length > 0) await ReminderSchedule.importRecords(toCreate);
  return toCreate.length;
}
