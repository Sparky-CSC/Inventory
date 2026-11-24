// Backup, restore and import.
//
//  - exportBackup()            → one JSON file with every record
//  - restoreBackup(json)       → put a backup file back
//  - parseImportFile(file)     → read a CSV/JSON export (e.g. from Base44)
//  - importRecords(name, rows) → add those rows, keeping their ids
//  - rehostExternalPhotos()    → copy photos that still live on another site

import Papa from 'papaparse';
import backend from './backends';
import { BACKEND_MODE, ENTITY_NAMES } from './config';
import { entities } from './entities';
import { uploadFile } from './files';
import { SCHEMAS } from './recordUtils';

export const BACKUP_FORMAT = 'theatre-inventory-backup';
export const BACKUP_VERSION = 1;

// Columns found in exports that are not part of the data itself.
const IGNORED_COLUMNS = new Set(['created_by_id', 'is_sample', 'app_id', '__v', 'is_deleted', 'deleted_date']);

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

export async function exportBackup({ onProgress } = {}) {
  const data = {};
  for (let i = 0; i < ENTITY_NAMES.length; i += 1) {
    const name = ENTITY_NAMES[i];
    onProgress?.({ stage: `Reading ${name}…`, current: i, total: ENTITY_NAMES.length });
    try {
      data[name] = await entities[name].list('created_date');
    } catch (error) {
      // Some lists (invitations, for example) are only readable by administrators.
      console.warn(`Skipping ${name} in backup:`, error);
      data[name] = [];
    }
  }
  let users = [];
  try {
    users = await backend.exportUsers();
  } catch (error) {
    console.warn('Could not include the user list in the backup:', error);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    source: BACKEND_MODE,
    entities: data,
    // For reference only — accounts and passwords are never restored from a file.
    users: users.map(({ id, email, full_name, role_id, account_status }) => ({
      id,
      email,
      full_name,
      role_id,
      account_status,
    })),
  };
}

// The app has exactly one settings record (name, logo, subtitles). When
// settings are brought in from a file they replace the ones already here,
// instead of sitting next to them as a confusing second copy.
async function removeOtherSettings(entityName, incomingRows) {
  if (entityName !== 'AppSettings' || !incomingRows?.length) return;
  const keep = new Set(incomingRows.map((row) => String(row.id || row._id || '')));
  const current = await entities.AppSettings.list();
  for (const record of current) {
    if (!keep.has(String(record.id))) await entities.AppSettings.delete(record.id);
  }
}

export function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isBackupFile(json) {
  return Boolean(json && json.format === BACKUP_FORMAT && json.entities && typeof json.entities === 'object');
}

/**
 * Put the records from a backup file back. Existing records with the same id
 * are overwritten; with `replaceExisting` everything else is removed first.
 */
export async function restoreBackup(json, { replaceExisting = false, onProgress } = {}) {
  if (!isBackupFile(json)) throw new Error('This file is not a backup made by this app.');
  const names = ENTITY_NAMES.filter((name) => Array.isArray(json.entities[name]));
  const summary = {};
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    const rows = json.entities[name];
    onProgress?.({ stage: `Restoring ${name} (${rows.length})…`, current: i, total: names.length });
    if (replaceExisting) await entities[name].deleteAll();
    else await removeOtherSettings(name, rows);
    await entities[name].importRecords(rows);
    summary[name] = rows.length;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const normalizeName = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Guess the data type from a file name such as "InventoryItem_export.csv". */
export function guessEntityFromFileName(fileName) {
  const base = normalizeName(String(fileName || '').replace(/\.[^.]+$/, ''));
  // Longest names first so "UserRole" wins over "User", "BorrowedItem" over "Item".
  const candidates = [...ENTITY_NAMES].sort((a, b) => b.length - a.length);
  return candidates.find((name) => base.includes(normalizeName(name))) || '';
}

function parseLooseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Some exports write lists the Python way: ['a', 'b'] / {'k': True}
    try {
      return JSON.parse(
        text
          .replace(/'/g, '"')
          .replace(/\bTrue\b/g, 'true')
          .replace(/\bFalse\b/g, 'false')
          .replace(/\bNone\b/g, 'null')
      );
    } catch {
      return undefined;
    }
  }
}

function convertCell(value, property) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (text === '') return undefined;

  const type = property?.type;
  if (type === 'number' || type === 'integer') {
    const number = Number(text.replace(/[$,]/g, ''));
    return Number.isFinite(number) ? number : undefined;
  }
  if (type === 'boolean') {
    if (/^(true|yes|1)$/i.test(text)) return true;
    if (/^(false|no|0)$/i.test(text)) return false;
    return undefined;
  }
  if (type === 'array' || type === 'object') {
    const parsed = parseLooseJson(text);
    if (parsed !== undefined && parsed !== null && typeof parsed === 'object') return parsed;
    if (type === 'array') {
      return text
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return undefined;
  }
  if (type === 'string') return value;

  // A column the schema does not know: keep it, decoding JSON if it looks like JSON.
  if (/^[[{]/.test(text)) {
    const parsed = parseLooseJson(text);
    if (parsed !== undefined) return parsed;
  }
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  return value;
}

/** Turn one row of an export into a record for the given data type. */
export function convertImportedRow(entityName, row) {
  const properties = SCHEMAS[entityName]?.properties || {};
  const record = {};
  for (const [rawKey, rawValue] of Object.entries(row || {})) {
    const key = String(rawKey).trim();
    if (!key || IGNORED_COLUMNS.has(key)) continue;
    if (key === '_id') {
      if (!record.id && rawValue) record.id = String(rawValue).trim();
      continue;
    }
    if (['id', 'created_date', 'updated_date', 'created_by'].includes(key)) {
      const text = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();
      if (text) record[key] = text;
      continue;
    }
    const converted = convertCell(rawValue, properties[key]);
    if (converted !== undefined) record[key] = converted;
  }
  return record;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('The file could not be read.'));
    reader.readAsText(file);
  });
}

/**
 * Read an export file.
 * Resolves to { kind: 'backup', json } for this app's own backups, or
 * { kind: 'rows', rows, columns } for a CSV / JSON list of records.
 */
export async function parseImportFile(file) {
  const text = (await readFileText(file)).replace(/^﻿/, '');
  const looksLikeJson = /\.json$/i.test(file.name) || /^\s*[[{]/.test(text);

  if (looksLikeJson) {
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`"${file.name}" is not valid JSON.`);
    }
    if (isBackupFile(json)) return { kind: 'backup', json };
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.records)
          ? json.records
          : Array.isArray(json?.items)
            ? json.items
            : null;
    if (!rows) throw new Error(`"${file.name}" does not contain a list of records.`);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
    return { kind: 'rows', rows, columns };
  }

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  if (!parsed.meta?.fields?.length) throw new Error(`"${file.name}" has no column headings.`);
  return { kind: 'rows', rows: parsed.data, columns: parsed.meta.fields };
}

export async function importRecords(entityName, rows) {
  if (!entities[entityName]) throw new Error(`Unknown data type: ${entityName}`);
  const records = rows
    .map((row) => convertImportedRow(entityName, row))
    .filter((record) => Object.keys(record).some((key) => !['id', 'created_date', 'updated_date', 'created_by'].includes(key)));
  if (records.length === 0) return 0;
  await removeOtherSettings(entityName, records);
  await entities[entityName].importRecords(records);
  return records.length;
}

// ---------------------------------------------------------------------------
// Photos that still live somewhere else (for example on Base44's servers)
// ---------------------------------------------------------------------------

function isExternalUrl(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  if (url.startsWith(window.location.origin)) return false;
  // Already in this app's own storage?
  if (BACKEND_MODE === 'supabase' && url.includes('/storage/v1/object/public/uploads/')) return false;
  return true;
}

async function copyOne(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const name = decodeURIComponent(url.split('/').pop().split('?')[0] || 'photo');
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  const { file_url } = await uploadFile({ file });
  return file_url;
}

/** How many photos / logos are still stored on another site. */
export async function countExternalPhotos() {
  const [items, borrowed, containers, settings] = await Promise.all([
    entities.InventoryItem.list(),
    entities.BorrowedItem.list(),
    entities.Container.list(),
    entities.AppSettings.list(),
  ]);
  let count = 0;
  [...items, ...borrowed].forEach((record) => {
    (record.photos || []).forEach((photo) => {
      if (isExternalUrl(photo?.url)) count += 1;
    });
  });
  containers.forEach((c) => {
    if (isExternalUrl(c.photo_url)) count += 1;
  });
  settings.forEach((s) => {
    if (isExternalUrl(s.logoUrl)) count += 1;
  });
  return count;
}

/** Copy every outside photo into this app's own storage and update the links. */
export async function rehostExternalPhotos({ onProgress } = {}) {
  const total = await countExternalPhotos();
  let done = 0;
  let copied = 0;
  let failed = 0;
  const tick = (ok) => {
    done += 1;
    if (ok) copied += 1;
    else failed += 1;
    onProgress?.({ stage: `Copying photo ${done} of ${total}…`, current: done, total });
  };

  for (const entityName of ['InventoryItem', 'BorrowedItem']) {
    const records = await entities[entityName].list();
    for (const record of records) {
      const photos = Array.isArray(record.photos) ? record.photos : [];
      if (!photos.some((photo) => isExternalUrl(photo?.url))) continue;
      const nextPhotos = [];
      let changed = false;
      for (const photo of photos) {
        if (!isExternalUrl(photo?.url)) {
          nextPhotos.push(photo);
          continue;
        }
        try {
          nextPhotos.push({ ...photo, url: await copyOne(photo.url) });
          changed = true;
          tick(true);
        } catch (error) {
          console.warn('Could not copy photo', photo.url, error);
          nextPhotos.push(photo);
          tick(false);
        }
      }
      if (changed) await entities[entityName].update(record.id, { photos: nextPhotos });
    }
  }

  for (const container of await entities.Container.list()) {
    if (!isExternalUrl(container.photo_url)) continue;
    try {
      await entities.Container.update(container.id, { photo_url: await copyOne(container.photo_url) });
      tick(true);
    } catch (error) {
      console.warn('Could not copy photo', container.photo_url, error);
      tick(false);
    }
  }

  for (const settings of await entities.AppSettings.list()) {
    if (!isExternalUrl(settings.logoUrl)) continue;
    try {
      await entities.AppSettings.update(settings.id, { logoUrl: await copyOne(settings.logoUrl) });
      tick(true);
    } catch (error) {
      console.warn('Could not copy logo', settings.logoUrl, error);
      tick(false);
    }
  }

  return { total, copied, failed };
}
