// Label and tag sizes the print page offers. All measurements are in inches.
//
// "sheet" formats print several labels on a US Letter page (8.5" × 11").
// "roll" formats print one label per page, for label printers (DYMO, Zebra,
// Rollo, Brother …) — choose the matching paper size in the print dialog.
//
// The Avery layouts follow Avery's published templates. Printers differ
// slightly, so print one test sheet on plain paper and hold it against a
// label sheet; the "Nudge" settings move everything if needed.

const LETTER = { w: 8.5, h: 11 };

export const LABEL_FORMATS = [
  {
    id: 'hangtag-3x1.5',
    group: 'Hang tags (cardstock, cut out)',
    name: 'Hang tag 3" × 1.5" — 12 per sheet',
    kind: 'sheet', page: LETTER, label: { w: 3, h: 1.5 },
    cols: 2, rows: 6, top: 0.375, left: 1.125, gapX: 0.25, gapY: 0.25, cutLines: true, holePunch: true,
  },
  {
    id: 'hangtag-bizcard',
    group: 'Hang tags (cardstock, cut out)',
    name: 'Hang tag 3.5" × 2" — business-card stock, 10 per sheet (Avery 5371 / 8371)',
    kind: 'sheet', page: LETTER, label: { w: 3.5, h: 2 },
    cols: 2, rows: 5, top: 0.5, left: 0.75, gapX: 0, gapY: 0, holePunch: true,
  },
  {
    id: 'hangtag-quarter',
    group: 'Hang tags (cardstock, cut out)',
    name: 'Large tag 4.25" × 5.5" — 4 per sheet (cut in quarters)',
    kind: 'sheet', page: LETTER, label: { w: 4.25, h: 5.5 },
    cols: 2, rows: 2, top: 0, left: 0, gapX: 0, gapY: 0, cutLines: true, holePunch: true,
  },
  {
    id: 'avery-5167',
    group: 'Sticker labels (Avery sheets)',
    name: 'Mini 1¾" × ½" — 80 per sheet (Avery 5167 / 8167)',
    kind: 'sheet', page: LETTER, label: { w: 1.75, h: 0.5 },
    cols: 4, rows: 20, top: 0.5, left: 0.28125, gapX: 0.3125, gapY: 0,
  },
  {
    id: 'avery-5160',
    group: 'Sticker labels (Avery sheets)',
    name: 'Address 2⅝" × 1" — 30 per sheet (Avery 5160 / 8160)',
    kind: 'sheet', page: LETTER, label: { w: 2.625, h: 1 },
    cols: 3, rows: 10, top: 0.5, left: 0.1875, gapX: 0.125, gapY: 0,
  },
  {
    id: 'avery-5161',
    group: 'Sticker labels (Avery sheets)',
    name: 'Address 4" × 1" — 20 per sheet (Avery 5161 / 8161)',
    kind: 'sheet', page: LETTER, label: { w: 4, h: 1 },
    cols: 2, rows: 10, top: 0.5, left: 0.15625, gapX: 0.1875, gapY: 0,
  },
  {
    id: 'avery-22806',
    group: 'Sticker labels (Avery sheets)',
    name: 'Square 2" × 2" — 12 per sheet (Avery 22806)',
    kind: 'sheet', page: LETTER, label: { w: 2, h: 2 },
    cols: 3, rows: 4, top: 0.625, left: 0.625, gapX: 0.625, gapY: 0.5833,
  },
  {
    id: 'avery-5163',
    group: 'Sticker labels (Avery sheets)',
    name: 'Shipping 4" × 2" — 10 per sheet (Avery 5163 / 8163)',
    kind: 'sheet', page: LETTER, label: { w: 4, h: 2 },
    cols: 2, rows: 5, top: 0.5, left: 0.15625, gapX: 0.1875, gapY: 0,
  },
  {
    id: 'avery-5164',
    group: 'Sticker labels (Avery sheets)',
    name: 'Shipping 4" × 3⅓" — 6 per sheet (Avery 5164 / 8164)',
    kind: 'sheet', page: LETTER, label: { w: 4, h: 3.3333 },
    cols: 2, rows: 3, top: 0.5, left: 0.15625, gapX: 0.1875, gapY: 0,
  },
  {
    id: 'roll-2.25x1.25',
    group: 'Label printer (one label per page)',
    name: '2¼" × 1¼" (Zebra, Rollo, Brother and similar)',
    kind: 'roll', label: { w: 2.25, h: 1.25 },
  },
  {
    id: 'roll-dymo-30336',
    group: 'Label printer (one label per page)',
    name: '2⅛" × 1" (DYMO 30336)',
    kind: 'roll', label: { w: 2.125, h: 1 },
  },
  {
    id: 'roll-dymo-30252',
    group: 'Label printer (one label per page)',
    name: '3½" × 1⅛" (DYMO 30252 address)',
    kind: 'roll', label: { w: 3.5, h: 1.125 },
  },
  {
    id: 'roll-4x6',
    group: 'Label printer (one label per page)',
    name: '4" × 6" (shipping label printers)',
    kind: 'roll', label: { w: 4, h: 6 },
  },
  {
    id: 'custom',
    group: 'Custom',
    name: 'Custom size…',
    kind: 'custom',
  },
];

export const DEFAULT_CUSTOM = {
  kind: 'sheet', // 'sheet' or 'roll'
  w: 2.5, h: 1.5, cols: 3, rows: 7, top: 0.5, left: 0.25, gapX: 0.125, gapY: 0.0, cutLines: true,
};

/** The format actually used, with a custom size turned into a full definition. */
export function resolveFormat(formatId, custom = DEFAULT_CUSTOM) {
  const preset = LABEL_FORMATS.find((f) => f.id === formatId) || LABEL_FORMATS[0];
  if (preset.kind !== 'custom') return preset;
  const c = { ...DEFAULT_CUSTOM, ...custom };
  const num = (v, min, fallback) => (Number.isFinite(Number(v)) && Number(v) >= min ? Number(v) : fallback);
  const label = { w: num(c.w, 0.25, 2.5), h: num(c.h, 0.25, 1.5) };
  if (c.kind === 'roll') return { id: 'custom', name: 'Custom', kind: 'roll', label };
  return {
    id: 'custom', name: 'Custom', kind: 'sheet', page: LETTER, label,
    cols: Math.max(1, Math.round(num(c.cols, 1, 1))),
    rows: Math.max(1, Math.round(num(c.rows, 1, 1))),
    top: num(c.top, 0, 0.5), left: num(c.left, 0, 0.25),
    gapX: num(c.gapX, 0, 0), gapY: num(c.gapY, 0, 0),
    cutLines: Boolean(c.cutLines),
  };
}

export const labelsPerPage = (format) => (format.kind === 'roll' ? 1 : format.cols * format.rows);

/** Does the sheet layout fit on the page? Returns a warning message or ''. */
export function layoutWarning(format) {
  if (format.kind !== 'sheet') return '';
  const width = format.left + format.cols * format.label.w + (format.cols - 1) * format.gapX;
  const height = format.top + format.rows * format.label.h + (format.rows - 1) * format.gapY;
  if (width > format.page.w + 0.01 || height > format.page.h + 0.01) {
    return `These labels need ${width.toFixed(2)}" × ${height.toFixed(2)}", which is larger than the ${format.page.w}" × ${format.page.h}" page.`;
  }
  return '';
}
