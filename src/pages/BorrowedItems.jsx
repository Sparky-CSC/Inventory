import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowRightLeft, ClipboardCheck, Clock, AlertTriangle, CheckCircle, Package, Printer, Search as SearchIcon,
  Undo2, MapPin, Tag, Loader2, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useData } from '../components/shared/DataManager';
import BackButton from '../components/shared/BackButton';
import BorrowedReturnDialog from '../components/borrowed/BorrowedReturnDialog';
import { primaryPhoto, updateBorrowedItem } from '@/lib/borrowed';
import { daysUntilDue, isLoanOverdue } from '@/lib/itemCodes';
import { createPageUrl } from '@/utils';

const FILTERS = [
  { key: 'active', label: 'With us' },
  { key: 'due_soon', label: 'Due within 7 days' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' },
  { key: 'all', label: 'All' },
];

const fmtDate = (value) => {
  if (!value) return '';
  const text = String(value);
  return format(new Date(text.length === 10 ? `${text}T12:00:00` : text), 'MMM d, yyyy');
};

function LoanCard({ item, selected, onSelect, onOpen, onReturn, containerName }) {
  const returned = item.status === 'returned';
  const overdue = isLoanOverdue(item);
  const days = daysUntilDue(item);
  const photo = primaryPhoto(item);
  const border = returned ? 'border-l-success' : overdue ? 'border-l-error' : days !== null && days <= 7 ? 'border-l-warning' : 'border-l-info';

  return (
    <Card className={`overflow-hidden bg-base-200/50 border-base-300 border-l-4 ${border}`}>
      <div className="flex gap-3 p-3">
        <div className="flex flex-col items-center gap-2">
          <Checkbox checked={selected} onCheckedChange={() => onSelect(item.id)} aria-label={`Select ${item.name}`} />
        </div>
        <button type="button" onClick={() => onOpen(item)} className="flex gap-3 flex-1 min-w-0 text-left">
          <div className="w-16 h-16 flex-none rounded-lg overflow-hidden bg-base-300 flex items-center justify-center">
            {photo ? <img src={photo.url} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-base-content/30" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary">{item.tag_number || 'No tag'}</span>
              {returned ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/40">Returned</Badge>
              ) : overdue ? (
                <Badge variant="outline" className="bg-error/10 text-error border-error/40">Overdue {Math.abs(days)}d</Badge>
              ) : days !== null ? (
                <Badge variant="outline" className={days <= 7 ? 'bg-warning/10 text-warning border-warning/40' : 'bg-info/10 text-info border-info/40'}>
                  {days === 0 ? 'Due today' : `Due in ${days}d`}
                </Badge>
              ) : null}
              {item.return_discrepancy && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/40">Issue</Badge>}
            </div>
            <p className="font-semibold text-base-content truncate">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</p>
            <p className="text-xs text-base-content/70 truncate">From {item.lender_name}{item.show_production ? ` · ${item.show_production}` : ''}</p>
            <p className="text-xs text-base-content/60 truncate">
              {returned
                ? `Returned ${fmtDate(item.returned_date)}`
                : item.due_date
                  ? `Return by ${fmtDate(item.due_date)}`
                  : 'No set return date'}
              {!returned && (item.storage_location || containerName) ? (
                <span> · <MapPin className="w-3 h-3 inline -mt-0.5" /> {[item.storage_location, containerName].filter(Boolean).join(' · ')}</span>
              ) : null}
            </p>
          </div>
        </button>
      </div>
      {!returned && (
        <div className="bg-base-200/80 px-3 py-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => onReturn(item)}>
            <Undo2 className="w-4 h-4 mr-1" /> Return to lender
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function BorrowedItems() {
  const navigate = useNavigate();
  const location = useLocation();
  const { borrowedItems, containers, isLoading } = useData();
  const initialSearch = new URLSearchParams(location.search).get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState(initialSearch ? 'all' : 'active');
  const [selected, setSelected] = useState([]);
  const [returning, setReturning] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const containerNames = useMemo(() => new Map((containers || []).map((c) => [c.id, c.name])), [containers]);
  const list = borrowedItems || [];

  const stats = useMemo(() => {
    const active = list.filter((i) => i.status !== 'returned');
    return {
      active: active.length,
      overdue: active.filter((i) => isLoanOverdue(i)).length,
      dueSoon: active.filter((i) => !isLoanOverdue(i) && daysUntilDue(i) !== null && daysUntilDue(i) <= 7).length,
      returned: list.length - active.length,
      untagged: active.filter((i) => !i.tag_number),
    };
  }, [list]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list
      .filter((item) => {
        const returned = item.status === 'returned';
        if (filter === 'active' && returned) return false;
        if (filter === 'returned' && !returned) return false;
        if (filter === 'overdue' && !isLoanOverdue(item)) return false;
        if (filter === 'due_soon') {
          const d = daysUntilDue(item);
          if (returned || isLoanOverdue(item) || d === null || d > 7) return false;
        }
        if (!term) return true;
        return [item.name, item.tag_number, item.lender_name, item.show_production, item.description, item.lender_reference, item.storage_location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        // Most urgent first while they are with us; newest returns first after that.
        const ra = a.status === 'returned';
        const rb = b.status === 'returned';
        if (ra !== rb) return ra ? 1 : -1;
        if (!ra) return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
        return String(b.returned_date || '').localeCompare(String(a.returned_date || ''));
      });
  }, [list, filter, search]);

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectedItems = list.filter((i) => selected.includes(i.id));
  const allShownSelected = shown.length > 0 && shown.every((i) => selected.includes(i.id));

  const printTags = (items) =>
    navigate(createPageUrl(`PrintHangTags?loans=${items.map((i) => i.id).join(',')}`), { state: { loans: items } });

  // Loans recorded before tag numbers existed get one, in the order they arrived.
  const assignMissingTags = async () => {
    setAssigning(true);
    try {
      const sorted = [...stats.untagged].sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)));
      for (const item of sorted) await updateBorrowedItem(item.id, {});
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
              <ArrowRightLeft className="w-8 h-8 text-primary" /> Borrowed Items
            </h1>
            <p className="text-base lg:text-lg text-primary font-medium">
              Items borrowed from other people and organizations: check them in, tag them, and get them back on time.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate(createPageUrl('BorrowedCheckIn'))}>
            <ClipboardCheck className="w-5 h-5 mr-2" /> Check in item
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { key: 'active', label: 'With us', value: stats.active, icon: Clock, cls: 'text-info' },
            { key: 'due_soon', label: 'Due within 7 days', value: stats.dueSoon, icon: CalendarClock, cls: 'text-warning' },
            { key: 'overdue', label: 'Overdue', value: stats.overdue, icon: AlertTriangle, cls: 'text-error' },
            { key: 'returned', label: 'Returned', value: stats.returned, icon: CheckCircle, cls: 'text-success' },
          ].map((s) => (
            <button key={s.key} type="button" onClick={() => setFilter(s.key)} className="text-left">
              <Card className={`bg-base-200/50 border-base-300 ${filter === s.key ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <s.icon className={`w-7 h-7 ${s.cls}`} />
                  <div>
                    <p className="text-xs font-medium text-base-content/70">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        {stats.untagged.length > 0 && (
          <Alert className="mb-4 bg-warning/10 border-warning/50">
            <Tag className="h-4 w-4" />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>{stats.untagged.length} borrowed item{stats.untagged.length === 1 ? ' has' : 's have'} no tag number yet.</span>
              <Button size="sm" variant="outline" onClick={assignMissingTags} disabled={assigning}>
                {assigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Assign tag numbers
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, tag number, lender, show…" />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-3 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={allShownSelected}
              onCheckedChange={(c) => setSelected(c ? [...new Set([...selected, ...shown.map((i) => i.id)])] : selected.filter((id) => !shown.some((i) => i.id === id)))}
            />
            Select all shown
          </label>
          <Button size="sm" variant="outline" disabled={!selectedItems.length} onClick={() => printTags(selectedItems)}>
            <Printer className="w-4 h-4 mr-2" /> Print tags{selectedItems.length ? ` (${selectedItems.length})` : ''}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading && list.length === 0 ? (
            Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-base-300" />)
          ) : shown.length > 0 ? (
            shown.map((item) => (
              <LoanCard
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                onSelect={toggle}
                onOpen={(i) => navigate(createPageUrl(`BorrowedItemDetails?id=${i.id}`))}
                onReturn={setReturning}
                containerName={containerNames.get(item.container_id)}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <Package className="w-14 h-14 text-base-content/20 mx-auto mb-3" />
              <h3 className="text-lg font-semibold">{list.length ? 'Nothing matches' : 'No borrowed items yet'}</h3>
              <p className="text-base-content/70">
                {list.length ? 'Try another filter or search.' : 'Use “Check in item” when something borrowed arrives.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <BorrowedReturnDialog item={returning} open={Boolean(returning)} onOpenChange={(open) => !open && setReturning(null)} />
    </div>
  );
}
