// Cloud backups to Google Drive.
//
//   POST { action: "connect", label, destination_id?, app_url }   (administrator)
//        → { url }  Google sign-in page for the account to back up to
//   GET  ?code=…&state=…                                          (Google's reply)
//        → saves the account, makes the backup folder, returns to the app
//   POST { action: "run", destination_id }                        (administrator)
//        → backs up now
//   POST { action: "scheduled", destination_id }  + x-backup-secret header
//        → the nightly backup (sent by pg_cron, see supabase/backup.sql)
//
// Deployed with JWT checking off, because Google's reply carries no sign-in;
// the "connect" and "run" actions check the caller is an administrator.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/drive-backup`;

const BUCKET = 'uploads';
const FOLDER_NAME = 'Theatre Inventory Backups';
const PHOTOS_FOLDER_NAME = 'Photos';
const FILE_PREFIX = 'theatre-inventory-backup-';
const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
// Stop copying photos after this long so the run finishes inside the time limit;
// the rest are copied on the next run.
const PHOTO_TIME_BUDGET_MS = 90_000;
const STATE_LIFETIME_MS = 30 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Settings and callers
// ---------------------------------------------------------------------------

async function settings() {
  const { data, error } = await admin.from('backup_settings').select('*').eq('id', 1).single();
  if (error) throw new Error(`Backup settings are missing: ${error.message}`);
  return data;
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in again.');
  // The app sends its public key as "apikey"; fall back to it if the
  // function has no anon key of its own.
  const publicKey = ANON_KEY || req.headers.get('apikey') || '';
  const asUser = createClient(SUPABASE_URL, publicKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser(authHeader.slice(7));
  if (userError || !userData?.user) throw new HttpError(401, 'Please sign in again.');
  const { data: isAdmin, error } = await asUser.rpc('is_admin');
  if (error || !isAdmin) throw new HttpError(403, 'Only administrators can manage cloud backups.');
  return userData.user;
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function googleToken(params: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(body.error_description || body.error || `Google answered ${response.status}`);
    (err as Error & { code?: string }).code = body.error;
    throw err;
  }
  return body as { access_token: string; refresh_token?: string; id_token?: string };
}

async function drive(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Google Drive: ${response.status} ${text.slice(0, 300)}`);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }
  return response;
}

async function createFolder(token: string, name: string, parent?: string) {
  const response = await drive(token, '/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parent ? { parents: [parent] } : {}),
    }),
  });
  return (await response.json()).id as string;
}

async function folderUsable(token: string, id?: string | null) {
  if (!id) return false;
  try {
    const response = await drive(token, `/drive/v3/files/${id}?fields=id,trashed`);
    const body = await response.json();
    return !body.trashed;
  } catch {
    return false;
  }
}

/** Upload a file (any size) with Google's resumable upload. */
async function uploadFile(token: string, name: string, parent: string, body: Blob | string, mimeType: string) {
  const start = await drive(token, '/upload/drive/v3/files?uploadType=resumable&fields=id,size', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType },
    body: JSON.stringify({ name, parents: [parent], mimeType }),
  });
  const location = start.headers.get('Location');
  if (!location) throw new Error('Google Drive did not accept the upload.');
  const response = await fetch(location, { method: 'PUT', headers: { 'Content-Type': mimeType }, body });
  if (!response.ok) throw new Error(`Google Drive upload failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json() as Promise<{ id: string; size?: string }>;
}

function emailFromIdToken(idToken?: string) {
  if (!idToken) return '';
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).email || '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Connecting a Google account
// ---------------------------------------------------------------------------

async function startConnect(req: Request, body: Record<string, unknown>) {
  const user = await requireAdmin(req);
  const s = await settings();
  if (!s.google_client_id || !s.google_client_secret) {
    throw new HttpError(400, 'Enter the Google client ID and secret first.');
  }
  const appUrl = String(body.app_url || '');
  if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)/.test(appUrl)) throw new HttpError(400, 'Unknown app address.');
  const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const { error } = await admin.from('backup_oauth_states').insert({
    state,
    label: String(body.label || '').slice(0, 80) || 'Google Drive',
    destination_id: body.destination_id || null,
    user_id: user.id,
    app_url: appUrl,
  });
  if (error) throw new Error(error.message);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: s.google_client_id,
    redirect_uri: FUNCTION_URL,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  }).toString();
  return json({ url: url.toString() });
}

function backToApp(appUrl: string, params: Record<string, string>) {
  const base = appUrl.split('#')[0];
  const query = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: `${base}#/Administration?${query}` } });
}

async function finishConnect(url: URL) {
  const stateId = url.searchParams.get('state') || '';
  const { data: state } = await admin.from('backup_oauth_states').select('*').eq('state', stateId).maybeSingle();
  if (!state) return new Response('This sign-in link has expired. Go back to the app and try again.', { status: 400 });
  await admin.from('backup_oauth_states').delete().eq('state', stateId);
  if (Date.now() - new Date(state.created_at).getTime() > STATE_LIFETIME_MS) {
    return backToApp(state.app_url, { backup: 'error', message: 'The sign-in took too long. Please try again.' });
  }
  const googleError = url.searchParams.get('error');
  if (googleError) {
    return backToApp(state.app_url, {
      backup: 'error',
      message: googleError === 'access_denied' ? 'Google access was not allowed.' : `Google said: ${googleError}`,
    });
  }
  try {
    const s = await settings();
    const tokens = await googleToken({
      code: url.searchParams.get('code') || '',
      client_id: s.google_client_id,
      client_secret: s.google_client_secret,
      redirect_uri: FUNCTION_URL,
      grant_type: 'authorization_code',
    });
    if (!tokens.refresh_token) {
      throw new Error('Google did not give lasting access. Remove the app at myaccount.google.com/permissions and try again.');
    }
    const email = emailFromIdToken(tokens.id_token);

    let existing = null;
    if (state.destination_id) {
      const { data } = await admin.from('backup_destinations').select('*').eq('id', state.destination_id).maybeSingle();
      existing = data;
    }
    // Reuse the folder when reconnecting the same account; otherwise make one.
    let folderId = existing?.folder_id;
    let photosFolderId = existing?.photos_folder_id;
    if (!(await folderUsable(tokens.access_token, folderId))) {
      folderId = await createFolder(tokens.access_token, FOLDER_NAME);
      photosFolderId = null;
    }
    if (!(await folderUsable(tokens.access_token, photosFolderId))) {
      photosFolderId = await createFolder(tokens.access_token, PHOTOS_FOLDER_NAME, folderId);
      if (existing) await admin.from('backup_photo_uploads').delete().eq('destination_id', existing.id);
    }

    const fields = {
      account_email: email,
      refresh_token: tokens.refresh_token,
      folder_id: folderId,
      photos_folder_id: photosFolderId,
      status: 'ok',
      last_error: null,
    };
    let destinationId = existing?.id;
    if (existing) {
      await admin.from('backup_destinations').update(fields).eq('id', existing.id);
    } else {
      const { data, error } = await admin
        .from('backup_destinations')
        .insert({ ...fields, label: state.label, created_by: state.user_id })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      destinationId = data.id;
    }
    return backToApp(state.app_url, { backup: 'connected', destination: destinationId, email });
  } catch (error) {
    console.error('Connecting Google Drive failed:', error);
    return backToApp(state.app_url, { backup: 'error', message: String((error as Error).message || error).slice(0, 300) });
  }
}

// ---------------------------------------------------------------------------
// Making a backup
// ---------------------------------------------------------------------------

async function readAll(client: SupabaseClient, table: string, columns: string, order: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from(table).select(columns).range(from, from + 999);
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error } = await query;
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

/** The same file Administration → "Download backup" makes. */
async function buildBackup() {
  const rows = await readAll(admin, 'records', 'entity,id,data,created_date,updated_date,created_by', ['entity', 'created_date', 'id']);
  const entities: Record<string, unknown[]> = {};
  for (const row of rows) {
    const name = row.entity as string;
    (entities[name] ||= []).push({
      ...((row.data as Record<string, unknown>) || {}),
      id: row.id,
      created_date: row.created_date,
      updated_date: row.updated_date,
      created_by: row.created_by,
    });
  }
  const profiles = await readAll(admin, 'profiles', 'id,email,full_name,role_id,account_status', ['created_date']);
  return {
    data: {
      format: 'theatre-inventory-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      source: 'supabase',
      backup_kind: 'cloud',
      entities,
      users: profiles,
    },
    recordCount: rows.length,
  };
}

async function listStorage(prefix = ''): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Reading photos: ${error.message}`);
    for (const entry of data || []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) names.push(...(await listStorage(path))); // a folder
      else if (entry.name !== '.emptyFolderPlaceholder') names.push(path);
    }
    if (!data || data.length < 1000) return names;
  }
}

async function trashOldBackups(token: string, folderId: string, keep: number) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and name contains '${FILE_PREFIX}'`);
  const response = await drive(token, `/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=1000&fields=files(id,name,createdTime)`);
  const files = ((await response.json()).files || []) as { id: string }[];
  const extra = files.slice(keep);
  for (const file of extra) {
    // Trash (not delete): Google keeps trashed files for 30 days.
    await drive(token, `/drive/v3/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    });
  }
  return extra.length;
}

function stamp(date: Date) {
  // e.g. 2026-11-24-0817 (UTC), so files sort by date in Drive.
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13).replace(/^(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
}

async function runBackup(destinationId: string, trigger: 'manual' | 'scheduled') {
  const started = Date.now();
  const { data: dest, error } = await admin.from('backup_destinations').select('*').eq('id', destinationId).maybeSingle();
  if (error || !dest) throw new HttpError(404, 'That backup location no longer exists.');
  if (!dest.refresh_token) throw new HttpError(400, 'Connect this Google account first.');

  const { data: run } = await admin
    .from('backup_runs')
    .insert({ destination_id: dest.id, destination_label: dest.label, trigger })
    .select('id')
    .single();
  const finishRun = (fields: Record<string, unknown>) =>
    admin.from('backup_runs').update({ finished_at: new Date().toISOString(), ...fields }).eq('id', run?.id);

  try {
    const s = await settings();
    let token: string;
    try {
      token = (await googleToken({
        client_id: s.google_client_id,
        client_secret: s.google_client_secret,
        refresh_token: dest.refresh_token,
        grant_type: 'refresh_token',
      })).access_token;
    } catch (err) {
      if ((err as { code?: string }).code === 'invalid_grant') {
        const message = 'Google access ended (the password changed, access was removed, or the Google app is still in Testing). Reconnect this Drive.';
        await admin.from('backup_destinations').update({ status: 'needs_reconnect', last_error: message }).eq('id', dest.id);
        await finishRun({ status: 'failed', message });
        return { ok: false, message };
      }
      throw err;
    }

    // The folder may have been deleted in Drive; make a new one if so.
    let folderId = dest.folder_id;
    let photosFolderId = dest.photos_folder_id;
    if (!(await folderUsable(token, folderId))) {
      folderId = await createFolder(token, FOLDER_NAME);
      photosFolderId = await createFolder(token, PHOTOS_FOLDER_NAME, folderId);
      await admin.from('backup_photo_uploads').delete().eq('destination_id', dest.id);
    } else if (!(await folderUsable(token, photosFolderId))) {
      photosFolderId = await createFolder(token, PHOTOS_FOLDER_NAME, folderId);
      await admin.from('backup_photo_uploads').delete().eq('destination_id', dest.id);
    }

    const { data, recordCount } = await buildBackup();
    const text = JSON.stringify(data);
    const fileName = `${FILE_PREFIX}${stamp(new Date())}.json`;
    await uploadFile(token, fileName, folderId, text, 'application/json');
    const trashed = await trashOldBackups(token, folderId, dest.keep_count);

    // Photos: copy the ones this Drive does not have yet.
    let photosUploaded = 0;
    let photosRemaining = 0;
    if (dest.include_photos) {
      const all = await listStorage();
      const done = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data: rows } = await admin
          .from('backup_photo_uploads')
          .select('object_name')
          .eq('destination_id', dest.id)
          .range(from, from + 999);
        (rows || []).forEach((r) => done.add(r.object_name));
        if (!rows || rows.length < 1000) break;
      }
      const todo = all.filter((name) => !done.has(name));
      for (const name of todo) {
        if (Date.now() - started > PHOTO_TIME_BUDGET_MS) break;
        const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(name);
        if (downloadError || !blob) continue;
        await uploadFile(token, name.replace(/\//g, '__'), photosFolderId, blob, blob.type || 'application/octet-stream');
        await admin.from('backup_photo_uploads').insert({ destination_id: dest.id, object_name: name });
        photosUploaded += 1;
      }
      photosRemaining = todo.length - photosUploaded;
    }

    const message = [
      `${recordCount} records`,
      photosUploaded ? `${photosUploaded} new photo${photosUploaded === 1 ? '' : 's'} copied` : '',
      photosRemaining ? `${photosRemaining} photos left for the next run` : '',
      trashed ? `${trashed} old backup${trashed === 1 ? '' : 's'} moved to Drive trash` : '',
    ].filter(Boolean).join(' · ');

    await admin.from('backup_destinations').update({
      folder_id: folderId,
      photos_folder_id: photosFolderId,
      status: 'ok',
      last_error: null,
      last_backup_at: new Date().toISOString(),
      last_file_name: fileName,
    }).eq('id', dest.id);
    await finishRun({
      status: 'success',
      file_name: fileName,
      bytes: text.length,
      record_count: recordCount,
      photos_uploaded: photosUploaded,
      photos_remaining: photosRemaining,
      message,
    });
    return { ok: true, message, file_name: fileName };
  } catch (err) {
    const message = String((err as Error).message || err).slice(0, 500);
    console.error(`Backup to ${dest.label} failed:`, err);
    await admin.from('backup_destinations').update({ status: 'error', last_error: message }).eq('id', dest.id);
    await finishRun({ status: 'failed', message });
    return { ok: false, message };
  }
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  try {
    if (req.method === 'GET') {
      if (url.searchParams.has('state')) return await finishConnect(url);
      return json({ ok: true, service: 'drive-backup' });
    }
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'connect':
        return await startConnect(req, body);
      case 'run': {
        await requireAdmin(req);
        if (!body.destination_id) throw new HttpError(400, 'Choose a backup location.');
        return json(await runBackup(String(body.destination_id), 'manual'));
      }
      case 'scheduled': {
        const s = await settings();
        if (!s.cron_secret || req.headers.get('x-backup-secret') !== s.cron_secret) throw new HttpError(401, 'Not allowed.');
        return json(await runBackup(String(body.destination_id), 'scheduled'));
      }
      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    return json({ ok: false, message: String((error as Error).message || error) }, status);
  }
});
