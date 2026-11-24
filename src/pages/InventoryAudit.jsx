import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ClipboardList, ScanLine, Camera, CheckCircle2, XCircle, MapPin, HelpCircle, Loader2, Download, Play,
  Flag, RotateCcw, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BorrowedItem, InventoryAudit as AuditEntity, InventoryItem, User } from '@/api/entities';
import { logActivity } from '@/api/activity';
import { useData } from '../components/shared/DataManager';
import BackButton from '../components/shared/BackButton';
import ContinuousScanner from '../components/shared/ContinuousScanner';
import { findBorrowedByCode, findItemByCode } from '@/lib/itemCodes';
import { createPageUrl } from '@/utils';

// A count in progress is kept on this device, so leaving the page (or the
// phone going to sleep) does not lose what was scanned.
const SESSION_KEY = 'theatre-inventory-count-v1';
const ALL = '__all__';
const NOT_COUNTED = ['retired', 'rented'];

const loadSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};
const saveSession = (session) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* the count still works, it just is not kept */
  }
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function downloadCsv(name, rows) {
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Keys keep inventory items and borrowed items apart in one list.
const itemKey = (item) => `item:${item.id}`;
const loanKey = (loan) => `loan:${loan.id}`;

function Section({ title, icon: Icon, tone, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-base-200/50 border-base-300">
      <button type="button" className="w-full text-left" onClick={() => setOpen((o) => !o)}>
        <CardHeader className="py-3">
          <CardTitle className={`text-base flex items-center gap-2 ${tone}`}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Icon className="w-4 h-4" /> {title} ({count})
          </CardTitle>
        </CardHeader>
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function InventoryAudit() {
  const navigate = useNavigate();
  const { items, borrowedItems, locations, containers } = useData();
  const [session, setSession] = useState(loadSession);
  const [setup, setSetup] = useState({ location: '', container: ALL });
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [moveMisplaced, setMoveMisplaced] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => saveSession(session), [session]);

  useEffect(() => {
    AuditEntity.list('-created_date', 20).then(setHistory).catch(() => setHistory([]));
  }, [done]);

  const containerById = useMemo(() => new Map((containers || []).map((c) => [c.id, c])), [containers]);

  // ------------------------------------------------------------- the count
  const scope = session?.scope;
  const inScope = (location, containerId) => {
    if (!scope) return false;
    if (scope.container && scope.container !== ALL) return containerId === scope.container;
    const containerLocation = containerById.get(containerId)?.location;
    return location === scope.location || (!location && containerLocation === scope.location);
  };

  const expected = useMemo(() => {
    if (!scope) return [];
    const own = (items || [])
      .filter((i) => !NOT_COUNTED.includes(i.status) && inScope(i.location, i.container_id))
      .map((i) => ({ key: itemKey(i), kind: 'item', record: i, name: i.name, code: i.uid }));
    const loans = (borrowedItems || [])
      .filter((l) => l.status !== 'returned' && inScope(l.storage_location, l.container_id))
      .map((l) => ({ key: loanKey(l), kind: 'loan', record: l, name: l.name, code: l.tag_number }));
    return [...own, ...loans].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, items, borrowedItems, containerById]);

  const foundKeys = new Set(session?.found?.map((f) => f.key) || []);
  const expectedKeys = new Set(expected.map((e) => e.key));
  const found = expected.filter((e) => foundKeys.has(e.key));
  const missing = expected.filter((e) => !foundKeys.has(e.key));
  const misplaced = (session?.found || []).filter((f) => !expectedKeys.has(f.key));
  const unknown = session?.unknown || [];
  const outOnRental = scope ? (items || []).filter((i) => i.status === 'rented' && inScope(i.location, i.container_id)) : [];

  const start = () => {
    if (!setup.location) return;
    const containerName = setup.container !== ALL ? containerById.get(setup.container)?.name : '';
    setSession({
      scope: { location: setup.location, container: setup.container },
      label: [setup.location, containerName].filter(Boolean).join(' › '),
      startedAt: new Date().toISOString(),
      found: [],
      unknown: [],
    });
    setDone(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const record = (text) => {
    const raw = String(text || '').trim();
    if (!raw || !session) return;
    const item = findItemByCode(raw, items || []);
    const loan = item ? null : findBorrowedByCode(raw, borrowedItems || []);
    if (!item && !loan) {
      const isPlace = (containers || []).some((c) => c.qr_code === raw) || (locations || []).some((l) => l.qr_code === raw);
      if (isPlace) {
        setLastResult({ ok: false, text: 'That is a location or container label, not an item.' });
        return;
      }
      setSession((s) => ({ ...s, unknown: s.unknown.includes(raw) ? s.unknown : [...s.unknown, raw] }));
      setLastResult({ ok: false, text: `Not recognized: ${raw}` });
      return;
    }
    const entry = item
      ? { key: itemKey(item), kind: 'item', id: item.id, name: item.name, code: item.uid, recorded: [item.location, containerById.get(item.container_id)?.name].filter(Boolean).join(' › ') }
      : { key: loanKey(loan), kind: 'loan', id: loan.id, name: loan.name, code: loan.tag_number, recorded: [loan.storage_location, containerById.get(loan.container_id)?.name].filter(Boolean).join(' › ') };
    if (foundKeys.has(entry.key)) {
      setLastResult({ ok: true, text: `Already counted: ${entry.name}` });
      return;
    }
    setSession((s) => ({ ...s, found: [...s.found, { ...entry, at: new Date().toISOString() }] }));
    setLastResult(
      expectedKeys.has(entry.key)
        ? { ok: true, text: `✓ ${entry.name}` }
        : { ok: false, text: `${entry.name} — recorded in ${entry.recorded || 'no location'}` }
    );
  };

  const submitCode = (e) => {
    e.preventDefault();
    record(code);
    setCode('');
    inputRef.current?.focus();
  };

  const markFound = (entry, value) => {
    setSession((s) => ({
      ...s,
      found: value
        ? [...s.found, { key: entry.key, kind: entry.kind, id: entry.record.id, name: entry.name, code: entry.code, manual: true, at: new Date().toISOString() }]
        : s.found.filter((f) => f.key !== entry.key),
    }));
  };

  const cancelCount = () => {
    if (window.confirm('Discard this count? Nothing has been saved yet.')) setSession(null);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const me = await User.me().catch(() => null);
      const who = me?.full_name || me?.email || '';
      const now = new Date().toISOString();
      const targetContainer = scope.container !== ALL ? scope.container : null;

      // Everything seen gets a "last counted" stamp.
      for (const entry of found) {
        if (entry.kind === 'item') {
          await InventoryItem.update(entry.record.id, { last_audited_at: now, last_audited_location: session.label }, {
            activity: { action: 'audited', summary: `Counted in ${session.label}` },
          });
        }
      }
      // Items found in the wrong place are moved here, if chosen.
      for (const entry of misplaced) {
        if (entry.kind === 'item') {
          const patch = { last_audited_at: now, last_audited_location: session.label };
          if (moveMisplaced) {
            patch.location = scope.location;
            if (targetContainer) patch.container_id = targetContainer;
          }
          await InventoryItem.update(entry.id, patch, {
            activity: {
              action: moveMisplaced ? 'moved' : 'audited',
              summary: moveMisplaced
                ? `Found in ${session.label} during a count (was recorded in ${entry.recorded || 'no location'}); location corrected`
                : `Found in ${session.label} during a count, but recorded in ${entry.recorded || 'no location'}`,
            },
          });
        } else if (moveMisplaced) {
          await BorrowedItem.update(entry.id, { storage_location: scope.location, ...(targetContainer ? { container_id: targetContainer } : {}) }, {
            activity: { action: 'moved', summary: `Found in ${session.label} during a count; storage corrected` },
          });
        }
      }

      const audit = await AuditEntity.create({
        location: scope.location,
        container_id: targetContainer,
        scope_label: session.label,
        status: 'completed',
        started_at: session.startedAt,
        completed_at: now,
        performed_by: who,
        expected_count: expected.length,
        found_count: found.length,
        missing_count: missing.length,
        misplaced_count: misplaced.length,
        unknown_count: unknown.length,
        found_ids: found.map((f) => f.record.id),
        missing: missing.map((m) => ({ id: m.record.id, name: m.name, uid: m.code || '', kind: m.kind })),
        misplaced: misplaced.map((m) => ({ id: m.id, name: m.name, uid: m.code || '', recorded_location: m.recorded, moved: moveMisplaced })),
        unknown_codes: unknown,
        notes: notes.trim(),
      });
      await logActivity({
        entityType: 'InventoryAudit',
        record: { ...audit, name: `Count of ${session.label}` },
        action: 'audit_completed',
        summary: `${found.length} of ${expected.length} found · ${missing.length} missing · ${misplaced.length} in the wrong place${unknown.length ? ` · ${unknown.length} unknown codes` : ''}`,
        notes: notes.trim(),
      });
      setDone(audit);
      setSession(null);
      setFinishing(false);
      setNotes('');
    } catch (err) {
      console.error(err);
      window.alert('The count could not be saved. Your scans are kept on this device; please try again.');
    } finally {
      setSaving(false);
    }
  };

  const exportAudit = (audit) => {
    const rows = [['Result', 'Name', 'ID / Tag', 'Recorded location']];
    (audit.missing || []).forEach((m) => rows.push(['Missing', m.name, m.uid, audit.scope_label]));
    (audit.misplaced || []).forEach((m) => rows.push([m.moved ? 'Wrong place (moved here)' : 'Wrong place', m.name, m.uid, m.recorded_location]));
    (audit.unknown_codes || []).forEach((c) => rows.push(['Unknown code', '', c, '']));
    rows.push(['Found', `${audit.found_count} of ${audit.expected_count}`, '', '']);
    downloadCsv(`count-${String(audit.scope_label || 'location').replace(/[^\w-]+/g, '-')}-${String(audit.completed_at || '').slice(0, 10)}.csv`, rows);
  };

  const openEntry = (kind, id) =>
    navigate(createPageUrl(kind === 'loan' ? `BorrowedItemDetails?id=${id}` : `ItemDetails?id=${id}`));

  // --------------------------------------------------------------- views
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <BackButton className="mb-4" />
        <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-primary" /> Inventory Count
        </h1>
        <p className="text-primary font-medium mb-6">
          Count one location at a time: scan every label you find, then see what is missing and what is in the wrong place.
        </p>

        {done && (
          <Alert className="mb-6 bg-success/10 border-success/50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                Count of {done.scope_label} saved: {done.found_count} of {done.expected_count} found, {done.missing_count} missing, {done.misplaced_count} in the wrong place.
              </span>
              <Button size="sm" variant="outline" onClick={() => exportAudit(done)}><Download className="w-4 h-4 mr-2" /> Report</Button>
            </AlertDescription>
          </Alert>
        )}

        {!session ? (
          <>
            <Card className="bg-base-200/50 border-base-300 mb-8">
              <CardHeader><CardTitle>Start a count</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Location</Label>
                    <Select value={setup.location} onValueChange={(v) => setSetup({ location: v, container: ALL })}>
                      <SelectTrigger><SelectValue placeholder="Choose where you are counting" /></SelectTrigger>
                      <SelectContent>
                        {(locations || []).map((l) => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Only one container (optional)</Label>
                    <Select value={setup.container} onValueChange={(v) => setSetup((s) => ({ ...s, container: v }))} disabled={!setup.location}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Whole location</SelectItem>
                        {(containers || [])
                          .filter((c) => !c.location || c.location === setup.location)
                          .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={start} disabled={!setup.location}>
                  <Play className="w-4 h-4 mr-2" /> Start counting
                </Button>
                <p className="text-xs text-base-content/60">
                  Tip: count a different area each week so the whole stock is checked a few times a year, and count high-value items more often.
                </p>
              </CardContent>
            </Card>

            <h2 className="text-xl font-semibold mb-3">Recent counts</h2>
            {history.length === 0 ? (
              <p className="text-base-content/60 text-sm">No counts yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((a) => (
                  <Card key={a.id} className="bg-base-200/50 border-base-300">
                    <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                      <div>
                        <p className="font-semibold">{a.scope_label}</p>
                        <p className="text-base-content/70">
                          {a.completed_at ? format(new Date(a.completed_at), 'MMM d, yyyy h:mm a') : ''}{a.performed_by ? ` · ${a.performed_by}` : ''}
                        </p>
                        <p>
                          <span className="text-success">{a.found_count}/{a.expected_count} found</span>
                          {a.missing_count ? <span className="text-error"> · {a.missing_count} missing</span> : null}
                          {a.misplaced_count ? <span className="text-warning"> · {a.misplaced_count} wrong place</span> : null}
                        </p>
                        {a.missing?.length > 0 && (
                          <p className="text-xs text-base-content/70">Missing: {a.missing.map((m) => m.name).join(', ')}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => exportAudit(a)}><Download className="w-4 h-4 mr-2" /> Report</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <Card className="bg-base-200/50 border-base-300">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-base-content/60">Counting</p>
                    <p className="text-lg font-semibold flex items-center gap-1"><MapPin className="w-4 h-4" /> {session.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{found.length}<span className="text-base text-base-content/60"> / {expected.length}</span></p>
                    <p className="text-xs text-base-content/60">expected items found</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-base-300">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${expected.length ? (found.length / expected.length) * 100 : 0}%` }} />
                </div>
                <form onSubmit={submitCode} className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
                    <Input
                      ref={inputRef}
                      autoFocus
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="pl-9"
                      placeholder="Scan with a handheld scanner, or type a UID / tag number"
                      aria-label="Scanned code"
                    />
                  </div>
                  <Button type="submit" variant="outline">Add</Button>
                  <Button type="button" onClick={() => setCamera((c) => !c)}>
                    <Camera className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Camera</span>
                  </Button>
                </form>
                {camera && <ContinuousScanner onCode={record} onClose={() => setCamera(false)} lastResult={lastResult} />}
                {!camera && lastResult && (
                  <p className={`text-sm ${lastResult.ok ? 'text-success' : 'text-warning'}`}>{lastResult.text}</p>
                )}
                {outOnRental.length > 0 && (
                  <p className="text-xs text-base-content/60">{outOnRental.length} item{outOnRental.length === 1 ? ' is' : 's are'} out on rental and not expected here.</p>
                )}
              </CardContent>
            </Card>

            <Section title="Not found yet" icon={XCircle} tone="text-error" count={missing.length}>
              {missing.length === 0 ? (
                <p className="text-sm text-success">Everything expected here has been found.</p>
              ) : (
                <ul className="divide-y divide-base-300 text-sm">
                  {missing.map((e) => (
                    <li key={e.key} className="flex items-center gap-3 py-2">
                      <Checkbox onCheckedChange={(c) => c && markFound(e, true)} aria-label={`Mark ${e.name} as found`} />
                      <button type="button" className="flex-1 text-left min-w-0" onClick={() => openEntry(e.kind, e.record.id)}>
                        <span className="block truncate">{e.name}{e.kind === 'loan' ? ' (borrowed)' : ''}</span>
                        <span className="block font-mono text-xs text-base-content/60">{e.code || 'no label code'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-base-content/60 mt-2">Tick an item to count it by hand (for example if its label is missing — then print it a new one).</p>
            </Section>

            <Section title="In the wrong place" icon={Flag} tone="text-warning" count={misplaced.length}>
              {misplaced.length === 0 ? (
                <p className="text-sm text-base-content/60">Nothing yet.</p>
              ) : (
                <ul className="divide-y divide-base-300 text-sm">
                  {misplaced.map((f) => (
                    <li key={f.key} className="py-2 flex justify-between gap-2">
                      <button type="button" className="text-left min-w-0" onClick={() => openEntry(f.kind, f.id)}>
                        <span className="block truncate">{f.name}{f.kind === 'loan' ? ' (borrowed)' : ''}</span>
                        <span className="block text-xs text-base-content/60">Recorded in {f.recorded || 'no location'}</span>
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => setSession((s) => ({ ...s, found: s.found.filter((x) => x.key !== f.key) }))}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Found" icon={CheckCircle2} tone="text-success" count={found.length} defaultOpen={false}>
              <ul className="divide-y divide-base-300 text-sm">
                {found.map((e) => (
                  <li key={e.key} className="py-2 flex justify-between gap-2">
                    <span className="truncate">{e.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => markFound(e, false)}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Undo</Button>
                  </li>
                ))}
              </ul>
            </Section>

            {unknown.length > 0 && (
              <Section title="Codes not recognized" icon={HelpCircle} tone="text-base-content" count={unknown.length}>
                <ul className="text-sm space-y-1">
                  {unknown.map((c) => (
                    <li key={c} className="flex justify-between gap-2">
                      <span className="font-mono break-all">{c}</span>
                      <Button size="sm" variant="ghost" onClick={() => setSession((s) => ({ ...s, unknown: s.unknown.filter((x) => x !== c) }))}>Remove</Button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-base-content/60 mt-2">These may be items that were never entered. Add them to the inventory after the count.</p>
              </Section>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={cancelCount}>Discard count</Button>
              <Button size="lg" onClick={() => setFinishing(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Finish count
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={finishing} onOpenChange={setFinishing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish the count of {session?.label}?</DialogTitle>
            <DialogDescription>
              {found.length} of {expected.length} found · {missing.length} missing · {misplaced.length} in the wrong place
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {missing.length > 0 && (
              <p className="text-error">Missing items stay where they are recorded. Look for them, and check the activity log for their last move.</p>
            )}
            {misplaced.length > 0 && (
              <label className="flex items-start gap-2">
                <Checkbox checked={moveMisplaced} onCheckedChange={(c) => setMoveMisplaced(Boolean(c))} className="mt-0.5" />
                Record the {misplaced.length} item{misplaced.length === 1 ? '' : 's'} found here as now stored in {session?.label}
              </label>
            )}
            <div className="space-y-1">
              <Label htmlFor="count-notes">Notes</Label>
              <Textarea id="count-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth knowing next time" />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild><Button variant="outline">Keep counting</Button></DialogClose>
              <Button onClick={finish} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save count
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
