import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowRightLeft, Edit, Printer, Undo2, Trash2, MapPin, AlertTriangle, CheckCircle, Clock, Loader2,
  FileCheck, ShieldAlert, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BorrowedItem } from '@/api/entities';
import { onDataChanged } from '@/api/events';
import { useData } from '../components/shared/DataManager';
import BackButton from '../components/shared/BackButton';
import ActivityTimeline from '../components/shared/ActivityTimeline';
import QRCodeGenerator from '../components/shared/QRCodeGenerator';
import BorrowedReturnDialog from '../components/borrowed/BorrowedReturnDialog';
import { checkInPhotos, returnPhotos, undoBorrowedReturn, updateBorrowedItem } from '@/lib/borrowed';
import { borrowedItemUrl, daysUntilDue, isLoanOverdue } from '@/lib/itemCodes';
import { createPageUrl } from '@/utils';

const NONE = '__none__';
const titleCase = (text) => String(text || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (value) => {
  if (!value) return '';
  const text = String(value);
  return format(new Date(text.length === 10 ? `${text}T12:00:00` : text), 'MMM d, yyyy');
};

function Row({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-base-content/60">{label}</p>
      <div className="text-base-content break-words">{children}</div>
    </div>
  );
}

function PhotoStrip({ photos, empty }) {
  if (!photos.length) return <p className="text-sm text-base-content/60">{empty}</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((p, i) => (
        <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block">
          <div className={`aspect-square rounded-lg overflow-hidden border-2 ${p.shows_damage ? 'border-error' : 'border-base-300'}`}>
            <img src={p.url} alt={p.caption || 'Photo'} className="w-full h-full object-cover" />
          </div>
          {(p.caption || p.shows_damage) && (
            <p className="text-xs mt-1 text-base-content/70">
              {p.shows_damage && <span className="text-error font-semibold">Damage · </span>}
              {p.caption}
            </p>
          )}
        </a>
      ))}
    </div>
  );
}

export default function BorrowedItemDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const { locations, containers } = useData();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [undoReason, setUndoReason] = useState('');
  const [move, setMove] = useState({ storage_location: '', container_id: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('No borrowed item was chosen.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const load = () =>
      BorrowedItem.get(id)
        .then((record) => !cancelled && setItem(record))
        .catch(() => !cancelled && setError('This borrowed item could not be found. It may have been deleted.'))
        .finally(() => !cancelled && setLoading(false));
    load();
    const stop = onDataChanged(({ entity, record }) => {
      if (entity === 'BorrowedItem' && (!record || record.id === id)) load();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [id]);

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-base-content/70"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  }
  if (error || !item) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto">
        <BackButton className="mb-4" />
        <Alert variant="destructive"><AlertDescription>{error || 'Not found.'}</AlertDescription></Alert>
      </div>
    );
  }

  const returned = item.status === 'returned';
  const overdue = isLoanOverdue(item);
  const days = daysUntilDue(item);
  const containerName = (containers || []).find((c) => c.id === item.container_id)?.name;
  const inPhotos = checkInPhotos(item);
  const outPhotos = returnPhotos(item);

  const status = returned
    ? { text: 'Returned', icon: CheckCircle, cls: 'bg-success/10 text-success border-success/40' }
    : overdue
      ? { text: `Overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, icon: AlertTriangle, cls: 'bg-error/10 text-error border-error/40' }
      : { text: days === null ? 'With us' : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`, icon: Clock, cls: 'bg-info/10 text-info border-info/40' };
  const StatusIcon = status.icon;

  const printTag = () => navigate(createPageUrl(`PrintHangTags?loans=${item.id}`), { state: { loans: [item] } });

  const saveMove = async () => {
    setBusy(true);
    try {
      await updateBorrowedItem(item.id, {
        storage_location: move.storage_location || null,
        container_id: move.container_id || null,
      });
      setShowMove(false);
    } finally {
      setBusy(false);
    }
  };

  const doUndo = async () => {
    setBusy(true);
    try {
      await undoBorrowedReturn(item, undoReason.trim());
      setShowUndo(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await BorrowedItem.delete(item.id);
      navigate(createPageUrl('BorrowedItems'), { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <BackButton className="mb-4" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-warning font-semibold flex items-center gap-1">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Borrowed — not theatre property
            </p>
            <h1 className="text-3xl font-bold text-base-content break-words">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="font-mono text-lg font-bold text-primary">{item.tag_number || 'No tag number'}</span>
              <Badge variant="outline" className={status.cls}><StatusIcon className="w-3.5 h-3.5 mr-1" />{status.text}</Badge>
              {item.return_discrepancy && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/40">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Issue at return
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-base-200/50 border-base-300">
              <CardHeader><CardTitle>Loan details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label="Borrowed from">{item.lender_name}</Row>
                <Row label="Lender reference">{item.lender_reference}</Row>
                <Row label="Email">{item.lender_email && <a className="underline" href={`mailto:${item.lender_email}`}>{item.lender_email}</a>}</Row>
                <Row label="Phone">{item.lender_phone && <a className="underline" href={`tel:${item.lender_phone}`}>{item.lender_phone}</a>}</Row>
                <Row label="Contact">{item.lender_contact}</Row>
                <Row label="For production">{item.show_production}</Row>
                <Row label="Arrived">{fmtDate(item.borrowed_date)}{item.received_by ? ` · received by ${item.received_by}` : ''}</Row>
                <Row label="Return by">{item.due_date ? fmtDate(item.due_date) : 'No set date'}</Row>
                <Row label="Replacement value">{item.replacement_value != null && item.replacement_value !== '' ? `$${Number(item.replacement_value).toFixed(2)}` : ''}</Row>
                <Row label="Rental fee">{Number(item.rental_fee) > 0 ? `$${Number(item.rental_fee).toFixed(2)}` : ''}</Row>
                <Row label="Deposit">{Number(item.deposit_amount) > 0 ? `$${Number(item.deposit_amount).toFixed(2)}${item.deposit_returned ? ' (refunded)' : ''}` : ''}</Row>
                <Row label="Loan agreement">{item.agreement_on_file ? <span className="text-success flex items-center gap-1"><FileCheck className="w-4 h-4" /> On file</span> : <span className="text-warning">Not on file</span>}</Row>
                <Row label="Stored in">{[item.storage_location, containerName].filter(Boolean).join(' · ') || 'Not recorded'}</Row>
                {returned && <Row label="Returned">{fmtDate(item.returned_date)}{item.returned_to ? ` to ${item.returned_to}` : ''}{item.returned_by ? ` · by ${item.returned_by}` : ''}</Row>}
                <div className="sm:col-span-2"><Row label="Description">{item.description}</Row></div>
                <div className="sm:col-span-2"><Row label="Care & handling">{item.care_instructions && <span className="text-warning-content font-medium">{item.care_instructions}</span>}</Row></div>
                <div className="sm:col-span-2"><Row label="Notes">{item.notes && <span className="whitespace-pre-wrap">{item.notes}</span>}</Row></div>
              </CardContent>
            </Card>

            <Card className="bg-base-200/50 border-base-300">
              <CardHeader><CardTitle>Condition & pieces</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-base-content/60">When it arrived</p>
                    <p className="font-medium">{titleCase(item.condition_borrowed) || '—'}{item.lender_acknowledged_condition ? ' · agreed by lender' : ''}</p>
                    {item.condition_notes_borrowed && <p className="text-base-content/80 whitespace-pre-wrap">{item.condition_notes_borrowed}</p>}
                  </div>
                  {returned && (
                    <div>
                      <p className="text-xs font-semibold text-base-content/60">When returned</p>
                      <p className="font-medium">{titleCase(item.condition_returned) || '—'}</p>
                      {item.condition_notes_returned && <p className="text-base-content/80 whitespace-pre-wrap">{item.condition_notes_returned}</p>}
                    </div>
                  )}
                </div>
                {item.pieces?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-base-content/60 mb-1">Pieces ({item.pieces.reduce((n, p) => n + (Number(p.count) || 1), 0)})</p>
                    <ul className="divide-y divide-base-300 border border-base-300 rounded-lg">
                      {item.pieces.map((p, i) => (
                        <li key={i} className="flex items-center justify-between px-3 py-1.5">
                          <span>{p.name}{Number(p.count) > 1 ? ` × ${p.count}` : ''}</span>
                          {returned && (p.returned ? <span className="text-success text-xs">Returned</span> : <span className="text-error text-xs font-semibold">Not returned</span>)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-base-200/50 border-base-300">
              <CardHeader><CardTitle>Photos at check-in ({inPhotos.length})</CardTitle></CardHeader>
              <CardContent>
                <PhotoStrip photos={inPhotos} empty="No check-in photos. Edit the item to add some." />
              </CardContent>
            </Card>
            {(returned || outPhotos.length > 0) && (
              <Card className="bg-base-200/50 border-base-300">
                <CardHeader><CardTitle>Photos at return ({outPhotos.length})</CardTitle></CardHeader>
                <CardContent>
                  <PhotoStrip photos={outPhotos} empty="No photos were taken at return." />
                </CardContent>
              </Card>
            )}

            <Card className="bg-base-200/50 border-base-300">
              <CardHeader><CardTitle>History</CardTitle></CardHeader>
              <CardContent>
                <ActivityTimeline recordId={item.id} emptyText="No history recorded yet (this item was added before history tracking)." />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-base-200/50 border-base-300">
              <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {returned ? (
                  <Button variant="outline" onClick={() => { setUndoReason(''); setShowUndo(true); }}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Undo return
                  </Button>
                ) : (
                  <Button onClick={() => setShowReturn(true)}>
                    <Undo2 className="w-4 h-4 mr-2" /> Return to lender
                  </Button>
                )}
                <Button variant="outline" onClick={printTag}>
                  <Printer className="w-4 h-4 mr-2" /> Print temporary tag
                </Button>
                {!returned && (
                  <Button variant="outline" onClick={() => { setMove({ storage_location: item.storage_location || '', container_id: item.container_id || '' }); setShowMove(true); }}>
                    <MapPin className="w-4 h-4 mr-2" /> Move / change storage
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate(createPageUrl(`BorrowedCheckIn?id=${item.id}`))}>
                  <Edit className="w-4 h-4 mr-2" /> Edit details
                </Button>
                <Button variant="ghost" className="text-error" onClick={() => setShowDelete(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete record
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-base-200/50 border-base-300">
              <CardHeader><CardTitle>Tag code</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center text-center gap-2">
                <QRCodeGenerator data={borrowedItemUrl(item)} size={150} />
                <p className="text-xs text-base-content/60">Scanning the tag opens this page.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BorrowedReturnDialog item={item} open={showReturn} onOpenChange={setShowReturn} onReturned={setItem} />

      <Dialog open={showMove} onOpenChange={setShowMove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {item.tag_number || item.name}</DialogTitle>
            <DialogDescription>Record where the item is now kept. The move is added to its history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Location</Label>
              <Select value={move.storage_location || NONE} onValueChange={(v) => setMove((m) => ({ ...m, storage_location: v === NONE ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not stored</SelectItem>
                  {(locations || []).map((l) => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Container</Label>
              <Select value={move.container_id || NONE} onValueChange={(v) => setMove((m) => ({ ...m, container_id: v === NONE ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(containers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={saveMove} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUndo} onOpenChange={setShowUndo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo the return?</DialogTitle>
            <DialogDescription>The item will be marked as back in our care. Say why, for the history.</DialogDescription>
          </DialogHeader>
          <Textarea value={undoReason} onChange={(e) => setUndoReason(e.target.value)} placeholder="e.g. Marked returned by mistake" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={doUndo} disabled={busy || !undoReason.trim()}>Undo return</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this record?</DialogTitle>
            <DialogDescription>
              Usually it is better to keep returned loans as a record. The history entries stay in the activity log.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={doDelete} disabled={busy}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
