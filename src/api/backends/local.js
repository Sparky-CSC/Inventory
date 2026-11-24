// "Local" backend: everything is stored in this browser using IndexedDB.
//
// Nothing leaves the device, so there is no real security here — the sign-in
// screen only keeps different people's preferences apart on a shared computer.
// Use shared mode (Supabase) when several people or devices need the same data.

import { ADMIN_ROLE_ID, DEFAULT_ROLES, USER_ROLE_ID } from '../config';
import { NotFoundError, newId } from '../recordUtils';

const DB_NAME = 'TheatreInventoryLocalDB';
const DB_VERSION = 1;
const SESSION_KEY = 'theatre_inventory_local_session';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: ['entity', 'id'] });
          store.createIndex('entity', 'entity', { unique: false });
        }
        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id' });
          store.createIndex('email', 'email', { unique: true });
        }
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'user_id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('The local database is blocked by another open tab.'));
    });
  }
  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeNames, mode, work) {
  const db = await openDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(names, mode);
  const stores = names.map((name) => tx.objectStore(name));
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('The local database transaction was cancelled.'));
  });
  const result = await work(...stores);
  await done;
  return result;
}

const toRecord = (row) => ({ ...row.data, id: row.id, created_date: row.created_date, updated_date: row.updated_date, created_by: row.created_by });

// ---------------------------------------------------------------------------
// Passwords (convenience only — see the note at the top of this file)
// ---------------------------------------------------------------------------

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto?.subtle) {
    return toHex(await crypto.subtle.digest('SHA-256', data));
  }
  // crypto.subtle is unavailable on plain http:// pages; fall back to a simple
  // non-cryptographic hash so the app still works there.
  let h = 0x811c9dc5;
  for (const byte of data) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv-${h.toString(16)}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const listeners = new Set();

function readSessionUserId() {
  try {
    return localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function writeSessionUserId(userId) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private browsing: the session simply lasts until the tab closes */
  }
  memorySessionUserId = userId || null;
  listeners.forEach((listener) => {
    try {
      listener(userId ? 'SIGNED_IN' : 'SIGNED_OUT');
    } catch (err) {
      console.error(err);
    }
  });
}

let memorySessionUserId = readSessionUserId();

async function ensureDefaultRoles() {
  const now = new Date().toISOString();
  await withStore('records', 'readwrite', async (store) => {
    for (const role of DEFAULT_ROLES) {
      const existing = await requestToPromise(store.get(['UserRole', role.id]));
      if (!existing) {
        const { id, ...data } = role;
        store.put({ entity: 'UserRole', id, data, created_date: now, updated_date: now, created_by: 'system' });
      }
    }
  });
}

async function getUserById(id) {
  if (!id) return null;
  return withStore('users', 'readonly', (store) => requestToPromise(store.get(id)));
}

async function getAllUsers() {
  return withStore('users', 'readonly', (store) => requestToPromise(store.getAll()));
}

async function findPendingInvitation(email) {
  const rows = await withStore('records', 'readonly', (store) =>
    requestToPromise(store.index('entity').getAll('UserInvitation'))
  );
  const wanted = normalizeEmail(email);
  const now = Date.now();
  return (
    rows.find((row) => {
      const invite = row.data || {};
      if (normalizeEmail(invite.email) !== wanted) return false;
      if ((invite.status || 'pending') !== 'pending') return false;
      if (invite.expires_at && new Date(invite.expires_at).getTime() < now) return false;
      return true;
    }) || null
  );
}

const requireSessionUser = async () => {
  const user = await getUserById(memorySessionUserId);
  if (!user) {
    const error = new Error('You are not signed in.');
    error.status = 401;
    throw error;
  }
  return user;
};

const currentUserEmail = async () => (await getUserById(memorySessionUserId))?.email || null;

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

export const localBackend = {
  mode: 'local',

  // ----- records -----------------------------------------------------------
  async listRecords(entity) {
    const rows = await withStore('records', 'readonly', (store) =>
      requestToPromise(store.index('entity').getAll(entity))
    );
    return rows.map(toRecord);
  },

  async findRecords(entity /*, equalityQuery */) {
    // The caller filters the result itself; locally there is nothing to gain
    // from filtering twice.
    return this.listRecords(entity);
  },

  async getRecord(entity, id) {
    const row = await withStore('records', 'readonly', (store) => requestToPromise(store.get([entity, String(id)])));
    if (!row) throw new NotFoundError(entity, id);
    return toRecord(row);
  },

  async insertRecords(entity, items) {
    const createdBy = await currentUserEmail();
    const base = Date.now();
    const rows = items.map((item, index) => {
      // Keep each row's timestamp unique so "newest first" stays stable.
      const stamp = new Date(base + index).toISOString();
      return {
        entity,
        id: String(item.id || newId()),
        data: item.data,
        created_date: item.created_date || stamp,
        updated_date: item.updated_date || item.created_date || stamp,
        created_by: item.created_by || createdBy,
      };
    });
    await withStore('records', 'readwrite', (store) => {
      rows.forEach((row) => store.put(row));
    });
    return rows.map(toRecord);
  },

  async updateRecord(entity, id, patch) {
    return withStore('records', 'readwrite', async (store) => {
      const row = await requestToPromise(store.get([entity, String(id)]));
      if (!row) throw new NotFoundError(entity, id);
      const next = { ...row, data: { ...row.data, ...patch }, updated_date: new Date().toISOString() };
      store.put(next);
      return toRecord(next);
    });
  },

  async deleteRecord(entity, id) {
    await withStore('records', 'readwrite', (store) => {
      store.delete([entity, String(id)]);
    });
    return { success: true };
  },

  async deleteAllRecords(entity) {
    await withStore('records', 'readwrite', async (store) => {
      const keys = await requestToPromise(store.index('entity').getAllKeys(entity));
      keys.forEach((key) => store.delete(key));
    });
  },

  // ----- users -------------------------------------------------------------
  async getCurrentUser() {
    return requireSessionUser();
  },

  async listUsers() {
    await requireSessionUser();
    const users = await getAllUsers();
    return users.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)));
  },

  async updateUser(id, patch) {
    const me = await requireSessionUser();
    const target = await getUserById(id);
    if (!target) throw new NotFoundError('User', id);

    const protectedFields = ['role', 'role_id', 'account_status', 'role_assigned_at', 'email'];
    const touchesProtected = protectedFields.some((field) => field in patch);
    const isSelfExpiry =
      me.id === target.id && Object.keys(patch).length === 1 && patch.account_status === 'expired';
    if (touchesProtected && !isSelfExpiry && !(await this.isAdmin())) {
      const error = new Error('Only an administrator can change roles or account status.');
      error.status = 403;
      throw error;
    }

    const next = { ...target, ...patch, id: target.id, updated_date: new Date().toISOString() };
    // The built-in "Admin" role and the admin flag always travel together.
    if ('role_id' in patch && !('role' in patch)) {
      next.role = patch.role_id === ADMIN_ROLE_ID ? 'admin' : 'user';
    }
    const wasActiveAdmin = target.role === 'admin' && target.account_status === 'active';
    const staysActiveAdmin = next.role === 'admin' && next.account_status === 'active';
    if (wasActiveAdmin && !staysActiveAdmin) {
      const admins = (await getAllUsers()).filter((u) => u.role === 'admin' && u.account_status === 'active');
      if (admins.length <= 1) {
        throw new Error('This is the only active administrator, so it cannot be demoted or disabled.');
      }
    }
    await withStore('users', 'readwrite', (store) => {
      store.put(next);
    });
    return next;
  },

  async updateCurrentUser(patch) {
    const me = await requireSessionUser();
    const safePatch = { ...patch };
    ['id', 'email', 'role', 'role_id', 'account_status', 'role_assigned_at', 'created_date'].forEach(
      (field) => delete safePatch[field]
    );
    const next = { ...me, ...safePatch, updated_date: new Date().toISOString() };
    await withStore('users', 'readwrite', (store) => {
      store.put(next);
    });
    return next;
  },

  /** Administrators can give another person a new password. */
  async adminSetPassword(userId, newPassword) {
    if (!(await this.isAdmin())) {
      const error = new Error("Only an administrator can set someone else's password.");
      error.status = 403;
      throw error;
    }
    const target = await getUserById(userId);
    if (!target) throw new NotFoundError('User', userId);
    await this.resetPassword({ email: target.email, newPassword });
    return true;
  },

  async isAdmin() {
    const me = await getUserById(memorySessionUserId);
    if (!me || me.account_status !== 'active') return false;
    if (me.role === 'admin') return true;
    if (!me.role_id) return false;
    try {
      const role = await this.getRecord('UserRole', me.role_id);
      return Array.isArray(role.permissions) && role.permissions.includes('manage_users');
    } catch {
      return false;
    }
  },

  // ----- sign-in -----------------------------------------------------------
  async getSessionUserId() {
    if (!memorySessionUserId) return null;
    const user = await getUserById(memorySessionUserId);
    if (!user) {
      writeSessionUserId(null);
      return null;
    }
    return user.id;
  },

  onAuthChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async needsSetup() {
    const users = await getAllUsers();
    return users.length === 0;
  },

  async checkInvitation(email) {
    if (await this.needsSetup()) return { allowed: true, first_user: true, role_name: 'Admin' };
    const invite = await findPendingInvitation(email);
    return invite
      ? { allowed: true, first_user: false, role_name: invite.data.role_name || null }
      : { allowed: false, first_user: false, role_name: null };
  },

  async signUp({ email, password, full_name }) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !password) throw new Error('Email and password are required.');
    if (String(password).length < 6) throw new Error('Please choose a password with at least 6 characters.');

    const users = await getAllUsers();
    if (users.some((u) => normalizeEmail(u.email) === cleanEmail)) {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }

    await ensureDefaultRoles();
    const isFirstUser = users.length === 0;
    const invite = isFirstUser ? null : await findPendingInvitation(cleanEmail);
    if (!isFirstUser && !invite) {
      throw new Error('This email has not been invited yet. Ask an administrator to send you an invitation.');
    }

    const now = new Date().toISOString();
    const roleId = isFirstUser ? ADMIN_ROLE_ID : invite.data.role_id || USER_ROLE_ID;
    const user = {
      id: newId(),
      email: cleanEmail,
      full_name: String(full_name || '').trim() || cleanEmail.split('@')[0],
      role: isFirstUser || roleId === ADMIN_ROLE_ID ? 'admin' : 'user',
      role_id: roleId,
      account_status: 'active',
      role_assigned_at: now,
      created_date: now,
      updated_date: now,
    };
    const salt = newId();
    const password_hash = await hashPassword(password, salt);

    await withStore(['users', 'credentials', 'records'], 'readwrite', (usersStore, credentialsStore, recordsStore) => {
      usersStore.put(user);
      credentialsStore.put({ user_id: user.id, salt, password_hash });
      if (invite) {
        recordsStore.put({
          ...invite,
          data: { ...invite.data, status: 'accepted', accepted_at: now },
          updated_date: now,
        });
      }
    });

    writeSessionUserId(user.id);
    return { user, needsEmailConfirmation: false };
  },

  async signIn({ email, password }) {
    const cleanEmail = normalizeEmail(email);
    const users = await getAllUsers();
    const user = users.find((u) => normalizeEmail(u.email) === cleanEmail);
    const failure = new Error('That email and password do not match an account on this device.');
    failure.status = 401;
    if (!user) throw failure;
    const credential = await withStore('credentials', 'readonly', (store) => requestToPromise(store.get(user.id)));
    if (!credential) throw failure;
    const hash = await hashPassword(password, credential.salt);
    if (hash !== credential.password_hash) throw failure;
    writeSessionUserId(user.id);
    return { user };
  },

  async signOut() {
    writeSessionUserId(null);
  },

  /**
   * Local accounts have no email delivery, and the data is not protected from
   * anyone who can use this browser anyway, so a forgotten password is simply
   * replaced after the person confirms the account's email address.
   */
  async resetPassword({ email, newPassword }) {
    const cleanEmail = normalizeEmail(email);
    const users = await getAllUsers();
    const user = users.find((u) => normalizeEmail(u.email) === cleanEmail);
    if (!user) throw new Error('No account with that email exists on this device.');
    if (!newPassword || String(newPassword).length < 6) {
      throw new Error('Please choose a password with at least 6 characters.');
    }
    const salt = newId();
    const password_hash = await hashPassword(newPassword, salt);
    await withStore('credentials', 'readwrite', (store) => {
      store.put({ user_id: user.id, salt, password_hash });
    });
    return { emailed: false };
  },

  async changePassword(newPassword) {
    const me = await requireSessionUser();
    return this.resetPassword({ email: me.email, newPassword });
  },

  // ----- files -------------------------------------------------------------
  /** Photos are kept inside the records themselves as data: URLs. */
  async uploadFile({ dataUrl }) {
    return { file_url: dataUrl };
  },

  // ----- public info ------------------------------------------------------
  async getPublicAppInfo() {
    const [settings] = await this.listRecords('AppSettings');
    return settings ? { appName: settings.appName || '', logoUrl: settings.logoUrl || '' } : null;
  },

  // ----- backup ------------------------------------------------------------
  async exportUsers() {
    return getAllUsers();
  },

  async wipeEverything() {
    await withStore(['records', 'users', 'credentials'], 'readwrite', (records, users, credentials) => {
      records.clear();
      users.clear();
      credentials.clear();
    });
    writeSessionUserId(null);
  },
};

export default localBackend;
