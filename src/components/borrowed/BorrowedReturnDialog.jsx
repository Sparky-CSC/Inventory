import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Undo2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhotoCapture from '../shared/PhotoCapture';
import { checkInPhotos, returnBorrowedItem } from '@/lib/borrowed';

const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'needs_repair'];
const RANK = Object.fromEntries(CONDITIONS.map((c, i) => [c, i]));
const label = (c) => String(c || '').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/**
 * Return a borrowed item to its lender: check off every piece, compare its
 * condition with the check-in photos, photograph it going back, and record
 * who received it.
 */
export default function BorrowedReturnDialog({ item, open, onOpenChange, onReturned }) {
  const [pieces, setPieces] = useState([]);
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [returnedTo, setReturnedTo] = useState('');
  const [returnedDate, setReturnedDate] = useState('');
  const [depositReturned, setDepositReturned] = useState(false);
  const [acceptMissing, setAcceptMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    const list = item.pieces?.length
      ? item.pieces.map((p) => ({ ...p, returned: false }))
      : [{ name: `${item.name}${item.quantity > 1 ? ` (all ${item.quantity})` : ''}`, count: item.quantity || 1, returned: false, whole: true }];
    setPieces(list);
    setCondition(item.condition_borrowed || 'good');
    setNotes('');
    setPhotos(item.photos || []);
    setReturnedTo('');
    setReturnedDate(new Date().toISOString().split('T')[0]);
    setDepositReturned(Boolean(item.deposit_returned));
    setAcceptMissing(false);
    setError('');
  }, [open, item]);

  const before = useMemo(() => checkInPhotos(item), [item]);
  const missing = pieces.filter((p) => !p.returned);
  const worse = item && RANK[condition] > RANK[item.condition_borrowed || 'good'];
  const newPhotos = photos.filter((p) => p.stage === 'return');

  const submit = async () => {
    setError('');
    if (!returnedTo.trim()) return setError('Enter who at the lender received the item.');
    if (missing.length && !acceptMissing) return setError('Tick every piece being returned, or confirm that some are missing.');
    if ((missing.length || worse) && !notes.trim()) return setError('Explain what is missing or what changed in its condition.');
    setSaving(true);
    try {
      const updated = await returnBorrowedItem(item, {
        returned_date: returnedDate,
        returned_to: returnedTo.trim(),
        condition_returned: condition,
        condition_notes_returned: notes.trim(),
        // A single "whole item" row is only for the checklist; keep the item's own piece list.
        pieces: item.pieces?.length ? pieces : [],
        discrepancy: missing.length > 0,
        photos,
        deposit_returned: depositReturned,
      });
      onReturned?.(updated);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'The return could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-primary" /> Return to {item.lender_name}
          </DialogTitle>
          <DialogDescription>
            {item.name} · <span className="font-mono">{item.tag_number || 'no tag'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold">1. Check off every piece going back</h3>
            <div className="rounded-lg border border-base-300 divide-y divide-base-300">
              {pieces.map((piece, i) => (
                <label key={i} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                  <Checkbox
                    checked={piece.returned}
                    onCheckedChange={(c) => setPieces((list) => list.map((p, j) => (j === i ? { ...p, returned: Boolean(c) } : p)))}
                  />
                  <span className="flex-1">{piece.name}</span>
                  {Number(piece.count) > 1 && !piece.whole && <span className="text-base-content/60">× {piece.count}</span>}
                </label>
              ))}
            </div>
            {missing.length > 0 && (
              <label className="flex items-start gap-2 text-warning">
                <Checkbox checked={acceptMissing} onCheckedChange={(c) => setAcceptMissing(Boolean(c))} className="mt-0.5" />
                <span>Return anyway — {missing.length} piece{missing.length === 1 ? ' is' : 's are'} missing (explain below)</span>
              </label>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">2. Compare its condition</h3>
            {before.length > 0 ? (
              <div>
                <p className="text-xs text-base-content/60 mb-1">
                  At check-in: {label(item.condition_borrowed)}
                  {item.condition_notes_borrowed ? ` — ${item.condition_notes_borrowed}` : ''}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {before.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer" className="flex-none">
                      <img src={p.url} alt={p.caption || 'Check-in photo'} className={`h-20 w-20 object-cover rounded border ${p.shows_damage ? 'border-error' : 'border-base-300'}`} />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-base-content/60">No check-in photos were taken for this item.</p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Condition now</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{label(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {worse && (
              <p className="text-warning flex items-center gap-1 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" /> Worse than when it arrived. Photograph the damage and describe it.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="return-notes">Notes{missing.length || worse ? ' (required)' : ''}</Label>
              <Textarea id="return-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the lender should know, or anything missing or damaged" />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">3. Photos as it goes back {newPhotos.length ? `(${newPhotos.length})` : '(recommended)'}</h3>
            <PhotoCapture photos={photos} onChange={setPhotos} stage="return" legacyStage="check_in" allowPrimary={false} />
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">4. Hand-over</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="returned-to">Received by (at the lender)</Label>
                <Input id="returned-to" value={returnedTo} onChange={(e) => setReturnedTo(e.target.value)} placeholder="Name of the person" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="returned-date">Date returned</Label>
                <Input id="returned-date" type="date" value={returnedDate} onChange={(e) => setReturnedDate(e.target.value)} />
              </div>
            </div>
            {Number(item.deposit_amount) > 0 && (
              <label className="flex items-center gap-2">
                <Checkbox checked={depositReturned} onCheckedChange={(c) => setDepositReturned(Boolean(c))} />
                Our ${Number(item.deposit_amount).toFixed(2)} deposit was refunded
              </label>
            )}
          </section>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm return
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
