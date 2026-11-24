// Small helpers shared by both storage backends.

import { SYSTEM_FIELDS } from './config';

const schemaModules = import.meta.glob('./schemas/*.json', { eager: true });

export const SCHEMAS = Object.fromEntries(
  Object.values(schemaModules).map((mod) => {
    const schema = mod.default || mod;
    return [schema.name, schema];
  })
);

/** 24-character id in the same style Base44 used, so imported ids fit in. */
export function newId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  // First four bytes carry the time so ids sort roughly by creation.
  const seconds = Math.floor(Date.now() / 1000);
  bytes[0] = (seconds >>> 24) & 0xff;
  bytes[1] = (seconds >>> 16) & 0xff;
  bytes[2] = (seconds >>> 8) & 0xff;
  bytes[3] = seconds & 0xff;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Make a value storable: dates become text (ISO format), `undefined` and
 * functions are dropped — exactly what sending it to a server as JSON would do.
 */
export function toPlainData(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

/** Remove fields the system owns so callers can't overwrite them by accident. */
export function stripSystemFields(data) {
  const out = {};
  for (const [key, value] of Object.entries(toPlainData(data || {}) || {})) {
    if (SYSTEM_FIELDS.includes(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Fill in the defaults declared in the entity's schema for missing fields. */
export function applyDefaults(entityName, data) {
  const schema = SCHEMAS[entityName];
  const out = { ...data };
  if (!schema?.properties) return out;
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (SYSTEM_FIELDS.includes(key)) continue;
    if (out[key] === undefined && prop.default !== undefined) {
      out[key] = structuredCloneSafe(prop.default);
    }
  }
  return out;
}

function structuredCloneSafe(value) {
  return value === null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value));
}

function getPath(obj, path) {
  if (obj == null) return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function looseEquals(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function matchesCondition(value, condition) {
  const isOperatorObject =
    condition !== null &&
    typeof condition === 'object' &&
    !Array.isArray(condition) &&
    Object.keys(condition).length > 0 &&
    Object.keys(condition).every((k) => k.startsWith('$'));

  if (!isOperatorObject) {
    // A plain value matches the field itself, or one entry of an array field.
    if (Array.isArray(value) && !Array.isArray(condition)) {
      return value.some((entry) => looseEquals(entry, condition));
    }
    return looseEquals(value, condition);
  }

  return Object.entries(condition).every(([op, operand]) => {
    switch (op) {
      case '$eq':
        return looseEquals(value, operand);
      case '$ne':
        return !looseEquals(value, operand);
      case '$in':
        return Array.isArray(operand) && operand.some((o) => matchesCondition(value, o));
      case '$nin':
        return Array.isArray(operand) && !operand.some((o) => matchesCondition(value, o));
      case '$gt':
        return value != null && value > operand;
      case '$gte':
        return value != null && value >= operand;
      case '$lt':
        return value != null && value < operand;
      case '$lte':
        return value != null && value <= operand;
      case '$exists':
        return operand ? value !== undefined && value !== null : value === undefined || value === null;
      case '$regex': {
        try {
          return new RegExp(operand, condition.$options || '').test(String(value ?? ''));
        } catch {
          return false;
        }
      }
      case '$options':
        return true;
      default:
        return false;
    }
  });
}

/** Does a record satisfy a query like { status: 'available', user_id: '…' }? */
export function matchesQuery(record, query) {
  if (!query || typeof query !== 'object') return true;
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$or') return Array.isArray(condition) && condition.some((q) => matchesQuery(record, q));
    if (key === '$and') return Array.isArray(condition) && condition.every((q) => matchesQuery(record, q));
    return matchesCondition(getPath(record, key), condition);
  });
}

/** True when a query only uses plain "field equals value" tests. */
export function isSimpleEqualityQuery(query) {
  if (!query || typeof query !== 'object') return false;
  const entries = Object.entries(query);
  if (entries.length === 0) return false;
  return entries.every(([key, value]) => {
    if (key.startsWith('$') || key.includes('.') || SYSTEM_FIELDS.includes(key)) return false;
    return value !== null && value !== undefined && typeof value !== 'object';
  });
}

function compareValues(a, b) {
  const aMissing = a === undefined || a === null || a === '';
  const bMissing = b === undefined || b === null || b === '';
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing values always sort last
  if (bMissing) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sort by a field name. A leading "-" means newest/largest first, exactly like
 * the Base44 SDK ("-created_date").
 */
export function sortRecords(records, sort) {
  const list = [...records];
  if (!sort || typeof sort !== 'string') return list;
  const descending = sort.startsWith('-');
  const field = sort.replace(/^[-+]/, '');
  return list.sort((a, b) => {
    const aValue = getPath(a, field);
    const bValue = getPath(b, field);
    const aMissing = aValue === undefined || aValue === null || aValue === '';
    const bMissing = bValue === undefined || bValue === null || bValue === '';
    if (aMissing || bMissing) return compareValues(aValue, bValue);
    const result = compareValues(aValue, bValue);
    return descending ? -result : result;
  });
}

export function paginate(records, limit, skip) {
  const start = Number.isFinite(Number(skip)) && Number(skip) > 0 ? Number(skip) : 0;
  const hasLimit = limit !== undefined && limit !== null && Number.isFinite(Number(limit)) && Number(limit) > 0;
  return hasLimit ? records.slice(start, start + Number(limit)) : records.slice(start);
}

export class NotFoundError extends Error {
  constructor(entityName, id) {
    super(`${entityName} with id "${id}" was not found`);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}
