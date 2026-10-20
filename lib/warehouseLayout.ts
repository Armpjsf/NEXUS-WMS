/**
 * Warehouse layout model shared by the layout API, the 2D plan, the 3D twin
 * and bin-label printing. Client-safe (no server imports).
 *
 * A layout is a list of racks/blocks placed on the floor. Every rack expands
 * into bay × level bins, and THIS file is the only place that turns a
 * (rack, bay, level) into a bin code — so the map, the labels and the
 * warehouse_locations rows written on save always agree.
 *
 * Bin codes are built from a per-rack template so each branch can match the
 * labels already stuck on its real racks:
 *   {Z}    zone code               {R}   rack code without the "ZONE-" prefix
 *   {RACK} full rack code          {B…}  bay number, zero-padded to the B count
 *   {L…}   level number, padded    {A}   bay as a letter: 1→A, 2→B … 27→AA
 *   A start can follow "=": {A=G} makes bay 1 "G", {BBB=12} makes bay 1 "012"
 *   e.g. "{A}-{LLL}" → A-001…A-011 up each bay, then B-001…; "{Z}-{BBB}.{L}" → M-001.2
 * binOverrides["bay-level"] replaces one bin's code ("" = no bin there, e.g.
 * the second bay of a merged "A-001-2").
 */

export type RackType = 'RACK' | 'FLOOR_BLOCK' | 'CROSS_DOCK';
export type PalletMode = 'PALLET' | 'NON_PALLET';

export interface RackConfig {
  rackCode: string;
  zoneCode: string;
  posX: number;
  posZ: number;
  rotationY: number;
  bays: number;
  levels: number;
  bayWidth: number;
  levelHeight: number;
  rackDepth: number;
  color?: string;
  type?: RackType;
  palletMode?: PalletMode;
  binTemplate?: string;
  binOverrides?: Record<string, string>;
}

export interface WarehouseLayout {
  branchId: string;
  name: string;
  widthM: number;
  lengthM: number;
  heightM: number;
  racks: RackConfig[];
}

export interface LayoutBin {
  binCode: string;
  rackCode: string;
  zoneCode: string;
  bay: number;
  level: number;
}

export const DEFAULT_BIN_TEMPLATE = '{Z}-{R}-{BB}-{LL}';

export function normalizeBinCode(code?: string | null): string {
  return String(code ?? '').trim().toUpperCase();
}

/** Rack code without its zone prefix: zone A + "A-01-02" → "01-02"; "XDOCK-01" in XDOCK → "01". */
export function rackSegment(rack: Pick<RackConfig, 'rackCode' | 'zoneCode'>): string {
  const code = String(rack.rackCode || '').trim();
  const zone = String(rack.zoneCode || '').trim();
  if (zone && code.toUpperCase().startsWith(`${zone.toUpperCase()}-`)) return code.slice(zone.length + 1);
  return code;
}

export function overrideKey(bay: number, level: number): string {
  return `${bay}-${level}`;
}

/** 1 → A, 26 → Z, 27 → AA (spreadsheet-column style). */
export function bayLetter(n: number): string {
  let out = '';
  let x = Math.max(1, Math.floor(n));
  while (x > 0) {
    const r = (x - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out;
}

/** Inverse of bayLetter: A → 1, AA → 27. */
export function letterIndex(letters: string): number {
  return letters.toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

export function applyBinTemplate(template: string, rack: Pick<RackConfig, 'rackCode' | 'zoneCode'>, bay: number, level: number): string {
  const tpl = (template || DEFAULT_BIN_TEMPLATE).trim() || DEFAULT_BIN_TEMPLATE;
  return normalizeBinCode(
    tpl
      .replace(/\{RACK\}/gi, String(rack.rackCode || ''))
      .replace(/\{Z\}/gi, String(rack.zoneCode || ''))
      .replace(/\{R\}/gi, rackSegment(rack))
      .replace(/\{A(?:=([A-Z]+))?\}/gi, (_, start?: string) => bayLetter(bay - 1 + (start ? letterIndex(start) : 1)))
      .replace(/\{(B+)(?:=(\d+))?\}/gi, (_, b: string, start?: string) => String(bay - 1 + (start ? parseInt(start, 10) : 1)).padStart(b.length, '0'))
      .replace(/\{(L+)\}/gi, (_, l: string) => String(level).padStart(l.length, '0'))
      // Shorthand people naturally type: {E} = "first bay is E" (same as {A=E}).
      .replace(/\{([A-Z]{1,2})\}/gi, (_, start: string) => bayLetter(bay - 1 + letterIndex(start))),
  );
}

/** First-bay letter + level digits when the template is the simple "{A=X}-{LLL}" shape (else null). */
export function parseSimpleTemplate(template?: string): { startLetter: string; levelDigits: number } | null {
  const t = String(template || '').trim();
  const m = t.match(/^\{(?:A(?:=([A-Z]{1,2}))?|([A-Z]{1,2}))\}-\{(L+)\}$/i);
  if (!m) return null;
  const startLetter = (m[1] || m[2] || 'A').toUpperCase();
  return { startLetter, levelDigits: m[3].length };
}

/** Build the simple template: first bay letter + level digits → "{A=E}-{LLL}". */
export function simpleTemplate(startLetter: string, levelDigits: number): string {
  const letter = String(startLetter || 'A').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'A';
  return `{A${letter === 'A' ? '' : `=${letter}`}}-{${'L'.repeat(Math.max(1, Math.min(4, levelDigits)))}}`;
}

/** Tokens the template uses that we don't understand (shown as a warning in the editor). */
export function unknownTemplateTokens(template?: string): string[] {
  const known = /^(RACK|Z|R|A(=[A-Z]+)?|B+(=\d+)?|L+|[A-Z]{1,2})$/i;
  return Array.from(String(template || '').matchAll(/\{([^}]*)\}/g)).map(m => m[1]).filter(t => !known.test(t));
}

/** How a bay is called on the floor: its letter when the template uses {A}, else its number. */
export function bayLabel(rack: Pick<RackConfig, 'binTemplate'>, bay: number): string {
  const m = String(rack.binTemplate || '').match(/\{A(?:=([A-Z]+))?\}/i);
  if (m) return bayLetter(bay - 1 + (m[1] ? letterIndex(m[1]) : 1));
  const s = String(rack.binTemplate || '').replace(/\{(RACK|Z|R|B+(=\d+)?|L+)\}/gi, '').match(/\{([A-Z]{1,2})\}/i);
  if (s) return bayLetter(bay - 1 + letterIndex(s[1]));
  const n = String(rack.binTemplate || '').match(/\{B+=(\d+)\}/i);
  return String(bay - 1 + (n ? parseInt(n[1], 10) : 1));
}

/** Bin code for one slot, or null when the slot is switched off by an override. */
export function binCodeFor(rack: RackConfig, bay: number, level: number): string | null {
  const ov = rack.binOverrides?.[overrideKey(bay, level)];
  if (ov !== undefined) return ov.trim() ? normalizeBinCode(ov) : null;
  return applyBinTemplate(rack.binTemplate || DEFAULT_BIN_TEMPLATE, rack, bay, level);
}

export function listRackBins(rack: RackConfig): LayoutBin[] {
  const out: LayoutBin[] = [];
  const bays = Math.max(1, Math.floor(Number(rack.bays) || 1));
  const levels = Math.max(1, Math.floor(Number(rack.levels) || 1));
  for (let level = 1; level <= levels; level++) {
    for (let bay = 1; bay <= bays; bay++) {
      const binCode = binCodeFor(rack, bay, level);
      if (binCode) out.push({ binCode, rackCode: rack.rackCode, zoneCode: rack.zoneCode, bay, level });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-slot editing: merge a slot with the level above, split it back, give it
// a custom code, or switch it off. All of it lives in rack.binOverrides:
//   override "<bay>-<level>" = code  → this slot uses that code
//   override = ""                    → no bin here: either absorbed by the slot
//                                       below (merged) or switched off
// ---------------------------------------------------------------------------

export type SlotState = 'normal' | 'custom' | 'merged-into-below' | 'off';

function ov(rack: RackConfig, bay: number, level: number): string | undefined {
  return rack.binOverrides?.[overrideKey(bay, level)];
}

/** What a slot is, telling a merged-away slot apart from one that was switched off. */
export function slotState(rack: RackConfig, bay: number, level: number): SlotState {
  const v = ov(rack, bay, level);
  if (v === undefined) return 'normal';
  if (v.trim()) return 'custom';
  // "" — merged if the run of "" below it ends on a slot with its own code
  // (a merge always gives the bottom slot a code like "C-001-2"); else switched off.
  for (let l = level - 1; l >= 1; l--) {
    const below = ov(rack, bay, l);
    if (below === undefined) return 'off';
    if (below.trim()) return 'merged-into-below';
  }
  return 'off';
}

/** The base (bottom) and top level of the merged slot that (bay, level) belongs to. */
export function slotSpan(rack: RackConfig, bay: number, level: number): { base: number; top: number } {
  let base = level;
  if (slotState(rack, bay, level) === 'merged-into-below') {
    while (base > 1 && slotState(rack, bay, base) === 'merged-into-below') base--;
  }
  let top = base;
  while (top < rack.levels && slotState(rack, bay, top + 1) === 'merged-into-below') top++;
  return { base, top };
}

function withOverrides(rack: RackConfig, edit: (o: Record<string, string>) => void): RackConfig {
  const o = { ...(rack.binOverrides || {}) };
  edit(o);
  return { ...rack, binOverrides: o };
}

/** Merge the slot (and anything already merged into it) with the slot above, e.g. C-001 + C-002 → "C-001-2". */
export function mergeSlotUp(rack: RackConfig, bay: number, level: number): RackConfig {
  const { base, top } = slotSpan(rack, bay, level);
  if (top >= rack.levels) return rack;
  // the slot above may itself be a merged slot — take all of it
  const aboveTop = slotSpan(rack, bay, top + 1).top;
  const baseCode = applyBinTemplate(rack.binTemplate || DEFAULT_BIN_TEMPLATE, rack, bay, base);
  return withOverrides(rack, o => {
    o[overrideKey(bay, base)] = `${baseCode}-${aboveTop}`;
    for (let l = base + 1; l <= aboveTop; l++) o[overrideKey(bay, l)] = '';
  });
}

/** Undo a merge / custom code / switch-off: every slot of the span goes back to its template code. */
export function splitSlot(rack: RackConfig, bay: number, level: number): RackConfig {
  const { base, top } = slotSpan(rack, bay, level);
  return withOverrides(rack, o => {
    for (let l = base; l <= top; l++) delete o[overrideKey(bay, l)];
  });
}

/** Give the slot (the base of its span) a custom code; blank = back to the template code. */
export function setSlotCode(rack: RackConfig, bay: number, level: number, code: string): RackConfig {
  const { base, top } = slotSpan(rack, bay, level);
  const c = normalizeBinCode(code);
  return withOverrides(rack, o => {
    if (c) o[overrideKey(bay, base)] = c;
    else if (top === base) delete o[overrideKey(bay, base)];
    else o[overrideKey(bay, base)] = `${applyBinTemplate(rack.binTemplate || DEFAULT_BIN_TEMPLATE, rack, bay, base)}-${top}`;
  });
}

/** Switch a slot off (no bin there, e.g. blocked by a column) or back on. */
export function toggleSlotOff(rack: RackConfig, bay: number, level: number): RackConfig {
  const state = slotState(rack, bay, level);
  if (state === 'off') return withOverrides(rack, o => { delete o[overrideKey(bay, level)]; });
  const split = splitSlot(rack, bay, level);
  const { base } = slotSpan(rack, bay, level);
  return withOverrides(split, o => { o[overrideKey(bay, base)] = ''; });
}

export function listLayoutBins(racks: RackConfig[] = []): LayoutBin[] {
  return racks.flatMap(listRackBins);
}

/** Problems that would make the saved layout ambiguous (shown before save, enforced by the API). */
export function validateLayout(racks: RackConfig[] = []): string[] {
  const errors: string[] = [];
  const rackCodes = new Map<string, number>();
  racks.forEach(r => {
    const code = String(r.rackCode || '').trim();
    if (!code) errors.push('มีแร็กที่ยังไม่ได้ตั้งรหัส');
    rackCodes.set(code, (rackCodes.get(code) || 0) + 1);
  });
  rackCodes.forEach((n, code) => { if (code && n > 1) errors.push(`รหัสแร็กซ้ำ: ${code}`); });

  const seen = new Map<string, string>();
  const clashes = new Map<string, string[]>(); // "rackA ↔ rackB" → codes
  listLayoutBins(racks).forEach(b => {
    const prev = seen.get(b.binCode);
    if (prev === undefined) { seen.set(b.binCode, b.rackCode); return; }
    const key = prev === b.rackCode ? `แร็ก ${prev}` : `แร็ก ${prev} กับ ${b.rackCode}`;
    clashes.set(key, [...(clashes.get(key) || []), b.binCode]);
  });
  clashes.forEach((codes, key) => {
    const sample = codes.length > 2 ? `${codes[0]} … ${codes[codes.length - 1]}` : codes.join(', ');
    errors.push(`${key} ได้รหัสโลเคชันซ้ำกัน ${codes.length} ช่อง (${sample}) — ตั้ง "เสาแรก" ของแต่ละแร็กให้ต่อกัน เช่น A, E, I`);
  });
  return errors;
}

const ZONE_PALETTE = ['#57ec7f', '#4cd7f6', '#facc15', '#ffb4ab', '#c4b5fd', '#fdba74', '#86efac', '#93c5fd', '#f9a8d4', '#fde68a'];

export function zoneColor(zoneCode: string, index?: number): string {
  if (index !== undefined) return ZONE_PALETTE[index % ZONE_PALETTE.length];
  let h = 0;
  for (const ch of String(zoneCode)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ZONE_PALETTE[h % ZONE_PALETTE.length];
}

/**
 * Build a starting layout from the bin codes the branch already uses (stock
 * rows / product locations), so the map matches the real warehouse without
 * drawing every rack by hand. Codes it can't read come back in `unmatched`.
 *
 * Convention (as labelled in the real racks): the LETTER is the bay between two
 * uprights and the NUMBER is the level counting upward —
 *   A-001 … A-011 = bay A bottom→top, then B-001 … in the next bay.
 * Consecutive letters (A, B, C …) become the bays of one rack row with template
 * "{A}-{LLL}". "A-001-2" = levels 1–2 of bay A merged into one slot.
 * "M-001.3" = level 1 of M, position 3 across the shelf → rack M, "{Z}-{LLL}.{B}".
 * Split a long row afterwards by lowering Bays and starting the next row at
 * the right letter, e.g. "{A=G}-{LLL}".
 */
export function inferLayoutFromBinCodes(
  codes: string[],
  base?: Partial<WarehouseLayout>,
): { layout: WarehouseLayout; matched: number; unmatched: string[] } {
  type Group = {
    letter: string;
    sep: string;
    digits: number;
    maxLevel: number;
    maxPos: number;                    // >1 only for "M-001.3"-style codes
    overrides: Record<string, string>; // keyed by "<pos>-<level>" inside the group
    codes: string[];
    levels: Set<number>;
  };
  const groups = new Map<string, Group>();
  const unmatched: string[] = [];
  let matched = 0;

  const uniq = Array.from(new Set(codes.map(normalizeBinCode)))
    .filter(c => c && c !== 'UNASSIGNED' && c !== '-' && c !== 'NONE');

  for (const code of uniq) {
    // LETTER[-]LEVEL[.POSITION][-MERGED_TO_LEVEL]
    const m = code.match(/^([A-Z]+)(-?)(\d+)(?:\.(\d+))?(?:-(\d+))?$/);
    if (!m) { unmatched.push(code); continue; }
    const [, letter, sep, levelStr, posStr, mergeStr] = m;
    const level = parseInt(levelStr, 10);
    const pos = posStr ? parseInt(posStr, 10) : 1;
    if (!level || !pos || level > 200 || pos > 50) { unmatched.push(code); continue; }

    const g = groups.get(letter) || {
      letter, sep, digits: levelStr.length, maxLevel: 0, maxPos: 1, overrides: {}, codes: [], levels: new Set<number>(),
    };
    g.digits = Math.max(g.digits, levelStr.length);
    g.maxPos = Math.max(g.maxPos, pos);
    g.codes.push(code);
    g.levels.add(level);
    let top = level;
    if (mergeStr) {
      const to = parseInt(mergeStr, 10);
      g.overrides[overrideKey(pos, level)] = code;
      if (to > level && to - level < 20) {
        top = to;
        for (let l = level + 1; l <= to; l++) g.overrides[overrideKey(pos, l)] = '';
      }
    } else if (!posStr) {
      // plain "M-002" in a group that also has "M-001.1": pin it to position 1
      g.overrides[overrideKey(1, level)] ??= code;
    }
    g.maxLevel = Math.max(g.maxLevel, top);
    groups.set(letter, g);
  }

  // A letter whose few codes jump to a high number ("Z99") is almost certainly
  // not a rack bay — don't draw a 99-level column for it.
  const usable = Array.from(groups.values())
    .filter(g => {
      const sparse = g.maxLevel > 30 && g.levels.size / g.maxLevel < 0.2;
      if (sparse) unmatched.push(...g.codes);
      else matched += g.codes.length;
      return !sparse;
    })
    .sort((a, b) => letterIndex(a.letter) - letterIndex(b.letter) || a.letter.localeCompare(b.letter));

  // Drop the "pin to position 1" overrides that match what the template makes anyway.
  const cleanOverrides = (ov: Record<string, string>, make: (pos: number, level: number) => string) => {
    const out: Record<string, string> = {};
    Object.entries(ov).forEach(([k, v]) => {
      const [p, l] = k.split('-').map(Number);
      if (v === '' || v !== make(p, l)) out[k] = v;
    });
    return out;
  };

  type Draft = Omit<RackConfig, 'posX' | 'posZ' | 'rotationY' | 'color' | 'type' | 'bayWidth' | 'rackDepth'>;
  const drafts: Draft[] = [];

  // 1) "M-001.3" style: one rack per letter, positions across, levels up.
  usable.filter(g => g.maxPos > 1).forEach(g => {
    const tpl = `{Z}${g.sep}{${'L'.repeat(g.digits)}}.{B}`;
    const rack = { rackCode: g.letter, zoneCode: g.letter } as RackConfig;
    drafts.push({
      rackCode: g.letter,
      zoneCode: g.letter,
      bays: g.maxPos,
      levels: g.maxLevel,
      levelHeight: 0,
      binTemplate: tpl,
      binOverrides: cleanOverrides(g.overrides, (p, l) => applyBinTemplate(tpl, rack, p, l)),
    });
  });

  // 2) Plain letters: runs of consecutive letters (same separator/digits) = bays of one row.
  const plain = usable.filter(g => g.maxPos === 1);
  let run: Group[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const first = run[0];
    const digits = Math.max(...run.map(g => g.digits));
    const tpl = `{A${first.letter === 'A' ? '' : `=${first.letter}`}}${first.sep}{${'L'.repeat(digits)}}`;
    const code = run.length === 1 ? first.letter : `${first.letter}-${run[run.length - 1].letter}`;
    const rack = { rackCode: code, zoneCode: first.letter } as RackConfig;
    const overrides: Record<string, string> = {};
    run.forEach((g, i) => {
      Object.entries(g.overrides).forEach(([k, v]) => {
        const level = Number(k.split('-')[1]);
        overrides[overrideKey(i + 1, level)] = v;
      });
    });
    drafts.push({
      rackCode: code,
      zoneCode: first.letter,
      bays: run.length,
      levels: Math.max(...run.map(g => g.maxLevel)),
      levelHeight: 0,
      binTemplate: tpl,
      binOverrides: cleanOverrides(overrides, (b, l) => applyBinTemplate(tpl, rack, b, l)),
    });
    run = [];
  };
  plain.forEach(g => {
    const prev = run[run.length - 1];
    const contiguous = prev && letterIndex(g.letter) === letterIndex(prev.letter) + 1 && g.sep === prev.sep;
    if (!contiguous) flush();
    run.push(g);
  });
  flush();

  drafts.sort((a, b) => letterIndex(a.zoneCode) - letterIndex(b.zoneCode));

  // Lay rows out front to back, back-to-back in pairs with an aisle between pairs.
  const bayWidth = 1.2;
  const rackDepth = 0.6;
  const aisle = 3;
  let z = 0;
  const racks: RackConfig[] = drafts.map((d, i) => {
    const rack: RackConfig = {
      ...d,
      posX: 0,
      posZ: z,
      rotationY: 0,
      bayWidth,
      levelHeight: Number(Math.min(1.2, Math.max(0.3, 4.5 / Math.max(1, d.levels))).toFixed(2)),
      rackDepth,
      color: zoneColor(d.zoneCode, i),
      type: 'RACK',
      palletMode: 'NON_PALLET',
    };
    z += i % 2 === 0 ? rackDepth : rackDepth + aisle;
    return rack;
  });

  // Centre on the floor and size the building around the racks.
  const longest = Math.max(10, ...racks.map(r => r.bays * r.bayWidth));
  const depthUsed = Math.max(10, z);
  racks.forEach(r => { r.posZ = Number((r.posZ - depthUsed / 2 + rackDepth / 2).toFixed(2)); });

  return {
    layout: {
      branchId: base?.branchId || 'MAIN',
      name: base?.name || 'คลังสินค้า',
      widthM: Math.max(base?.widthM || 0, Math.ceil(longest + 8)),
      lengthM: Math.max(base?.lengthM || 0, Math.ceil(depthUsed + 12)),
      heightM: base?.heightM || 8,
      racks,
    },
    matched,
    unmatched,
  };
}
