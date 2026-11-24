// "Shared" backend: data, sign-in and photos live in a Supabase project so
// everyone sees the same inventory. The database rules that go with this file
// are in supabase/schema.sql.

import { createClient } from '@supabase/supabase-js';
import { STORAGE_BUCKET, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { NotFoundError, matchesQuery, newId } from '../recordUtils';
import { clearCached, isOfflineError, readCached, saveCached } from '../offlineCache';

const PAGE_SIZE = 1000;
const AUTH_STORAGE_KEY = 'theatre_inventory_auth';
const RECORD_COLUMNS = 'id,data,created_date,updated_date,created_by';
const PROFILE_COLUMNS = 'id,email,full_name,role,role_id,account_status,role_assigned_at,data,created_date,updated_date';

// Fields stored in their own columns on the profiles table. Anything else a
// page saves on a user (phone, sidebar order, default page …) goes in `data`.
const PROFILE_FIELDS = ['email', 'full_name', 'role', 'role_id', 'account_status', 'role_assigned_at'];

let client = null;

export function getSupabase() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE keeps sign-in links in the "?code=" part of the address, which
        // leaves the "#/Page" part free for the app's own navigation.
        flowType: 'pkce',
        storageKey: AUTH_STORAGE_KEY,
      },
    });
  }
  return client;
}

function fail(error, fallback) {
  const message = error?.message || fallback || 'The request to the database failed.';
  const wrapped = new Error(friendlyMessage(message));
  wrapped.isOffline = isOfflineError(error);
  wrapped.status = error?.status || (error?.code === 'PGRST116' ? 404 : undefined);
  wrapped.code = error?.code;
  wrapped.cause = error;
  return wrapped;
}

function browserIsOfflineMessage() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
    ? 'You are offline. Changes can be saved again once the connection is back.'
    : 'Could not reach the database. Check your internet connection and try again.';
}

function friendlyMessage(message) {
  if (/row-level security|permission denied|violates row-level/i.test(message)) {
    return 'Your account does not have permission to do that.';
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return browserIsOfflineMessage();
  }
  if (/Invalid login credentials/i.test(message)) {
    return 'That email and password do not match an account.';
  }
  if (/Database error saving new user/i.test(message)) {
    return 'This email has not been invited yet. Ask an administrator to send you an invitation.';
  }
  if (/User already registered/i.test(message)) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  return message;
}

const toRecord = (row) => ({
  ...(row.data || {}),
  id: row.id,
  created_date: row.created_date,
  updated_date: row.updated_date,
  created_by: row.created_by,
});

const toUser = (row) => ({
  ...(row.data || {}),
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  role_id: row.role_id,
  account_status: row.account_status,
  role_assigned_at: row.role_assigned_at,
  created_date: row.created_date,
  updated_date: row.updated_date,
});

const browserIsOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function offlineError() {
  const error = new Error('You are offline, and this information has not been saved on this device yet.');
  error.isOffline = true;
  return error;
}

/**
 * While the browser knows it is offline, answer straight from the saved copy
 * instead of waiting for network attempts to time out.
 */
async function cachedListWhenOffline(entity) {
  if (!browserIsOffline()) return undefined;
  const cached = await readCached(`list:${entity}`);
  if (!cached) throw offlineError();
  return cached;
}

/** Read every row of a query, 1000 at a time (Supabase caps each request). */
async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw fail(error);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** The signed-in person as last saved in this browser (used when offline). */
function storedSessionUser() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return stored?.user || null;
  } catch {
    return null;
  }
}

async function sessionUser() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) {
    // Offline with an expired sign-in: carry on with the saved one so the
    // app can still show its offline copy. It is renewed once back online.
    if (isOfflineError(error)) return storedSessionUser();
    throw fail(error);
  }
  return data?.session?.user || null;
}

async function requireSessionUser() {
  const user = await sessionUser();
  if (!user) {
    const error = new Error('You are not signed in.');
    error.status = 401;
    throw error;
  }
  return user;
}

function splitUserPatch(patch) {
  const columns = {};
  const extra = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (['id', 'created_date', 'updated_date', 'role'].includes(key)) continue;
    if (PROFILE_FIELDS.includes(key)) columns[key] = value;
    else extra[key] = value;
  }
  return { columns, extra };
}

export const supabaseBackend = {
  mode: 'supabase',

  // ----- records -----------------------------------------------------------
  async listRecords(entity) {
    const offlineCopy = await cachedListWhenOffline(entity);
    if (offlineCopy) return offlineCopy;
    try {
      const rows = await fetchAll(() =>
        getSupabase()
          .from('records')
          .select(RECORD_COLUMNS)
          .eq('entity', entity)
          .order('created_date', { ascending: false })
          .order('id', { ascending: true })
      );
      const records = rows.map(toRecord);
      saveCached(`list:${entity}`, records);
      return records;
    } catch (error) {
      if (error.isOffline) {
        const cached = await readCached(`list:${entity}`);
        if (cached) return cached;
      }
      throw error;
    }
  },

  /** Let the database do simple "field equals value" filtering. */
  async findRecords(entity, equalityQuery) {
    const offlineCopy = await cachedListWhenOffline(entity);
    if (offlineCopy) return offlineCopy.filter((record) => matchesQuery(record, equalityQuery));
    try {
      const rows = await fetchAll(() =>
        getSupabase()
          .from('records')
          .select(RECORD_COLUMNS)
          .eq('entity', entity)
          .contains('data', equalityQuery)
          .order('created_date', { ascending: false })
          .order('id', { ascending: true })
      );
      return rows.map(toRecord);
    } catch (error) {
      if (error.isOffline) {
        const cached = await readCached(`list:${entity}`);
        if (cached) return cached.filter((record) => matchesQuery(record, equalityQuery));
      }
      throw error;
    }
  },

  async getRecord(entity, id) {
    if (browserIsOffline()) {
      const record = (await cachedListWhenOffline(entity)).find((entry) => entry.id === String(id));
      if (!record) throw offlineError();
      return record;
    }
    const { data, error } = await getSupabase()
      .from('records')
      .select(RECORD_COLUMNS)
      .eq('entity', entity)
      .eq('id', String(id))
      .maybeSingle();
    if (error) {
      if (isOfflineError(error)) {
        const cached = await readCached(`list:${entity}`);
        const record = cached?.find((entry) => entry.id === String(id));
        if (record) return record;
      }
      throw fail(error);
    }
    if (!data) throw new NotFoundError(entity, id);
    return toRecord(data);
  },

  async insertRecords(entity, items) {
    if (browserIsOffline()) throw fail({ message: 'Failed to fetch' });
    const user = await sessionUser();
    const base = Date.now();
    const rows = items.map((item, index) => {
      const stamp = new Date(base + index).toISOString();
      return {
        entity,
        id: String(item.id || newId()),
        data: item.data,
        created_date: item.created_date || stamp,
        updated_date: item.updated_date || item.created_date || stamp,
        created_by: item.created_by || user?.email || null,
      };
    });
    const saved = [];
    // Large imports are sent in chunks to stay inside request size limits.
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { data, error } = await getSupabase()
        .from('records')
        .upsert(chunk, { onConflict: 'entity,id' })
        .select(RECORD_COLUMNS);
      if (error) throw fail(error);
      saved.push(...(data || []));
    }
    return saved.map(toRecord);
  },

  async updateRecord(entity, id, patch) {
    if (browserIsOffline()) throw fail({ message: 'Failed to fetch' });
    // The merge happens inside the database so two people editing different
    // fields of the same record don't overwrite each other.
    const { data, error } = await getSupabase().rpc('update_record', {
      p_entity: entity,
      p_id: String(id),
      p_patch: patch,
    });
    if (error) throw fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.id) throw new NotFoundError(entity, id);
    return toRecord(row);
  },

  async deleteRecord(entity, id) {
    if (browserIsOffline()) throw fail({ message: 'Failed to fetch' });
    const { error } = await getSupabase().from('records').delete().eq('entity', entity).eq('id', String(id));
    if (error) throw fail(error);
    return { success: true };
  },

  async deleteAllRecords(entity) {
    const { error } = await getSupabase().from('records').delete().eq('entity', entity);
    if (error) throw fail(error);
  },

  // ----- users -------------------------------------------------------------
  async getCurrentUser() {
    const authUser = await requireSessionUser();
    if (browserIsOffline()) {
      const cached = await readCached(`profile:${authUser.id}`);
      if (cached) return cached;
      throw offlineError();
    }
    const { data, error } = await getSupabase()
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) {
      if (isOfflineError(error)) {
        const cached = await readCached(`profile:${authUser.id}`);
        if (cached) return cached;
      }
      throw fail(error);
    }
    if (data) saveCached(`profile:${authUser.id}`, toUser(data));
    if (!data) {
      const missing = new Error('Your account has no profile yet. Ask an administrator for an invitation.');
      missing.status = 403;
      missing.code = 'user_not_registered';
      throw missing;
    }
    return toUser(data);
  },

  async listUsers() {
    const rows = await fetchAll(() =>
      getSupabase().from('profiles').select(PROFILE_COLUMNS).order('created_date', { ascending: true })
    );
    return rows.map(toUser);
  },

  async updateUser(id, patch) {
    const { columns, extra } = splitUserPatch(patch);
    const { data, error } = await getSupabase().rpc('update_profile', {
      p_id: id,
      p_columns: columns,
      p_data: extra,
    });
    if (error) throw fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.id) throw new NotFoundError('User', id);
    return toUser(row);
  },

  async updateCurrentUser(patch) {
    const authUser = await requireSessionUser();
    const safePatch = { ...patch };
    ['email', 'role', 'role_id', 'account_status', 'role_assigned_at'].forEach((field) => delete safePatch[field]);
    return this.updateUser(authUser.id, safePatch);
  },

  /** Administrators can give another person a new password. */
  async adminSetPassword(userId, newPassword) {
    const { error } = await getSupabase().rpc('admin_set_password', {
      p_user_id: userId,
      p_password: newPassword,
    });
    if (error) throw fail(error);
    return true;
  },

  async isAdmin() {
    const { data, error } = await getSupabase().rpc('is_admin');
    if (error) return false;
    return Boolean(data);
  },

  // ----- sign-in -----------------------------------------------------------
  async getSessionUserId() {
    const user = await sessionUser();
    return user?.id || null;
  },

  onAuthChange(listener) {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      // Run outside Supabase's own callback so listeners may call it again.
      setTimeout(() => listener(event), 0);
    });
    return () => data?.subscription?.unsubscribe();
  },

  async needsSetup() {
    const { data, error } = await getSupabase().rpc('app_needs_setup');
    if (error) throw fail(error, 'Could not reach the database.');
    return Boolean(data);
  },

  async checkInvitation(email) {
    const { data, error } = await getSupabase().rpc('check_invitation', { p_email: email });
    if (error) throw fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: Boolean(row?.allowed),
      first_user: Boolean(row?.first_user),
      role_name: row?.role_name || null,
    };
  },

  async signUp({ email, password, full_name }) {
    const invitation = await this.checkInvitation(email);
    if (!invitation.allowed) {
      throw new Error('This email has not been invited yet. Ask an administrator to send you an invitation.');
    }
    const { data, error } = await getSupabase().auth.signUp({
      email: String(email).trim(),
      password,
      options: {
        data: { full_name: String(full_name || '').trim() },
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw fail(error);
    // With "Confirm email" switched on, Supabase creates the account but does
    // not sign the person in until they click the link in their inbox.
    return { user: data.user, needsEmailConfirmation: !data.session };
  },

  async signIn({ email, password }) {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: String(email).trim(),
      password,
    });
    if (error) throw fail(error);
    return { user: data.user };
  },

  async signOut() {
    // Don't leave one person's offline copy behind for the next person.
    await clearCached();
    const { error } = await getSupabase().auth.signOut();
    if (error && !isOfflineError(error)) throw fail(error);
  },

  async resetPassword({ email }) {
    const { error } = await getSupabase().auth.resetPasswordForEmail(String(email).trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw fail(error);
    return { emailed: true };
  },

  async changePassword(newPassword) {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) throw fail(error);
    return { emailed: false };
  },

  // ----- files -------------------------------------------------------------
  async uploadFile({ blob, fileName, contentType }) {
    const authUser = await requireSessionUser();
    const safeName = String(fileName || 'file')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-60) || 'file';
    const path = `${authUser.id}/${newId()}-${safeName}`;
    const { error } = await getSupabase().storage.from(STORAGE_BUCKET).upload(path, blob, {
      contentType: contentType || blob.type || 'application/octet-stream',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw fail(error, 'The file could not be uploaded.');
    const { data } = getSupabase().storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { file_url: data.publicUrl };
  },

  // ----- public info ------------------------------------------------------
  async getPublicAppInfo() {
    const { data, error } = await getSupabase().rpc('public_app_info');
    if (error) throw fail(error);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { appName: row.app_name || '', logoUrl: row.logo_url || '' } : null;
  },

  // ----- backup ------------------------------------------------------------
  async exportUsers() {
    return this.listUsers();
  },
};

export default supabaseBackend;
