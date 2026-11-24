// The data API every page uses.
//
// Each entity offers the same calls the Base44 SDK did, so the pages did not
// have to change:
//
//   InventoryItem.list('-created_date', 100)
//   InventoryItem.filter({ status: 'available' })
//   InventoryItem.get(id) / .create(data) / .update(id, data) / .delete(id)
//
// plus User.me(), User.updateMyUserData(), User.logout() and friends.

import backend from './backends';
import { ENTITY_NAMES } from './config';
import { emitDataChanged } from './events';
import {
  SCHEMAS,
  applyDefaults,
  isSimpleEqualityQuery,
  matchesQuery,
  paginate,
  sortRecords,
  stripSystemFields,
  toPlainData,
} from './recordUtils';

const DEFAULT_SORT = '-created_date';

function createEntity(entityName) {
  // New records always get a fresh id and timestamps …
  const prepareNew = (data) => ({
    data: applyDefaults(entityName, stripSystemFields(data || {})),
  });

  // … except when restoring a backup or importing, where they are kept so
  // links between records (and printed QR codes) keep working.
  const prepareImported = (data) => {
    const source = toPlainData(data || {});
    return {
      id: source.id ? String(source.id) : undefined,
      created_date: source.created_date || undefined,
      updated_date: source.updated_date || undefined,
      created_by: source.created_by || undefined,
      data: applyDefaults(entityName, stripSystemFields(source)),
    };
  };

  return {
    entityName,

    /** All records, newest first unless a sort field is given. */
    async list(sort = DEFAULT_SORT, limit, skip) {
      const records = await backend.listRecords(entityName);
      return paginate(sortRecords(records, sort || DEFAULT_SORT), limit, skip);
    },

    /** Records whose fields match the query, e.g. { status: 'available' }. */
    async filter(query = {}, sort = DEFAULT_SORT, limit, skip) {
      const records = isSimpleEqualityQuery(query)
        ? await backend.findRecords(entityName, query)
        : await backend.listRecords(entityName);
      const matching = records.filter((record) => matchesQuery(record, query));
      return paginate(sortRecords(matching, sort || DEFAULT_SORT), limit, skip);
    },

    async get(id) {
      return backend.getRecord(entityName, id);
    },

    async create(data) {
      const [record] = await backend.insertRecords(entityName, [prepareNew(data)]);
      emitDataChanged(entityName, 'create', record);
      return record;
    },

    async bulkCreate(items) {
      const list = Array.isArray(items) ? items : [];
      if (list.length === 0) return [];
      const records = await backend.insertRecords(entityName, list.map(prepareNew));
      emitDataChanged(entityName, 'create');
      return records;
    },

    /** Add (or overwrite) records keeping their existing ids and dates. */
    async importRecords(items) {
      const list = Array.isArray(items) ? items : [];
      if (list.length === 0) return [];
      const records = await backend.insertRecords(entityName, list.map(prepareImported));
      emitDataChanged(entityName, 'create');
      return records;
    },

    /** Changes only the fields given; everything else on the record is kept. */
    async update(id, data) {
      const record = await backend.updateRecord(entityName, id, stripSystemFields(data));
      emitDataChanged(entityName, 'update', record);
      return record;
    },

    async delete(id) {
      const result = await backend.deleteRecord(entityName, id);
      emitDataChanged(entityName, 'delete', { id });
      return result;
    },

    async deleteAll() {
      await backend.deleteAllRecords(entityName);
      emitDataChanged(entityName, 'delete');
    },

    schema() {
      return SCHEMAS[entityName] || { name: entityName, type: 'object', properties: {} };
    },
  };
}

export const entities = Object.fromEntries(ENTITY_NAMES.map((name) => [name, createEntity(name)]));

export const {
  AppSettings,
  BorrowedItem,
  Category,
  Container,
  Department,
  ExpendableItem,
  FavoriteItem,
  InventoryItem,
  Invoice,
  Location,
  ReminderSchedule,
  ReminderSettings,
  RentalOrder,
  Renter,
  StockAlert,
  Subcategory,
  UserDashboard,
  UserInvitation,
  UserNotification,
  UserRole,
} = entities;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const User = {
  entityName: 'User',

  /** The signed-in person. Throws (status 401) when nobody is signed in. */
  async me() {
    return backend.getCurrentUser();
  },

  async isAuthenticated() {
    return Boolean(await backend.getSessionUserId());
  },

  /** Save personal preferences (phone, sidebar order, default page …). */
  async updateMyUserData(data) {
    const user = await backend.updateCurrentUser(toPlainData(data || {}));
    emitDataChanged('User', 'update', user);
    return user;
  },

  async list(sort = 'created_date', limit, skip) {
    const users = await backend.listUsers();
    return paginate(sortRecords(users, sort), limit, skip);
  },

  async filter(query = {}, sort = 'created_date', limit, skip) {
    const users = await backend.listUsers();
    return paginate(sortRecords(users.filter((u) => matchesQuery(u, query)), sort), limit, skip);
  },

  async get(id) {
    const users = await backend.listUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      const error = new Error(`User with id "${id}" was not found`);
      error.status = 404;
      throw error;
    }
    return user;
  },

  /** Administrators can change anyone's role and status. */
  async update(id, data) {
    const user = await backend.updateUser(id, toPlainData(data || {}));
    emitDataChanged('User', 'update', user);
    return user;
  },

  /** Administrators only: give another person a new password. */
  async setPassword(id, newPassword) {
    return backend.adminSetPassword(id, newPassword);
  },

  async logout() {
    await backend.signOut();
  },

  schema() {
    return SCHEMAS.User;
  },
};

export default entities;
