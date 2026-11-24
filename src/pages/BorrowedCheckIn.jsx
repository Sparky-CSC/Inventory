import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCheck, Loader2, Plus, Printer, Trash2,
  AlertTriangle, PackageCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BorrowedItem, User } from '@/api/entities';
import { useData } from '../components/shared/DataManager';
import PhotoCapture from '../components/shared/PhotoCapture';
import BackButton from '../components/shared/BackButton';
import { checkInBorrowedItem, updateBorrowedItem, checkInPhotos } from '@/lib/borrowed';
import { nextLoanTag } from '@/lib/itemCodes';
import { createPageUrl } from '@/utils';

const CATEGORIES = ['costume', 'prop', 'scenery', 'equipment', 'fabric', 'accessory', 'lighting', 'sound', 'furniture'];
const CONDITIONS = [
  { value: 'excellent', label: 'Excellent — like new' },
  { value: 'good', label: 'Good — light normal wear' },
  { value: 'fair', label: 'Fair — visible wear' },
  { value: 'poor', label: 'Poor — damaged or fragile' },
  { value: 'needs_repair', label: 'Needs repair' },
];
const NONE = '__none__';

const STEPS = [
  { key: 'lender', title: 'Lender & loan' },
  { key: 'item', title: 'Item & pieces' },
  { key: 'photos', title: 'Photos' },
  { key: 'condition', title: 'Condition' },
  { key: 'storage', title: 'ID & storage' },
  { key: 'review', title: 'Review' },
];

const today = () => new Date().toISOString().split('T')[0];

const LENDER_FIELDS = [
  'lender_name', 'lender_email', 'lender_phone', 'lender_contact', 'show_production', 'due_date',
  'agreement_on_file', 'borrowed_date',
];

const EMPTY = {
  lender_name: '',
  lender_email: '',
  lender_phone: '',
  lender_contact: '',
  lender_reference: '',
  show_production: '',
  borrowed_date: today(),
  due_date: '',
  agreement_on_file: false,
  rental_fee: '',
  deposit_amount: '',
  replacement_value: '',
  name: '',
  category: 'prop',
  description: '',
  quantity: 1,
  pieces: [],
  care_instructions: '',
  photos: [],
  condition_borrowed: 'good',
  condition_notes_borrowed: '',
  lender_acknowledged_condition: false,
  storage_location: '',
  container_id: '',
  received_by: '',
  notes: '',
};

// Older records may hold null where the form expects text.
const withDefaults = (source) => {
  const out = { ...EMPTY, ...source };
  Object.entries(EMPTY).forEach(([key, fallback]) => {
    if (out[key] === null || out[key] === undefined) out[key] = fallback;
  });
  return out;
};

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');
const money = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

function Field({ label, htmlFor, hint, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-error"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-base-content/60">{hint}</p>}
    </div>
  );
}

export default function BorrowedCheckIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const editId = params.get('id');
  const sameLenderId = params.get('lender');
  const { borrowedItems, locations, containers } = useData();

  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [noDueDate, setNoDueDate] = useState(false);
  const [loading, setLoading] = useState(Boolean(editId || sameLenderId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState({});
  const [saved, setSaved] = useState(null);
  const isEditing = Boolean(editId);

  // Load the item being edited, or copy the lender from the previous check-in.
  useEffect(() => {
    let cancelled = false;
    const sourceId = editId || sameLenderId;
    (async () => {
      let me = '';
      try {
        const user = await User.me();
        me = user?.full_name || user?.email || '';
      } catch {
        /* signed-in name is only a convenience */
      }
      if (!sourceId) {
        if (!cancelled) setForm((prev) => ({ ...prev, received_by: prev.received_by || me }));
        return;
      }
      try {
        const source = await BorrowedItem.get(sourceId);
        if (cancelled) return;
        if (editId) {
          setForm({
            ...withDefaults(source),
            borrowed_date: dateOnly(source.borrowed_date),
            due_date: dateOnly(source.due_date),
            rental_fee: source.rental_fee ?? '',
            deposit_amount: source.deposit_amount ?? '',
            replacement_value: source.replacement_value ?? '',
            pieces: source.pieces || [],
            photos: source.photos || [],
            quantity: source.quantity || 1,
          });
          setNoDueDate(!source.due_date);
        } else {
          const copy = Object.fromEntries(LENDER_FIELDS.map((f) => [f, source[f] ?? EMPTY[f]]));
          setForm({ ...EMPTY, ...copy, borrowed_date: dateOnly(source.borrowed_date) || today(), due_date: dateOnly(source.due_date), received_by: me });
          setNoDueDate(!source.due_date);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('That borrowed item could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, sameLenderId]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onInput = (e) => set(e.target.name, e.target.value);

  const previewTag = useMemo(
    () => form.tag_number || nextLoanTag(borrowedItems || []),
    [form.tag_number, borrowedItems]
  );
  const containerName = (containers || []).find((c) => c.id === form.container_id)?.name;
  const photosIn = checkInPhotos(form);
  const damagePhotos = photosIn.filter((p) => p.shows_damage).length;
  const conditionNeedsNotes = ['fair', 'poor', 'needs_repair'].includes(form.condition_borrowed) || damagePhotos > 0;

  // What still has to be filled in on each step.
  const problems = useMemo(() => {
    const list = { lender: [], item: [], photos: [], condition: [], storage: [], review: [] };
    if (!form.lender_name.trim()) list.lender.push('Enter who the item is borrowed from.');
    if (!isEditing && !form.lender_email.trim() && !form.lender_phone.trim()) list.lender.push('Enter an email or phone number for the lender.');
    if (!form.borrowed_date) list.lender.push('Enter the date it arrived.');
    if (!form.due_date && !noDueDate) list.lender.push('Enter the return date, or tick “No set return date”.');
    if (form.due_date && form.borrowed_date && form.due_date < form.borrowed_date) list.lender.push('The return date is before the date it arrived.');
    if (!form.name.trim()) list.item.push('Give the item a name.');
    if (!(Number(form.quantity) >= 1)) list.item.push('Quantity must be at least 1.');
    if (form.pieces.some((p) => !String(p.name || '').trim())) list.item.push('Name every piece, or remove empty rows.');
    if (!isEditing && photosIn.length === 0) list.photos.push('Take at least one photo before the item goes into storage.');
    if (conditionNeedsNotes && !form.condition_notes_borrowed.trim()) list.condition.push('Describe the existing wear or damage.');
    return list;
  }, [form, noDueDate, isEditing, photosIn.length, conditionNeedsNotes]);

  const stepKey = STEPS[step].key;
  const allProblems = Object.values(problems).flat();

  const next = () => {
    setAttempted((prev) => ({ ...prev, [stepKey]: true }));
    if (problems[stepKey].length) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    document.querySelector('main')?.scrollTo?.({ top: 0 });
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const save = async () => {
    setAttempted(Object.fromEntries(STEPS.map((s) => [s.key, true])));
    const firstBad = STEPS.findIndex((s) => problems[s.key].length);
    if (firstBad >= 0) {
      setStep(firstBad);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        name: form.name.trim(),
        lender_name: form.lender_name.trim(),
        quantity: Number(form.quantity) || 1,
        due_date: noDueDate ? null : form.due_date,
        rental_fee: money(form.rental_fee),
        deposit_amount: money(form.deposit_amount),
        replacement_value: money(form.replacement_value),
        pieces: form.pieces.map((p) => ({ ...p, name: p.name.trim(), count: Number(p.count) || 1 })),
        container_id: form.container_id || null,
      };
      const record = isEditing ? await updateBorrowedItem(editId, data) : await checkInBorrowedItem(data);
      setSaved(record);
    } catch (err) {
      console.error('Check-in failed:', err);
      setError(err?.message || 'The item could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const printTag = (record) =>
    navigate(createPageUrl(`PrintHangTags?loans=${record.id}`), { state: { loans: [record] } });

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-base-content/70">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  // ------------------------------------------------------------------ done
  if (saved) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-base-content">{isEditing ? 'Changes saved' : 'Checked in'}</h1>
            <p className="text-base-content/70 mt-1">{saved.name} from {saved.lender_name}</p>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-primary/50 p-6 bg-base-200/50">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Temporary tag number</p>
            <p className="font-mono text-4xl font-bold text-primary mt-1">{saved.tag_number}</p>
            <p className="text-sm text-base-content/70 mt-2">
              Write or print this number on a tag and attach it to the item{saved.pieces?.length ? ' and each loose piece' : ''} before it goes into storage.
            </p>
          </div>
          <div className="grid gap-3">
            <Button size="lg" onClick={() => printTag(saved)}>
              <Printer className="w-4 h-4 mr-2" /> Print temporary tag
            </Button>
            {!isEditing && (
              <Button variant="outline" onClick={() => {
                setSaved(null);
                setStep(1);
                setAttempted({});
                setForm((prev) => ({
                  ...EMPTY,
                  ...Object.fromEntries(LENDER_FIELDS.map((f) => [f, prev[f]])),
                  received_by: prev.received_by,
                  storage_location: prev.storage_location,
                  container_id: prev.container_id,
                }));
              }}>
                <Plus className="w-4 h-4 mr-2" /> Check in another item from {saved.lender_name}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(createPageUrl(`BorrowedItemDetails?id=${saved.id}`), { replace: true })}>
              View this item
            </Button>
            <Button variant="ghost" onClick={() => navigate(createPageUrl('BorrowedItems'))}>
              Back to borrowed items
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showProblems = attempted[stepKey] && problems[stepKey].length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <BackButton className="mb-4" />
        <h1 className="text-3xl font-bold text-base-content flex items-center gap-3 mb-1">
          <ClipboardCheck className="w-8 h-8 text-primary" />
          {isEditing ? `Edit ${form.tag_number || 'borrowed item'}` : 'Check in a borrowed item'}
        </h1>
        <p className="text-primary font-medium mb-6">
          {isEditing
            ? 'Update the record. Every change is kept in the item’s history.'
            : 'Record it fully before it goes into storage: who it belongs to, every piece, photos and its condition today.'}
        </p>

        {/* Steps */}
        <ol className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const done = i < step || isEditing;
            const current = i === step;
            return (
              <li key={s.key} className="flex-1 min-w-[84px]">
                <button
                  type="button"
                  onClick={() => (isEditing || i < step) && setStep(i)}
                  className={`w-full text-left rounded-lg px-2 py-1.5 border text-xs ${
                    current
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : done
                        ? 'border-base-300 text-base-content/80'
                        : 'border-base-300 text-base-content/50'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide">Step {i + 1}</span>
                  <span className="flex items-center gap-1">
                    {done && !current && problems[s.key].length === 0 && <Check className="w-3 h-3 text-success" />}
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <Card className="bg-base-200/50 border-base-300">
          <CardContent className="p-4 sm:p-6 space-y-5">
            {stepKey === 'lender' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Borrowed from" htmlFor="lender_name" required>
                    <Input id="lender_name" name="lender_name" value={form.lender_name} onChange={onInput} placeholder="Person or organization" />
                  </Field>
                  <Field label="Lender’s reference / loan number" htmlFor="lender_reference" hint="Their ID, invoice or receipt number, if any.">
                    <Input id="lender_reference" name="lender_reference" value={form.lender_reference} onChange={onInput} />
                  </Field>
                  <Field label="Email" htmlFor="lender_email" hint="Used for return reminders.">
                    <Input id="lender_email" name="lender_email" type="email" value={form.lender_email} onChange={onInput} />
                  </Field>
                  <Field label="Phone" htmlFor="lender_phone">
                    <Input id="lender_phone" name="lender_phone" type="tel" value={form.lender_phone} onChange={onInput} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Address / other contact" htmlFor="lender_contact">
                      <Input id="lender_contact" name="lender_contact" value={form.lender_contact} onChange={onInput} />
                    </Field>
                  </div>
                  <Field label="For production / show" htmlFor="show_production">
                    <Input id="show_production" name="show_production" value={form.show_production} onChange={onInput} />
                  </Field>
                  <Field label="Date it arrived" htmlFor="borrowed_date" required>
                    <Input id="borrowed_date" name="borrowed_date" type="date" value={form.borrowed_date} onChange={onInput} />
                  </Field>
                  <Field label="Must be returned by" htmlFor="due_date" required={!noDueDate}>
                    <Input id="due_date" name="due_date" type="date" value={noDueDate ? '' : form.due_date} onChange={onInput} disabled={noDueDate} />
                    <label className="flex items-center gap-2 text-xs text-base-content/70 mt-1">
                      <Checkbox checked={noDueDate} onCheckedChange={(c) => setNoDueDate(Boolean(c))} /> No set return date
                    </label>
                  </Field>
                  <Field label="Replacement value ($)" htmlFor="replacement_value" hint="What the lender would charge if it were lost.">
                    <Input id="replacement_value" name="replacement_value" type="number" min="0" step="0.01" value={form.replacement_value} onChange={onInput} />
                  </Field>
                  <Field label="Rental fee ($)" htmlFor="rental_fee">
                    <Input id="rental_fee" name="rental_fee" type="number" min="0" step="0.01" value={form.rental_fee} onChange={onInput} />
                  </Field>
                  <Field label="Deposit paid ($)" htmlFor="deposit_amount">
                    <Input id="deposit_amount" name="deposit_amount" type="number" min="0" step="0.01" value={form.deposit_amount} onChange={onInput} />
                  </Field>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={form.agreement_on_file} onCheckedChange={(c) => set('agreement_on_file', Boolean(c))} className="mt-0.5" />
                  <span>
                    A signed loan agreement or receipt is on file
                    <span className="block text-xs text-base-content/60">It should list the items, return date, replacement value and who is responsible.</span>
                  </span>
                </label>
              </>
            )}

            {stepKey === 'item' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Field label="Item name" htmlFor="name" required>
                      <Input id="name" name="name" value={form.name} onChange={onInput} placeholder="e.g. Black velvet frock coat" />
                    </Field>
                  </div>
                  <Field label="Category">
                    <Select value={form.category} onValueChange={(v) => set('category', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Quantity" htmlFor="quantity" hint="Identical items borrowed together.">
                    <Input id="quantity" name="quantity" type="number" min="1" value={form.quantity} onChange={onInput} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Description" htmlFor="description" hint="Color, size, maker, distinguishing marks.">
                      <Textarea id="description" name="description" rows={3} value={form.description} onChange={onInput} />
                    </Field>
                  </div>
                </div>

                <div className="rounded-lg border border-base-300 bg-base-100 p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold">Pieces</h3>
                    <p className="text-xs text-base-content/60">
                      List every separate piece that must go back (jacket, vest, belt, 2 cufflinks…). They are checked off one by one at return.
                    </p>
                  </div>
                  {form.pieces.map((piece, i) => (
                    <div key={i} className="grid grid-cols-[1fr_70px_auto] gap-2 items-start">
                      <Input
                        value={piece.name}
                        placeholder="Piece"
                        aria-label={`Piece ${i + 1} name`}
                        onChange={(e) => set('pieces', form.pieces.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
                      />
                      <Input
                        type="number"
                        min="1"
                        value={piece.count}
                        aria-label={`Piece ${i + 1} count`}
                        onChange={(e) => set('pieces', form.pieces.map((p, j) => (j === i ? { ...p, count: e.target.value } : p)))}
                      />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove piece" onClick={() => set('pieces', form.pieces.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4 text-error" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => set('pieces', [...form.pieces, { name: '', count: 1, returned: false }])}>
                    <Plus className="w-4 h-4 mr-1" /> Add piece
                  </Button>
                </div>

                <Field label="Care & handling instructions" htmlFor="care_instructions" hint="Cleaning limits, “no alterations”, “do not fly”, “keep away from food”…">
                  <Textarea id="care_instructions" name="care_instructions" rows={2} value={form.care_instructions} onChange={onInput} />
                </Field>
              </>
            )}

            {stepKey === 'photos' && (
              <>
                <p className="text-sm text-base-content/80">
                  Photograph the item as it arrived. These photos are your record of its condition when it is returned.
                </p>
                <PhotoCapture
                  photos={form.photos}
                  onChange={(photos) => set('photos', photos)}
                  stage="check_in"
                  legacyStage="check_in"
                  suggestions={['Front', 'Back', 'Labels / maker’s marks', 'Every piece together', 'Close-up of any damage']}
                />
              </>
            )}

            {stepKey === 'condition' && (
              <>
                <Field label="Condition when it arrived" required>
                  <Select value={form.condition_borrowed} onValueChange={(v) => set('condition_borrowed', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Existing wear or damage"
                  htmlFor="condition_notes_borrowed"
                  required={conditionNeedsNotes}
                  hint={damagePhotos ? `${damagePhotos} photo${damagePhotos === 1 ? ' is' : 's are'} marked as showing damage.` : 'Stains, tears, missing buttons, scratches, loose parts — anything already there.'}
                >
                  <Textarea id="condition_notes_borrowed" name="condition_notes_borrowed" rows={4} value={form.condition_notes_borrowed} onChange={onInput} />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={form.lender_acknowledged_condition} onCheckedChange={(c) => set('lender_acknowledged_condition', Boolean(c))} className="mt-0.5" />
                  <span>
                    The lender saw and agreed with this condition
                    <span className="block text-xs text-base-content/60">Agreeing on condition at hand-over prevents disputes at return.</span>
                  </span>
                </label>
              </>
            )}

            {stepKey === 'storage' && (
              <>
                <div className="rounded-xl border-2 border-dashed border-primary/50 p-4 text-center bg-base-100">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">Temporary tag number</p>
                  <p className="font-mono text-3xl font-bold text-primary">{previewTag}</p>
                  <p className="text-xs text-base-content/60 mt-1">
                    {form.tag_number ? 'Assigned to this item.' : 'Assigned when you save. Print the tag on the next screen.'}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Stored in" hint="Keep borrowed items apart from our own stock where possible.">
                    <Select value={form.storage_location || NONE} onValueChange={(v) => set('storage_location', v === NONE ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Choose a location" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not stored yet</SelectItem>
                        {(locations || []).map((l) => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Container (optional)">
                    <Select value={form.container_id || NONE} onValueChange={(v) => set('container_id', v === NONE ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {(containers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Received by" htmlFor="received_by">
                    <Input id="received_by" name="received_by" value={form.received_by} onChange={onInput} />
                  </Field>
                </div>
                <Field label="Other notes" htmlFor="notes">
                  <Textarea id="notes" name="notes" rows={3} value={form.notes} onChange={onInput} />
                </Field>
              </>
            )}

            {stepKey === 'review' && (
              <div className="space-y-4 text-sm">
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  <p><span className="text-base-content/60">Item:</span> <strong>{form.name || '—'}</strong>{Number(form.quantity) > 1 ? ` × ${form.quantity}` : ''}</p>
                  <p><span className="text-base-content/60">Tag:</span> <span className="font-mono font-semibold">{previewTag}</span></p>
                  <p><span className="text-base-content/60">From:</span> {form.lender_name || '—'}</p>
                  <p><span className="text-base-content/60">Return by:</span> {noDueDate ? 'No set date' : form.due_date || '—'}</p>
                  <p><span className="text-base-content/60">Condition:</span> <span className="capitalize">{form.condition_borrowed.replace('_', ' ')}</span></p>
                  <p><span className="text-base-content/60">Stored in:</span> {[form.storage_location, containerName].filter(Boolean).join(' · ') || 'Not set'}</p>
                  <p><span className="text-base-content/60">Pieces:</span> {form.pieces.length ? form.pieces.map((p) => `${p.name}${Number(p.count) > 1 ? ` ×${p.count}` : ''}`).join(', ') : 'One piece'}</p>
                  <p><span className="text-base-content/60">Photos:</span> {photosIn.length}</p>
                </div>
                {photosIn.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {photosIn.map((p, i) => (
                      <img key={i} src={p.url} alt={p.caption || ''} className={`h-20 w-20 object-cover rounded border ${p.shows_damage ? 'border-error' : 'border-base-300'}`} />
                    ))}
                  </div>
                )}
                <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                  <p className="font-semibold mb-2">Good-practice checklist</p>
                  <ul className="space-y-1">
                    {[
                      [form.agreement_on_file, 'Loan agreement / receipt on file'],
                      [form.lender_acknowledged_condition, 'Lender agreed with the condition'],
                      [photosIn.length >= 3, 'At least 3 photos (front, back, details)'],
                      [Boolean(form.replacement_value), 'Replacement value recorded'],
                      [Boolean(form.storage_location), 'Storage location chosen'],
                      [Boolean(form.due_date) || noDueDate, 'Return date set'],
                    ].map(([ok, text]) => (
                      <li key={text} className={`flex items-center gap-2 ${ok ? 'text-success' : 'text-warning'}`}>
                        {ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        <span className={ok ? '' : 'text-base-content/80'}>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {allProblems.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Still needed: {allProblems.join(' ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {showProblems && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc pl-4">{problems[stepKey].map((p) => <li key={p}>{p}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-3 mt-4">
          <Button variant="outline" onClick={step === 0 ? () => navigate(-1) : back} disabled={saving}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <div className="flex gap-2">
            {isEditing && stepKey !== 'review' && (
              <Button variant="outline" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save changes
              </Button>
            )}
            {stepKey === 'review' ? (
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-2" />}
                {isEditing ? 'Save changes' : 'Check in'}
              </Button>
            ) : (
              <Button onClick={next}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
