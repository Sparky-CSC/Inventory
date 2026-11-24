import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import { ActivityLog } from '@/api/entities';
import { onDataChanged } from '@/api/events';
import { ACTION_LABELS, FIELD_LABELS } from '@/api/activity';
import { useData } from './DataManager';

const titleCase = (text) => String(text ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const ACTION_COLORS = {
  created: 'bg-success',
  checked_in: 'bg-success',
  returned: 'bg-info',
  rental_returned: 'bg-info',
  rented_out: 'bg-warning',
  deleted: 'bg-error',
  moved: 'bg-primary',
  audited: 'bg-secondary',
  audit_completed: 'bg-secondary',
};

/** Show one changed value in words (container ids become names, dates become dates). */
export function useValueFormatter() {
  const { containers } = useData();
  const containerNames = useMemo(() => new Map((containers || []).map((c) => [c.id, c.name])), [containers]);
  return (field, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'container_id') return containerNames.get(value) || 'a container';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (/date|_at$/.test(field) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return format(new Date(value.length === 10 ? `${value}T12:00:00` : value), 'MMM d, yyyy');
      } catch {
        return value;
      }
    }
    if (['status', 'condition', 'condition_borrowed', 'condition_returned'].includes(field)) return titleCase(value);
    return String(value);
  };
}

/** One entry of the log, as a line of text. */
export function ActivityEntry({ entry, showRecord = false, href = null }) {
  const formatValue = useValueFormatter();
  const label = ACTION_LABELS[entry.action] || titleCase(entry.action);
  const when = entry.at || entry.created_date;
  return (
    <li className="relative pl-4 pb-4 last:pb-0">
      <span
        className={`absolute -left-[5.5px] top-1.5 h-2.5 w-2.5 rounded-full ${ACTION_COLORS[entry.action] || 'bg-base-content/40'}`}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold text-base-content">{label}</span>
        {showRecord && (entry.record_name || entry.record_code) && (
          <span className="text-base-content/80">
            {href ? (
              <Link to={href} className="underline decoration-dotted hover:text-primary">{entry.record_name || 'Open'}</Link>
            ) : (
              entry.record_name
            )}
            {entry.record_code ? <span className="font-mono text-xs ml-1">({entry.record_code})</span> : null}
          </span>
        )}
        <span className="text-xs text-base-content/60">
          {when ? format(new Date(when), 'MMM d, yyyy h:mm a') : ''}
          {entry.user_name ? ` · ${entry.user_name}` : ''}
        </span>
      </div>
      {entry.summary && <p className="text-sm text-base-content/80">{entry.summary}</p>}
      {Array.isArray(entry.changes) && entry.changes.length > 0 && (
        <ul className="text-xs text-base-content/70 mt-0.5 space-y-0.5">
          {entry.changes.map((change, i) => (
            <li key={i}>
              {FIELD_LABELS[change.field] || titleCase(change.field)}: {formatValue(change.field, change.from)} →{' '}
              <span className="font-medium text-base-content">{formatValue(change.field, change.to)}</span>
            </li>
          ))}
        </ul>
      )}
      {entry.notes && <p className="text-xs text-base-content/70 mt-0.5 whitespace-pre-wrap">Note: {entry.notes}</p>}
    </li>
  );
}

/**
 * The history of one record (an item, a borrowed item, an order), newest first.
 */
export default function ActivityTimeline({ recordId, emptyText = 'No activity recorded yet.', limit = 100 }) {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return undefined;
    let cancelled = false;
    const load = () =>
      ActivityLog.filter({ record_id: String(recordId) }, '-at', limit)
        .then((list) => {
          if (!cancelled) setEntries(list);
        })
        .catch((error) => console.warn('Could not load activity:', error))
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    load();
    // New entries are written just after a save; pick them up when they land.
    let timer = null;
    const stop = onDataChanged(({ entity }) => {
      if (entity !== 'ActivityLog') return;
      clearTimeout(timer);
      timer = setTimeout(load, 200);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop();
    };
  }, [recordId, limit]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/60">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="text-sm text-base-content/60 flex items-center gap-2">
        <History className="w-4 h-4" /> {emptyText}
      </p>
    );
  }
  return (
    <ol className="border-l border-base-300 ml-1 pl-0">
      {entries.map((entry) => (
        <ActivityEntry key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}
