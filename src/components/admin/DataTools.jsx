import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, CheckCircle, Cloud, Download, FileUp, HardDrive, ImageDown, Loader2, Trash2, Upload,
} from 'lucide-react';
import { ENTITY_NAMES, IS_LOCAL_MODE } from '@/api/config';
import {
  countExternalPhotos,
  downloadJson,
  exportBackup,
  guessEntityFromFileName,
  importRecords,
  parseImportFile,
  rehostExternalPhotos,
  restoreBackup,
} from '@/api/dataTransfer';

const cardClass = 'bg-base-200/50 backdrop-blur-sm shadow-md';

// Friendlier names for the data types in the import list.
const ENTITY_LABELS = {
  InventoryItem: 'Inventory items',
  Container: 'Containers',
  Location: 'Locations',
  Category: 'Categories',
  Subcategory: 'Subcategories',
  BorrowedItem: 'Borrowed items',
  ExpendableItem: 'Expendable items',
  StockAlert: 'Stock alerts',
  Renter: 'Renters',
  RentalOrder: 'Rental orders',
  Invoice: 'Invoices',
  ReminderSchedule: 'Reminders',
  ReminderSettings: 'Reminder settings',
  AppSettings: 'App settings',
  UserRole: 'Roles',
  UserInvitation: 'Invitations',
  UserNotification: 'Notifications',
  FavoriteItem: 'Favorites',
  UserDashboard: 'Dashboard layouts',
  Department: 'Departments',
};

function Progress({ progress }) {
  if (!progress) return null;
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-base-content/80">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{progress.stage}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-base-300">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Result({ result }) {
  if (!result) return null;
  const isError = result.type === 'error';
  return (
    <Alert variant={isError ? 'destructive' : 'default'} className={isError ? '' : 'border-success/40 bg-success/10'}>
      {isError ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 text-success" />}
      <AlertDescription className={isError ? '' : 'text-base-content'}>{result.message}</AlertDescription>
    </Alert>
  );
}

export default function DataTools() {
  const restoreInputRef = useRef(null);
  const importInputRef = useRef(null);

  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);
  const [backupResult, setBackupResult] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);

  const [pendingRestore, setPendingRestore] = useState(null); // { fileName, json, total }
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importFiles, setImportFiles] = useState([]); // [{ fileName, entity, rows, columns }]
  const [externalPhotoCount, setExternalPhotoCount] = useState(null);

  const refreshPhotoCount = () => {
    countExternalPhotos()
      .then(setExternalPhotoCount)
      .catch(() => setExternalPhotoCount(null));
  };

  useEffect(() => {
    refreshPhotoCount();
  }, []);

  const run = async (name, work) => {
    setBusy(name);
    setProgress(null);
    try {
      await work();
    } finally {
      setBusy('');
      setProgress(null);
    }
  };

  // ----- backup ------------------------------------------------------------
  const handleBackup = () =>
    run('backup', async () => {
      setBackupResult(null);
      try {
        const backup = await exportBackup({ onProgress: setProgress });
        const total = Object.values(backup.entities).reduce((sum, rows) => sum + rows.length, 0);
        const stamp = new Date().toISOString().slice(0, 10);
        downloadJson(backup, `theatre-inventory-backup-${stamp}.json`);
        setBackupResult({ type: 'success', message: `Backup downloaded — ${total} records.` });
      } catch (error) {
        setBackupResult({ type: 'error', message: error?.message || 'The backup could not be created.' });
      }
    });

  // ----- restore -----------------------------------------------------------
  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRestoreResult(null);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.kind !== 'backup') {
        throw new Error('That file is not a backup made by this app. Use "Import data" below for other files.');
      }
      const total = Object.values(parsed.json.entities).reduce(
        (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
        0
      );
      setPendingRestore({ fileName: file.name, json: parsed.json, total });
    } catch (error) {
      setPendingRestore(null);
      setRestoreResult({ type: 'error', message: error?.message || 'The file could not be read.' });
    }
  };

  const handleRestore = () =>
    run('restore', async () => {
      try {
        const summary = await restoreBackup(pendingRestore.json, { replaceExisting, onProgress: setProgress });
        const total = Object.values(summary).reduce((sum, n) => sum + n, 0);
        setRestoreResult({
          type: 'success',
          message: `Restored ${total} records from ${pendingRestore.fileName}. Reload the page to see everything.`,
        });
        setPendingRestore(null);
        setReplaceExisting(false);
        refreshPhotoCount();
      } catch (error) {
        setRestoreResult({ type: 'error', message: error?.message || 'The backup could not be restored.' });
      }
    });

  // ----- import ------------------------------------------------------------
  const handleImportFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    setImportResult(null);
    const parsedFiles = [];
    const problems = [];
    for (const file of files) {
      try {
        const parsed = await parseImportFile(file);
        if (parsed.kind === 'backup') {
          problems.push(`${file.name} is a backup file — use "Restore a backup" for it.`);
          continue;
        }
        parsedFiles.push({
          fileName: file.name,
          entity: guessEntityFromFileName(file.name),
          rows: parsed.rows,
          columns: parsed.columns,
        });
      } catch (error) {
        problems.push(error?.message || `${file.name} could not be read.`);
      }
    }
    setImportFiles((current) => [...current, ...parsedFiles]);
    if (problems.length > 0) setImportResult({ type: 'error', message: problems.join(' ') });
  };

  const setImportEntity = (index, entity) =>
    setImportFiles((current) => current.map((entry, i) => (i === index ? { ...entry, entity } : entry)));

  const removeImportFile = (index) => setImportFiles((current) => current.filter((_, i) => i !== index));

  const handleImport = () =>
    run('import', async () => {
      setImportResult(null);
      const done = [];
      try {
        for (let i = 0; i < importFiles.length; i += 1) {
          const entry = importFiles[i];
          setProgress({
            stage: `Importing ${entry.fileName} (${entry.rows.length} rows)…`,
            current: i,
            total: importFiles.length,
          });
          const count = await importRecords(entry.entity, entry.rows);
          done.push(`${count} ${ENTITY_LABELS[entry.entity] || entry.entity}`);
        }
        setImportFiles([]);
        setImportResult({
          type: 'success',
          message: `Imported ${done.join(', ')}. Reload the page to see everything.`,
        });
        refreshPhotoCount();
      } catch (error) {
        setImportResult({
          type: 'error',
          message: `${error?.message || 'The import failed.'}${done.length ? ` (Already imported: ${done.join(', ')}.)` : ''}`,
        });
      }
    });

  // ----- photos ------------------------------------------------------------
  const handleCopyPhotos = () =>
    run('photos', async () => {
      setPhotoResult(null);
      try {
        const { copied, failed } = await rehostExternalPhotos({ onProgress: setProgress });
        setPhotoResult({
          type: failed > 0 && copied === 0 ? 'error' : 'success',
          message:
            failed > 0
              ? `Copied ${copied} photo${copied === 1 ? '' : 's'}; ${failed} could not be fetched and still point to the old address.`
              : `Copied ${copied} photo${copied === 1 ? '' : 's'} into this app.`,
        });
        refreshPhotoCount();
      } catch (error) {
        setPhotoResult({ type: 'error', message: error?.message || 'The photos could not be copied.' });
      }
    });

  const importReady = importFiles.length > 0 && importFiles.every((entry) => entry.entity);
  const StorageIcon = IS_LOCAL_MODE ? HardDrive : Cloud;

  return (
    <div className="space-y-8">
      {/* Where the data lives */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <StorageIcon className="h-5 w-5 text-primary" />
            {IS_LOCAL_MODE ? 'Data is stored on this device' : 'Data is stored in the shared database'}
          </CardTitle>
          <CardDescription>
            {IS_LOCAL_MODE
              ? 'Everything is kept in this browser on this computer or phone. Other devices will not see it, and clearing the browser\'s site data erases it — download a backup regularly. To share one inventory between people and devices, switch on the shared database (see README.md, "Shared mode").'
              : 'Everyone who signs in sees the same inventory. Photos are kept in the project\'s storage. A backup file is still a good idea before big changes.'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Backup */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle>Back up</CardTitle>
          <CardDescription>
            Download every record as one file you can keep somewhere safe.
            {IS_LOCAL_MODE ? ' Photos are included.' : ' Photos stay in storage; the file keeps their links.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleBackup} disabled={Boolean(busy)} className="bg-primary text-primary-content hover:bg-primary-focus">
            {busy === 'backup' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download backup
          </Button>
          {busy === 'backup' && <Progress progress={progress} />}
          <Result result={backupResult} />
        </CardContent>
      </Card>

      {/* Restore */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle>Restore a backup</CardTitle>
          <CardDescription>
            Put the records from a backup file back. Records with the same id are overwritten; nothing else is touched
            unless you choose to remove the current data first. User accounts are not changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreFile} />
          <Button variant="outline" onClick={() => restoreInputRef.current?.click()} disabled={Boolean(busy)}>
            <Upload className="mr-2 h-4 w-4" /> Choose backup file
          </Button>

          {pendingRestore && (
            <div className="space-y-4 rounded-lg border border-base-300 bg-base-100 p-4">
              <p className="text-sm text-base-content">
                <span className="font-medium break-all">{pendingRestore.fileName}</span> — {pendingRestore.total} records
                {pendingRestore.json.exported_at &&
                  `, saved ${new Date(pendingRestore.json.exported_at).toLocaleString()}`}
              </p>
              <label className="flex items-start gap-2 text-sm text-base-content">
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                />
                <span>
                  Remove the current data first
                  <span className="block text-xs text-base-content/60">
                    Deletes every record that is in the app now before restoring. This cannot be undone.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleRestore}
                  disabled={Boolean(busy)}
                  className={replaceExisting ? 'bg-error text-error-content hover:bg-error-focus' : 'bg-primary text-primary-content hover:bg-primary-focus'}
                >
                  {busy === 'restore' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {replaceExisting ? 'Replace everything with this backup' : 'Restore this backup'}
                </Button>
                <Button variant="ghost" onClick={() => setPendingRestore(null)} disabled={Boolean(busy)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {busy === 'restore' && <Progress progress={progress} />}
          <Result result={restoreResult} />
        </CardContent>
      </Card>

      {/* Import */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle>Import data</CardTitle>
          <CardDescription>
            Bring in the files you exported from Base44 (one CSV or JSON file per data type), or any spreadsheet saved as
            CSV whose column headings match the field names. Ids are kept, so links between records — and QR labels you
            have already printed — keep working. Importing the same file twice updates the records instead of
            duplicating them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            multiple
            className="hidden"
            onChange={handleImportFiles}
          />
          <Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={Boolean(busy)}>
            <FileUp className="mr-2 h-4 w-4" /> Choose files
          </Button>

          {importFiles.length > 0 && (
            <ul className="space-y-3">
              {importFiles.map((entry, index) => (
                <li
                  key={`${entry.fileName}-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-base-content break-all">{entry.fileName}</p>
                    <p className="text-xs text-base-content/60">
                      {entry.rows.length} rows · {entry.columns.length} columns
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={entry.entity || undefined} onValueChange={(value) => setImportEntity(index, value)}>
                      <SelectTrigger className="w-56 bg-base-100" aria-label={`Data type for ${entry.fileName}`}>
                        <SelectValue placeholder="What is in this file?" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_NAMES.map((name) => (
                          <SelectItem key={name} value={name}>
                            {ENTITY_LABELS[name] || name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeImportFile(index)}
                      disabled={Boolean(busy)}
                      aria-label={`Remove ${entry.fileName}`}
                    >
                      <Trash2 className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {importFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleImport}
                disabled={Boolean(busy) || !importReady}
                className="bg-primary text-primary-content hover:bg-primary-focus"
              >
                {busy === 'import' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {importFiles.length} file{importFiles.length === 1 ? '' : 's'}
              </Button>
              {!importReady && (
                <span className="text-sm text-base-content/70">Choose what each file contains to continue.</span>
              )}
            </div>
          )}
          {busy === 'import' && <Progress progress={progress} />}
          <Result result={importResult} />
        </CardContent>
      </Card>

      {/* Photos hosted elsewhere */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle>Copy photos into this app</CardTitle>
          <CardDescription>
            Imported records keep pointing at photos on the site they came from. Those links stop working if that site
            is shut down, so copy the photos here while they are still reachable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-base-content">
            {externalPhotoCount === null
              ? 'Checking for photos stored elsewhere…'
              : externalPhotoCount === 0
                ? 'All photos are already stored in this app.'
                : `${externalPhotoCount} photo${externalPhotoCount === 1 ? ' is' : 's are'} still stored on another site.`}
          </p>
          <Button variant="outline" onClick={handleCopyPhotos} disabled={Boolean(busy) || !externalPhotoCount}>
            {busy === 'photos' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
            Copy photos now
          </Button>
          {busy === 'photos' && <Progress progress={progress} />}
          <Result result={photoResult} />
        </CardContent>
      </Card>
    </div>
  );
}
