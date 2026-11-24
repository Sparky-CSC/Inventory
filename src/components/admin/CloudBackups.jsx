import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CloudUpload, Plus, Loader2, RefreshCw, Trash2, ExternalLink, CheckCircle, AlertTriangle, Copy, KeyRound,
  Clock, PlugZap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IS_LOCAL_MODE } from '@/api/config';
import { getSupabase } from '@/api/backends/supabase';
import { getAppBaseUrl } from '@/utils';

const cardClass = 'bg-base-200/50 backdrop-blur-sm shadow-md';
const SETUP_GUIDE = 'https://github.com/Sparky-CSC/Inventory/blob/main/docs/CLOUD-BACKUP-SETUP.md';

// The nightly run is stored as a UTC hour; people pick a local hour.
const utcOffsetHours = () => -new Date().getTimezoneOffset() / 60;
const toLocalHour = (utc) => (((utc + utcOffsetHours()) % 24) + 24) % 24;
const toUtcHour = (local) => (((local - utcOffsetHours()) % 24) + 24) % 24;
const hourLabel = (h) => format(new Date(2000, 0, 1, Math.floor(h), Math.round((h % 1) * 60) + 17), 'h:mm a');

async function rpc(name, args) {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function callBackupService(body) {
  const { data, error } = await getSupabase().functions.invoke('drive-backup', { body });
  if (error) {
    // The service's own message is more useful than "non-2xx status".
    let message = error.message;
    try {
      const detail = await error.context?.json?.();
      if (detail?.message) message = detail.message;
    } catch {
      /* keep the general message */
    }
    throw new Error(message);
  }
  return data;
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ dest }) {
  if (!dest.enabled) return <Badge variant="outline">Paused</Badge>;
  if (dest.status === 'needs_reconnect')
    return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/40">Reconnect needed</Badge>;
  if (dest.status === 'error') return <Badge variant="outline" className="bg-error/10 text-error border-error/40">Last backup failed</Badge>;
  if (!dest.last_backup_at) return <Badge variant="outline" className="bg-info/10 text-info border-info/40">No backup yet</Badge>;
  const ageHours = (Date.now() - new Date(dest.last_backup_at).getTime()) / 3600000;
  return ageHours > 36 ? (
    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/40">Out of date</Badge>
  ) : (
    <Badge variant="outline" className="bg-success/10 text-success border-success/40">Up to date</Badge>
  );
}

function Destination({ dest, onChanged, onReconnect }) {
  const [label, setLabel] = useState(dest.label);
  const [keep, setKeep] = useState(dest.keep_count);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);

  const save = async (patch) => {
    setBusy('save');
    try {
      await rpc('backup_update_destination', {
        p_id: dest.id,
        p_label: patch.label ?? label,
        p_keep_count: patch.keep_count ?? Number(keep),
        p_include_photos: patch.include_photos ?? dest.include_photos,
        p_enabled: patch.enabled ?? dest.enabled,
      });
      await onChanged();
    } finally {
      setBusy('');
    }
  };

  const runNow = async () => {
    setBusy('run');
    setResult(null);
    try {
      const outcome = await callBackupService({ action: 'run', destination_id: dest.id });
      setResult(outcome);
    } catch (error) {
      setResult({ ok: false, message: error.message });
    } finally {
      setBusy('');
      onChanged();
    }
  };

  const remove = async () => {
    if (!window.confirm(`Stop backing up to “${dest.label}”? Backups already in that Google Drive stay there.`)) return;
    setBusy('remove');
    try {
      await rpc('backup_delete_destination', { p_id: dest.id });
      await onChanged();
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-base-content">{dest.label}</h4>
            <StatusBadge dest={dest} />
          </div>
          <p className="text-sm text-base-content/70">{dest.account_email || 'Google account'}</p>
          <p className="text-xs text-base-content/60">
            {dest.last_backup_at
              ? `Last backup ${formatDistanceToNow(new Date(dest.last_backup_at), { addSuffix: true })} (${format(new Date(dest.last_backup_at), 'MMM d, h:mm a')})`
              : 'No backup yet'}
            {dest.include_photos ? ` · ${dest.photos_copied} photos copied` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dest.folder_id && (
            <Button asChild variant="outline" size="sm">
              <a href={`https://drive.google.com/drive/folders/${dest.folder_id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" /> Open folder
              </a>
            </Button>
          )}
          <Button size="sm" onClick={runNow} disabled={Boolean(busy) || !dest.connected}>
            {busy === 'run' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-1" />}
            {busy === 'run' ? 'Backing up…' : 'Back up now'}
          </Button>
        </div>
      </div>

      {(dest.status === 'needs_reconnect' || dest.status === 'error') && dest.last_error && (
        <Alert variant={dest.status === 'error' ? 'destructive' : 'default'} className={dest.status === 'needs_reconnect' ? 'bg-warning/10 border-warning/50' : ''}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-sm break-words">{dest.last_error}</span>
            {dest.status === 'needs_reconnect' && (
              <Button size="sm" variant="outline" onClick={() => onReconnect(dest)}><PlugZap className="w-4 h-4 mr-1" /> Reconnect</Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {result && (
        <p className={`text-sm ${result.ok ? 'text-success' : 'text-error'}`}>
          {result.ok ? `Backed up: ${result.message}` : `Backup failed: ${result.message}`}
        </p>
      )}

      <div className="grid sm:grid-cols-[1fr_140px] gap-3">
        <div className="space-y-1">
          <Label htmlFor={`label-${dest.id}`} className="text-xs">Name</Label>
          <Input id={`label-${dest.id}`} value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== dest.label && save({ label })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`keep-${dest.id}`} className="text-xs">Backups to keep</Label>
          <Input
            id={`keep-${dest.id}`}
            type="number"
            min="1"
            max="365"
            value={keep}
            onChange={(e) => setKeep(e.target.value)}
            onBlur={() => Number(keep) !== dest.keep_count && save({ keep_count: Number(keep) })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <Switch checked={dest.include_photos} onCheckedChange={(v) => save({ include_photos: v })} disabled={Boolean(busy)} />
          Copy photos too
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={dest.enabled} onCheckedChange={(v) => save({ enabled: v })} disabled={Boolean(busy)} />
          Nightly backup on
        </label>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="ghost" onClick={() => onReconnect(dest)} disabled={Boolean(busy)}>
            <RefreshCw className="w-4 h-4 mr-1" /> Reconnect
          </Button>
          <Button size="sm" variant="ghost" className="text-error" onClick={remove} disabled={Boolean(busy)}>
            <Trash2 className="w-4 h-4 mr-1" /> Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Administration → Data & Backup → Cloud backups.
 * Automatic nightly backups to one or more Google Drives.
 */
export default function CloudBackups() {
  const location = useLocation();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [editingGoogle, setEditingGoogle] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState('');
  const [runningAll, setRunningAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await rpc('backup_overview');
      setOverview(data);
      setClientId((prev) => prev || data.client_id || '');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    if (!IS_LOCAL_MODE) load();
  }, [load]);

  // Coming back from Google.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const outcome = params.get('backup');
    if (!outcome) return;
    if (outcome === 'connected') {
      setNotice({ ok: true, text: `Connected ${params.get('email') || 'Google Drive'}. Run a first backup now to check it works.` });
    } else {
      setNotice({ ok: false, text: params.get('message') || 'Google Drive could not be connected.' });
    }
    navigate(location.pathname, { replace: true });
    load();
  }, [location.search, location.pathname, navigate, load]);

  if (IS_LOCAL_MODE) {
    return (
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CloudUpload className="w-5 h-5 text-primary" /> Cloud backups</CardTitle>
          <CardDescription>
            Automatic backups to Google Drive need shared mode (Supabase). In this-device mode, use “Download backup” below
            and keep the file somewhere safe.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const saveGoogle = async (e) => {
    e.preventDefault();
    setBusy('google');
    try {
      await rpc('backup_save_google', { p_client_id: clientId, p_client_secret: clientSecret });
      setClientSecret('');
      setEditingGoogle(false);
      await load();
    } catch (error) {
      setNotice({ ok: false, text: error.message });
    } finally {
      setBusy('');
    }
  };

  const connect = async (dest) => {
    setBusy(dest ? `reconnect-${dest.id}` : 'connect');
    try {
      const { url } = await callBackupService({
        action: 'connect',
        label: dest ? dest.label : newLabel.trim() || `Google Drive ${(overview?.destinations?.length || 0) + 1}`,
        destination_id: dest?.id,
        app_url: getAppBaseUrl(),
      });
      window.location.href = url;
    } catch (error) {
      setNotice({ ok: false, text: error.message });
      setBusy('');
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    const targets = (overview?.destinations || []).filter((d) => d.connected && d.enabled);
    const outcomes = await Promise.all(
      targets.map((d) =>
        callBackupService({ action: 'run', destination_id: d.id })
          .then((r) => ({ label: d.label, ...r }))
          .catch((error) => ({ label: d.label, ok: false, message: error.message }))
      )
    );
    const failed = outcomes.filter((o) => !o.ok);
    setNotice(
      failed.length
        ? { ok: false, text: `Backup failed for ${failed.map((f) => `${f.label} (${f.message})`).join('; ')}` }
        : { ok: true, text: `Backed up to ${outcomes.length} location${outcomes.length === 1 ? '' : 's'}.` }
    );
    setRunningAll(false);
    load();
  };

  const setSchedule = async (localHour) => {
    try {
      await rpc('backup_set_schedule', { p_hour_utc: toUtcHour(Number(localHour)) });
      await load();
    } catch (error) {
      setNotice({ ok: false, text: error.message });
    }
  };

  const destinations = overview?.destinations || [];
  const runs = overview?.runs || [];
  const configured = overview?.configured;
  const localHour = overview ? toLocalHour(overview.schedule_hour_utc) : 2;
  const healthy = destinations.filter((d) => d.enabled && d.status === 'ok' && d.last_backup_at).length;

  return (
    <Card className={cardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CloudUpload className="w-5 h-5 text-primary" /> Cloud backups</CardTitle>
        <CardDescription>
          Every night a full copy of the inventory (and new photos) is saved into each Google Drive you connect. Use at least
          two different Google accounts, so one lost or locked account never takes every copy with it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>}
        {notice && (
          <Alert variant={notice.ok ? 'default' : 'destructive'} className={notice.ok ? 'bg-success/10 border-success/50' : ''}>
            {notice.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        )}
        {!overview && !loadError && (
          <p className="text-sm text-base-content/60 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        )}

        {overview && (!configured || editingGoogle) && (
          <form onSubmit={saveGoogle} className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-4">
            <div>
              <h4 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> Step 1 — Connect a Google app (once)</h4>
              <p className="text-sm text-base-content/70 mt-1">
                Google only lets apps it knows save into a Drive. Create a free “OAuth client” in Google Cloud (about 10 minutes,{' '}
                <a className="underline" href={SETUP_GUIDE} target="_blank" rel="noreferrer">step-by-step guide</a>), using these two values:
              </p>
            </div>
            <div className="grid gap-3">
              <CopyField label="Authorized JavaScript origin" value={new URL(getAppBaseUrl()).origin} />
              <CopyField label="Authorized redirect URI" value={overview.redirect_uri || ''} />
            </div>
            <p className="text-sm text-base-content/70">Then paste the Client ID and Client secret Google shows you:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="g-client-id">Client ID</Label>
                <Input id="g-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="g-client-secret">Client secret</Label>
                <Input
                  id="g-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={configured ? 'Leave empty to keep the saved secret' : 'GOCSPX-…'}
                  required={!configured}
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="text-xs text-base-content/60">The secret is stored in the database where no one can read it back, not even administrators.</p>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy === 'google'}>
                {busy === 'google' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
              </Button>
              {editingGoogle && <Button type="button" variant="ghost" onClick={() => setEditingGoogle(false)}>Cancel</Button>}
            </div>
          </form>
        )}

        {overview && configured && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-base-content/70">
                Google app: <span className="font-mono text-xs">{String(overview.client_id || '').slice(0, 18)}…</span>{' '}
                <button type="button" className="underline" onClick={() => setEditingGoogle(true)}>change</button>
              </p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-base-content/60" />
                <span>Every night at</span>
                <Select value={String(localHour)} onValueChange={setSchedule}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                      <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {destinations.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`text-sm font-medium ${healthy >= 2 ? 'text-success' : 'text-warning'}`}>
                  {healthy} of {destinations.length} location{destinations.length === 1 ? '' : 's'} up to date
                  {destinations.length < 2 ? ' — add a second Google account for safety' : ''}
                </p>
                <Button variant="outline" size="sm" onClick={runAll} disabled={runningAll}>
                  {runningAll ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-1" />}
                  Back up everywhere now
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {destinations.map((dest) => (
                <Destination key={dest.id} dest={dest} onChanged={load} onReconnect={connect} />
              ))}
            </div>

            <div className="rounded-xl border border-dashed border-base-300 p-4 space-y-2">
              <h4 className="font-semibold">{destinations.length ? 'Add another Google Drive' : 'Step 2 — Add a Google Drive'}</h4>
              <p className="text-sm text-base-content/70">
                You will be sent to Google to pick the account. The app can only see the files it creates there (a “Theatre
                Inventory Backups” folder), nothing else in that Drive.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={destinations.length ? 'Name, e.g. “Department Drive”' : 'Name, e.g. “Theatre office Drive”'}
                  className="sm:max-w-xs"
                />
                <Button onClick={() => connect(null)} disabled={busy === 'connect'}>
                  {busy === 'connect' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Connect Google Drive
                </Button>
              </div>
            </div>

            {runs.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Recent backups</h4>
                <div className="rounded-lg border border-base-300 divide-y divide-base-300 text-sm bg-base-100">
                  {runs.slice(0, 12).map((run) => (
                    <div key={run.id} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="flex items-center gap-2">
                        {run.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-success" />
                        ) : run.status === 'failed' ? (
                          <AlertTriangle className="w-4 h-4 text-error" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-base-content/60" />
                        )}
                        <span className="font-medium">{run.destination_label}</span>
                        <span className="text-base-content/60">{format(new Date(run.started_at), 'MMM d, h:mm a')} · {run.trigger === 'manual' ? 'manual' : 'nightly'}</span>
                      </span>
                      <span className={`text-xs ${run.status === 'failed' ? 'text-error' : 'text-base-content/70'} sm:text-right break-words`}>
                        {run.message || (run.status === 'running' ? 'Running…' : '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-base-content/60">
              To restore, download a backup file from any of these Drives and use “Restore from backup” below. Old backups beyond
              the number to keep go to that Drive’s trash, where Google keeps them for 30 more days.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
