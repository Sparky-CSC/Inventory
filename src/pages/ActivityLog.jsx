import React, { useEffect, useMemo, useState } from 'react';
import { History, Download, Search as SearchIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ActivityLog as ActivityLogEntity } from '@/api/entities';
import { onDataChanged } from '@/api/events';
import { ACTION_LABELS, FIELD_LABELS } from '@/api/activity';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BackButton from '../components/shared/BackButton';
import { ActivityEntry } from '../components/shared/ActivityTimeline';
import { createPageUrl } from '@/utils';

const TYPE_LABELS = {
  InventoryItem: 'Inventory items',
  BorrowedItem: 'Borrowed items',
  RentalOrder: 'Rental orders',
  Location: 'Locations',
  Container: 'Containers',
  InventoryAudit: 'Inventory counts',
};

const recordLink = (entry) => {
  if (!entry.record_id || entry.action === 'deleted') return null;
  if (entry.entity_type === 'InventoryItem') return createPageUrl(`ItemDetails?id=${entry.record_id}`);
  if (entry.entity_type === 'BorrowedItem') return createPageUrl(`BorrowedItemDetails?id=${entry.record_id}`);
  if (entry.entity_type === 'RentalOrder') return createPageUrl(`RentalOrderEditor?id=${entry.record_id}`);
  return null;
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shown, setShown] = useState(200);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      ActivityLogEntity.list('-at')
        .then((list) => !cancelled && setEntries(list))
        .catch((error) => console.warn('Could not load the activity log:', error))
        .finally(() => !cancelled && setIsLoading(false));
    load();
    let timer = null;
    const stop = onDataChanged(({ entity }) => {
      if (entity !== 'ActivityLog') return;
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop();
    };
  }, []);

  const actions = useMemo(() => [...new Set(entries.map((e) => e.action).filter(Boolean))].sort(), [entries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (type !== 'all' && entry.entity_type !== type) return false;
      if (action !== 'all' && entry.action !== action) return false;
      const day = String(entry.at || entry.created_date || '').slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!term) return true;
      return [entry.record_name, entry.record_code, entry.user_name, entry.user_email, entry.summary, entry.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [entries, search, type, action, from, to]);

  const exportCsv = () => {
    const header = ['When', 'Who', 'Type', 'Record', 'ID / Tag', 'Action', 'Summary', 'Changes', 'Notes'];
    const rows = filtered.map((e) => [
      e.at || e.created_date,
      e.user_name,
      e.entity_type,
      e.record_name,
      e.record_code,
      ACTION_LABELS[e.action] || e.action,
      e.summary,
      (e.changes || []).map((c) => `${FIELD_LABELS[c.field] || c.field}: ${c.from ?? ''} -> ${c.to ?? ''}`).join('; '),
      e.notes,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
              <History className="w-8 h-8 text-primary" /> Activity Log
            </h1>
            <p className="text-base text-primary font-medium">
              Every check-in, return, move, status change and count, with who did it and when.
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        <Card className="mb-6 bg-base-200/50 border-base-300">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <Label htmlFor="log-search">Search</Label>
              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
                <Input id="log-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, ID, person, note…" />
              </div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everything</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="log-from">From</Label>
                <Input id="log-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="log-to">To</Label>
                <Input id="log-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-base-200/50 border-base-300">
          <CardContent className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center gap-2 text-base-content/60"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : filtered.length === 0 ? (
              <p className="text-base-content/60">Nothing recorded{entries.length ? ' matches these filters' : ' yet'}.</p>
            ) : (
              <>
                <p className="text-xs text-base-content/60 mb-4">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</p>
                <ol className="border-l border-base-300 ml-1">
                  {filtered.slice(0, shown).map((entry) => (
                    <ActivityEntry key={entry.id} entry={entry} showRecord href={recordLink(entry)} />
                  ))}
                </ol>
                {filtered.length > shown && (
                  <Button variant="outline" className="mt-4" onClick={() => setShown((n) => n + 200)}>
                    Show more
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
