import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Search, Tags, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppSettings } from '../components/shared/AppSettingsContext';
import { useData } from '../components/shared/DataManager';
import { qrCodeDataUrl } from '@/lib/qr';
import { barcodeDataUrl } from '@/lib/barcode';
import {
  DEFAULT_CUSTOM, LABEL_FORMATS, labelsPerPage, layoutWarning, resolveFormat,
} from '@/lib/labelFormats';
import { getAppUrl } from '@/utils';

// ---------------------------------------------------------------------------
// Settings (remembered in this browser)
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'theatre-inventory-label-settings-v1';
const SELECTION_KEY = 'theatre-inventory-label-selection';

const DEFAULT_SETTINGS = {
  formatId: 'hangtag-3x1.5',
  custom: DEFAULT_CUSTOM,
  showQr: true,
  showBarcode: false,
  showHeader: true,
  headerText: 'Culver-Stockton College Theatre Department',
  showLogo: true,
  showName: true,
  showUid: true,
  showLocation: true,
  showCategory: true,
  showSizeColor: false,
  showCondition: false,
  copies: 1,
  startAt: 1,
  nudgeX: 0,
  nudgeY: 0,
  cutLines: true,
  rollLengths: {}, // chosen tag length per continuous-roll size
  receiptStrip: false, // receipt printers: one continuous strip instead of one tag per page
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return saved ? { ...DEFAULT_SETTINGS, ...saved, custom: { ...DEFAULT_CUSTOM, ...(saved.custom || {}) } } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadSavedSelection() {
  try {
    const ids = JSON.parse(sessionStorage.getItem(SELECTION_KEY) || '[]');
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const titleCase = (text) => String(text || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// What a QR code on an item's label opens: its own code, or the item's page.
const itemQrData = (item) =>
  item.qr_code || getAppUrl(`ItemDetails?id=${item.id}${item.uid ? `&uid=${item.uid}` : ''}`);

// What the barcode holds: the item's UID (scanning it finds the item).
const itemBarcodeData = (item) => item.uid || item.id;

// ---------------------------------------------------------------------------
// One label
// ---------------------------------------------------------------------------

function ItemLabel({ item, format, settings, logoUrl, containerName, showCutLine }) {
  const { w, h } = format.label;
  const pad = clamp(Math.min(w, h) * 0.07, 0.04, 0.15);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const tiny = h < 0.75; // e.g. ½" labels: only the essentials fit
  const landscape = w / h >= 1.25;

  // Hang tags get a hole-punch mark (left on wide tags, top on tall ones);
  // the content keeps clear of it.
  const hole = format.holePunch && !tiny ? clamp(Math.min(w, h) * 0.09, 0.12, 0.22) : 0;

  // --- code areas ---------------------------------------------------------
  const showQr = settings.showQr;
  const showBarcode = settings.showBarcode;
  const holeLeft = landscape ? hole : 0;
  const holeTop = landscape ? 0 : hole;
  let qrSize = 0;
  let qrPlacement = 'right';
  if (showQr) {
    if (landscape) {
      qrSize = Math.min(innerH, innerW * (tiny ? 0.3 : 0.42));
      qrPlacement = 'right';
    } else {
      qrSize = Math.min(innerW * 0.8, (innerH - holeTop) * (showBarcode ? 0.45 : 0.55));
      qrPlacement = 'top';
    }
  }
  const gap = Math.min(0.08, pad);
  const textW = qrPlacement === 'right' && showQr ? innerW - qrSize - gap - holeLeft : innerW - holeLeft;
  const textH = (showQr && qrPlacement === 'top' ? innerH - qrSize - gap : innerH) - holeTop;
  const barcodeH = showBarcode ? clamp(textH * (tiny ? 0.45 : 0.28), 0.18, 0.7) : 0;

  // --- type sizes (points) -------------------------------------------------
  let nameSize = clamp(Math.min(textH * 72 * 0.2, textW * 72 / 7), 5.5, 22);
  const infoSize = clamp(nameSize * 0.68, 4.5, 12);
  // The UID under the code shrinks so it always fits on one line
  // (monospace letters are about 0.6 of the type size wide).
  const codeText = String(showBarcode ? itemBarcodeData(item) : item.uid || '');
  const codeTextSize = clamp(Math.min(infoSize * 0.95, (textW * 72) / (Math.max(codeText.length, 1) * 0.7)), 4, 11);
  const lineH = (pt, spacing) => (pt * spacing) / 72; // inches per line

  // --- lines of information -------------------------------------------------
  let lines = [];
  if (!tiny) {
    const where = [item.location, containerName].filter(Boolean).join(' · ');
    if (settings.showLocation && where) lines.push(['Location', where]);
    const categories = (item.categories?.length ? item.categories : [item.category]).filter(Boolean);
    if (settings.showCategory && categories.length) lines.push(['Type', categories.map(titleCase).join(', ')]);
    const sizeColor = [item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ');
    if (settings.showSizeColor && sizeColor) lines.push(['', sizeColor]);
    if (settings.showCondition && item.condition) lines.push(['Condition', titleCase(item.condition)]);
  }
  const uidText = item.uid || '';
  const showUidLine = settings.showUid && uidText && !(showBarcode && tiny);
  const showCodeText = showUidLine || (showBarcode && !settings.showUid && !tiny);

  let header = settings.showHeader && !tiny && h >= 1 ? settings.headerText : '';
  let logo = settings.showLogo && !tiny && h >= 1 && logoUrl ? logoUrl : '';

  // Fit: keep only as many whole lines as there is room for, so nothing is
  // cut in half or runs into the barcode.
  const bottomH = (showBarcode ? barcodeH + 0.02 : 0) + (showCodeText ? lineH(codeTextSize, 1.15) : 0);
  let room = textH - bottomH;
  let headerH = header || logo ? lineH(infoSize * 0.85, 1.15) + 0.02 : 0;
  const nameLineH = () => lineH(nameSize, 1.1);
  if (settings.showName && room - headerH < nameLineH()) {
    header = '';
    logo = '';
    headerH = 0;
  }
  let nameLines = 0;
  if (settings.showName) {
    if (room < nameLineH()) nameSize = clamp((room * 72) / 1.1, 4.5, nameSize);
    nameLines = clamp(Math.floor((room - headerH) / nameLineH()), 1, tiny ? 1 : 2);
  }
  room -= headerH + nameLines * nameLineH();
  const infoLines = Math.max(0, Math.floor((room + 0.005) / lineH(infoSize, 1.2)));
  lines = lines.slice(0, infoLines);

  const qrImage = showQr ? (
    <img
      src={qrCodeDataUrl(itemQrData(item))}
      alt=""
      style={{ width: `${qrSize}in`, height: `${qrSize}in`, flex: 'none', imageRendering: 'pixelated' }}
    />
  ) : null;

  return (
    <div
      className="label-box"
      style={{
        width: `${w}in`,
        height: `${h}in`,
        padding: `${pad}in`,
        paddingTop: `${pad + holeTop}in`,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        color: '#000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        ...(showCutLine === true ? { border: '1px dashed #9ca3af' } : {}),
        ...(showCutLine === 'bottom' ? { borderBottom: '1px dashed #000' } : {}),
        display: 'flex',
        flexDirection: qrPlacement === 'top' && showQr ? 'column' : 'row',
        alignItems: qrPlacement === 'top' && showQr ? 'center' : 'stretch',
        gap: `${gap}in`,
      }}
    >
      {hole > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: landscape ? `${pad * 0.6}in` : '50%',
            top: landscape ? '50%' : `${pad * 0.6}in`,
            width: `${hole * 0.6}in`,
            height: `${hole * 0.6}in`,
            marginTop: landscape ? `-${hole * 0.3}in` : 0,
            marginLeft: landscape ? 0 : `-${hole * 0.3}in`,
            borderRadius: '50%',
            border: '1px solid #9ca3af',
          }}
        />
      )}

      {qrPlacement === 'top' && qrImage}

      {/* Text (and barcode) */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          width: qrPlacement === 'top' ? '100%' : undefined,
          marginLeft: `${holeLeft}in`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          textAlign: qrPlacement === 'top' ? 'center' : 'left',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
          {(header || logo) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: qrPlacement === 'top' ? 'center' : 'flex-start',
                gap: '0.04in',
                fontSize: `${infoSize * 0.85}pt`,
                lineHeight: 1.15,
                fontWeight: 600,
                marginBottom: '0.02in',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {logo && <img src={logo} alt="" style={{ height: `${infoSize * 1.2}pt`, width: 'auto', objectFit: 'contain' }} />}
              {header && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{header}</span>}
            </div>
          )}
          {settings.showName && (
            <div
              style={{
                fontSize: `${nameSize}pt`,
                fontWeight: 700,
                lineHeight: 1.1,
                display: '-webkit-box',
                WebkitLineClamp: nameLines || 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {item.name}
            </div>
          )}
          {lines.map(([labelText, value]) => (
            <div
              key={`${labelText}-${value}`}
              style={{
                fontSize: `${infoSize}pt`,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {labelText && <strong>{labelText}: </strong>}
              {value}
            </div>
          ))}
        </div>

        <div style={{ flex: 'none' }}>
          {showBarcode && (
            <img
              src={barcodeDataUrl(itemBarcodeData(item))}
              alt=""
              style={{ display: 'block', width: '100%', height: `${barcodeH}in`, marginTop: '0.02in' }}
            />
          )}
          {showCodeText && (
            <div
              style={{
                fontSize: `${codeTextSize}pt`,
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                
              }}
            >
              {showBarcode ? itemBarcodeData(item) : uidText}
            </div>
          )}
        </div>
      </div>

      {qrPlacement === 'right' && qrImage && <div style={{ display: 'flex', alignItems: 'center' }}>{qrImage}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PrintHangTags() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSettings } = useAppSettings();
  const { items: allItems, containers, isLoading } = useData();

  const [settings, setSettings] = useState(loadSettings);
  const [selectedIds, setSelectedIds] = useState(() => {
    const passed = location.state?.items;
    if (Array.isArray(passed) && passed.length) return passed.map((i) => i.id);
    const fromUrl = new URLSearchParams(location.search).get('ids');
    if (fromUrl) return fromUrl.split(',').filter(Boolean);
    return loadSavedSelection();
  });
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* not important */
    }
  }, [settings]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selectedIds));
    } catch {
      /* not important */
    }
  }, [selectedIds]);

  const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const setCustom = (key, value) => setSettings((prev) => ({ ...prev, custom: { ...prev.custom, [key]: value } }));

  const rollLength = settings.rollLengths?.[settings.formatId];
  const format = useMemo(
    () => resolveFormat(settings.formatId, settings.custom, rollLength),
    [settings.formatId, settings.custom, rollLength]
  );
  const setRollLength = (value) =>
    setSettings((prev) => ({ ...prev, rollLengths: { ...(prev.rollLengths || {}), [prev.formatId]: value } }));
  // Receipt printers can print every tag on one long strip.
  const stripMode = Boolean(format.receipt && settings.receiptStrip);
  const warning = layoutWarning(format);
  const perPage = labelsPerPage(format);

  // Items passed in from another page are used straight away, even before
  // the full inventory list has loaded.
  const itemsById = useMemo(() => {
    const map = new Map((allItems || []).map((i) => [i.id, i]));
    (location.state?.items || []).forEach((i) => {
      if (!map.has(i.id)) map.set(i.id, i);
    });
    return map;
  }, [allItems, location.state]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => itemsById.get(id)).filter(Boolean),
    [selectedIds, itemsById]
  );

  const containerNames = useMemo(() => new Map((containers || []).map((c) => [c.id, c.name])), [containers]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (allItems || []).filter((item) => {
      if (!term) return true;
      return [item.name, item.uid, item.location, ...(item.categories || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
    return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [allItems, search]);

  const toggleItem = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Copies, and blank spaces for labels already used on a partly used sheet.
  const copies = clamp(Math.round(Number(settings.copies) || 1), 1, 50);
  const skip = format.kind === 'sheet' ? clamp(Math.round(Number(settings.startAt) || 1), 1, perPage) - 1 : 0;
  const slots = useMemo(() => {
    const list = Array.from({ length: skip }, () => null);
    selectedItems.forEach((item) => {
      for (let i = 0; i < copies; i += 1) list.push(item);
    });
    return list;
  }, [selectedItems, copies, skip]);

  const pages = useMemo(() => {
    if (stripMode) return slots.length ? [slots] : [];
    const result = [];
    for (let i = 0; i < slots.length; i += perPage) result.push(slots.slice(i, i + perPage));
    return result;
  }, [slots, perPage, stripMode]);

  const labelCount = slots.length - skip;
  const pageW = format.kind === 'sheet' ? format.page.w : format.paper?.w || format.label.w;
  const pageH =
    format.kind === 'sheet'
      ? format.page.h
      : stripMode
        ? Math.max(1, slots.length) * format.label.h + 0.5 // a little paper at the end for tearing off
        : format.label.h;
  // Receipt paper is wider than the area the printer can reach; centre the tag.
  const rollOffsetX = format.kind === 'sheet' ? 0 : (pageW - format.label.w) / 2;
  const nudgeX = clamp(Number(settings.nudgeX) || 0, -0.5, 0.5);
  const nudgeY = clamp(Number(settings.nudgeY) || 0, -0.5, 0.5);
  const showCutLines = format.kind === 'sheet' && (format.id === 'custom' ? format.cutLines : format.cutLines && settings.cutLines);

  // Fit the preview to the screen.
  const previewZoom = clamp(560 / (pageW * 96), 0.25, 1.4);

  const numberField = (id, labelText, value, onChange, step = 0.01) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{labelText}</Label>
      <Input id={id} type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 bg-base-100" />
    </div>
  );

  const checkboxField = (key, labelText) => (
    <label key={key} className="flex items-center gap-2 text-sm text-base-content cursor-pointer">
      <Checkbox checked={Boolean(settings[key])} onCheckedChange={(checked) => set(key, Boolean(checked))} />
      {labelText}
    </label>
  );

  const groups = [...new Set(LABEL_FORMATS.map((f) => f.group))];

  return (
    <div className="min-h-screen bg-base-200 print:bg-white">
      <style>{`
        @page { size: ${pageW}in ${pageH}in; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          .label-page { zoom: 1 !important; box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }
          .label-page:last-child { break-after: auto; page-break-after: auto; }
          .label-layout { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .label-preview { display: block !important; padding: 0 !important; gap: 0 !important; }
          img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 border-b border-base-300 bg-base-100 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-base-content">
                <Tags className="h-5 w-5 text-primary" /> Labels &amp; Hang Tags
              </h1>
              <p className="text-sm text-base-content/70">
                {labelCount} label{labelCount === 1 ? '' : 's'} on {pages.length} page{pages.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.print()}
            disabled={labelCount === 0 || Boolean(warning)}
            className="bg-primary text-primary-content hover:bg-primary-focus"
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div className="label-layout mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:items-start">
        {/* Settings */}
        <div className="no-print w-full space-y-5 lg:w-96 lg:flex-none">
          {/* 1. Items */}
          <section className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base-content">1. Items ({selectedItems.length} chosen)</h2>
              {selectedIds.length > 0 && (
                <button type="button" className="text-sm text-primary hover:underline" onClick={() => setSelectedIds([])}>
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-base-content/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find items by name, UID, location…"
                className="h-9 bg-base-100 pl-8"
              />
            </div>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setSelectedIds((prev) => [...new Set([...prev, ...searchResults.map((i) => i.id)])])}
              >
                Add all {search ? 'found' : 'items'} ({searchResults.length})
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-base-300">
              {isLoading && searchResults.length === 0 ? (
                <p className="p-3 text-sm text-base-content/60">Loading items…</p>
              ) : searchResults.length === 0 ? (
                <p className="p-3 text-sm text-base-content/60">No items match.</p>
              ) : (
                searchResults.slice(0, 300).map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-base-200 px-3 py-2 text-sm last:border-b-0 hover:bg-base-200"
                  >
                    <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base-content">{item.name}</span>
                      <span className="block truncate font-mono text-xs text-base-content/60">{item.uid || '—'}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>

          {/* 2. Size */}
          <section className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <h2 className="font-semibold text-base-content">2. Label or tag size</h2>
            <Select value={settings.formatId} onValueChange={(value) => set('formatId', value)}>
              <SelectTrigger className="bg-base-100" aria-label="Label or tag size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {LABEL_FORMATS.filter((f) => f.group === group).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {settings.formatId === 'custom' && (
              <div className="space-y-3 rounded-lg bg-base-200 p-3">
                <div className="flex gap-4 text-sm">
                  {[['sheet', 'Sheet of labels'], ['roll', 'Label printer']].map(([value, text]) => (
                    <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="custom-kind"
                        checked={settings.custom.kind === value}
                        onChange={() => setCustom('kind', value)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      {text}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {numberField('c-w', 'Label width (in)', settings.custom.w, (v) => setCustom('w', v))}
                  {numberField('c-h', 'Label height (in)', settings.custom.h, (v) => setCustom('h', v))}
                  {settings.custom.kind === 'sheet' && (
                    <>
                      {numberField('c-cols', 'Columns', settings.custom.cols, (v) => setCustom('cols', v), 1)}
                      {numberField('c-rows', 'Rows', settings.custom.rows, (v) => setCustom('rows', v), 1)}
                      {numberField('c-top', 'Top margin (in)', settings.custom.top, (v) => setCustom('top', v))}
                      {numberField('c-left', 'Left margin (in)', settings.custom.left, (v) => setCustom('left', v))}
                      {numberField('c-gx', 'Space between columns', settings.custom.gapX, (v) => setCustom('gapX', v))}
                      {numberField('c-gy', 'Space between rows', settings.custom.gapY, (v) => setCustom('gapY', v))}
                    </>
                  )}
                </div>
                {settings.custom.kind === 'sheet' && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={Boolean(settings.custom.cutLines)} onCheckedChange={(c) => setCustom('cutLines', Boolean(c))} />
                    Show cutting lines
                  </label>
                )}
              </div>
            )}

            {format.adjustableLength && (
              <div className="grid grid-cols-2 gap-2">
                {numberField('roll-length', 'Length of each tag (in)', rollLength ?? format.label.h, setRollLength, 0.25)}
                <p className="self-end pb-1 text-xs text-base-content/60">
                  Width {format.label.w}"{format.receipt ? ` (printable area of ${format.paper.w}" paper)` : ''}
                </p>
              </div>
            )}

            {format.receipt && (
              <div className="space-y-2 text-sm">
                {[
                  [false, 'Cut after each tag', 'One tag per page — set the printer to cut after each page.'],
                  [true, 'One continuous strip', 'All tags on one strip with dashed lines between them, to cut by hand.'],
                ].map(([value, title, hint]) => (
                  <label key={title} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="receipt-mode"
                      className="mt-1"
                      checked={Boolean(settings.receiptStrip) === value}
                      onChange={() => set('receiptStrip', value)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>
                      <span className="font-medium text-base-content">{title}</span>
                      <span className="block text-xs text-base-content/60">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {warning && (
              <Alert variant="destructive">
                <AlertDescription>{warning}</AlertDescription>
              </Alert>
            )}
          </section>

          {/* 3. Content */}
          <section className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <h2 className="font-semibold text-base-content">3. What to print</h2>
            <div className="grid grid-cols-2 gap-2">
              {checkboxField('showQr', 'QR code')}
              {checkboxField('showBarcode', 'Barcode')}
              {checkboxField('showName', 'Item name')}
              {checkboxField('showUid', 'UID')}
              {checkboxField('showLocation', 'Location')}
              {checkboxField('showCategory', 'Category')}
              {checkboxField('showSizeColor', 'Size & colour')}
              {checkboxField('showCondition', 'Condition')}
              {checkboxField('showHeader', 'Heading')}
              {checkboxField('showLogo', 'Logo')}
            </div>
            {settings.showHeader && (
              <div className="space-y-1">
                <Label htmlFor="header-text" className="text-xs">Heading text</Label>
                <Input
                  id="header-text"
                  value={settings.headerText}
                  onChange={(e) => set('headerText', e.target.value)}
                  className="h-8 bg-base-100"
                />
              </div>
            )}
            <p className="text-xs text-base-content/60">
              The QR code opens the item's page; the barcode holds its UID. Both work with the scanner in the app.
              Very small labels show only the name and code.
            </p>
          </section>

          {/* 4. Printing */}
          <section className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
            <h2 className="font-semibold text-base-content">4. Printing</h2>
            <div className="grid grid-cols-2 gap-2">
              {numberField('copies', 'Copies of each item', settings.copies, (v) => set('copies', v), 1)}
              {format.kind === 'sheet' &&
                numberField('start-at', `Start at label (1–${perPage})`, settings.startAt, (v) => set('startAt', v), 1)}
              {numberField('nudge-x', 'Nudge right (in)', settings.nudgeX, (v) => set('nudgeX', v))}
              {numberField('nudge-y', 'Nudge down (in)', settings.nudgeY, (v) => set('nudgeY', v))}
            </div>
            {format.kind === 'sheet' && format.id !== 'custom' && format.cutLines && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={Boolean(settings.cutLines)} onCheckedChange={(c) => set('cutLines', Boolean(c))} />
                Show cutting lines
              </label>
            )}
            <div className="flex gap-2 rounded-lg bg-info/10 p-3 text-xs text-base-content/80">
              <Info className="mt-0.5 h-4 w-4 flex-none text-info-content" />
              <div className="space-y-1">
                <p>In the print window choose <strong>Scale: 100%</strong> (or "Actual size"), <strong>Margins: None</strong>, and turn <strong>Headers and footers off</strong>.</p>
                {format.kind === 'sheet' ? (
                  <p>Print one test page on plain paper and hold it over a label sheet against the light. If it is off, use Nudge. "Start at label" skips labels already used on a sheet (counting across, then down).</p>
                ) : format.receipt ? (
                  <>
                    <p>
                      Pick the receipt printer in the print window. Under <strong>More settings → Paper size</strong> choose its
                      {' '}{format.id === 'receipt-58' ? '58 mm' : '80 mm'} roll size (often called "Roll paper" or "Receipt").
                    </p>
                    <p>
                      Receipt printers print in black only and need their maker's driver installed on the computer
                      (Epson TM, Star, etc.); a printer that only works with a shop's till app cannot be used from a web page.
                    </p>
                  </>
                ) : (
                  <p>
                    Pick the label printer in the print window and set its paper size to {format.label.w}" × {format.label.h}"
                    {' '}(DYMO, Zebra, Rollo and Brother all list their label sizes there once the printer's driver is installed).
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Preview / printed pages */}
        <div className="label-preview flex min-w-0 flex-1 flex-col items-center gap-6">
          {labelCount === 0 ? (
            <div className="no-print w-full rounded-xl border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/70">
              Choose items on the left to see their labels here.
            </div>
          ) : (
            pages.map((pageSlots, pageIndex) => (
              <div
                key={pageIndex}
                className="label-page"
                style={{
                  width: `${pageW}in`,
                  height: `${pageH}in`,
                  position: 'relative',
                  overflow: 'hidden',
                  background: '#fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  zoom: previewZoom,
                  flex: 'none',
                }}
              >
                {pageSlots.map((item, slotIndex) => {
                  let left = nudgeX + rollOffsetX;
                  let top = nudgeY + (stripMode ? slotIndex * format.label.h : 0);
                  if (format.kind === 'sheet') {
                    const col = slotIndex % format.cols;
                    const row = Math.floor(slotIndex / format.cols);
                    left += format.left + col * (format.label.w + format.gapX);
                    top += format.top + row * (format.label.h + format.gapY);
                  }
                  return (
                    <div
                      key={slotIndex}
                      style={{ position: 'absolute', left: `${left}in`, top: `${top}in`, width: `${format.label.w}in`, height: `${format.label.h}in` }}
                    >
                      {item && (
                        <ItemLabel
                          item={item}
                          format={format}
                          settings={settings}
                          logoUrl={appSettings?.logoUrl}
                          containerName={item.container_id ? containerNames.get(item.container_id) : ''}
                          showCutLine={showCutLines || (stripMode && slotIndex < pageSlots.length - 1 ? 'bottom' : false)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
