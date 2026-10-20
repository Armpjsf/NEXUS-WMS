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
 *   {L…}   level number, padded    e.g. "{Z}-{BBB}" → A-003, "{Z}-{BBB}.{L}" → M-001.2
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

export function applyBinTemplate(template: string, rack: Pick<RackConfig, 'rackCode' | 'zoneCode'>, bay: number, level: number): string {
  const tpl = (template || DEFAULT_BIN_TEMPLATE).trim() || DEFAULT_BIN_TEMPLATE;
  return normalizeBinCode(
    tpl
      .replace(/\{RACK\}/gi, String(rack.rackCode || ''))
      .replace(/\{Z\}/gi, String(rack.zoneCode || ''))
      .replace(/\{R\}/gi, rackSegment(rack))
      .replace(/\{(B+)\}/gi, (_, b: string) => String(bay).padStart(b.length, '0'))
      .replace(/\{(L+)\}/gi, (_, l: string) => String(level).padStart(l.length, '0')),
  );
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
  const dupBins: string[] = [];
  listLayoutBins(racks).forEach(b => {
    const prev = seen.get(b.binCode);
    if (prev !== undefined) dupBins.push(`${b.binCode} (${prev} / ${b.rackCode})`);
    else seen.set(b.binCode, b.rackCode);
  });
  if (dupBins.length) {
    errors.push(`รหัสโลเคชันซ้ำ ${dupBins.length} ช่อง เช่น ${dupBins.slice(0, 3).join(', ')} — ปรับรูปแบบรหัสโลเคชันของแร็กให้ไม่ชนกัน`);
  }
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
 * drawing every rack by hand. Understands "A-003", "M-001.2" (bay.level) and
 * merged bays "A-001-2". Codes it can't read come back in `unmatched`.
 */
export function inferLayoutFromBinCodes(
  codes: string[],
  base?: Partial<WarehouseLayout>,
): { layout: WarehouseLayout; matched: number; unmatched: string[] } {
  type Group = {
    zone: string;
    sep: '-' | '';
    bayDigits: number;
    maxBay: number;
    maxLevel: number;
    hasLevel: boolean;
    overrides: Record<string, string>;
    plain: { bay: number; code: string }[]; // codes without ".level" in a group that has levels
    codes: string[];
    bays: Set<number>;
  };
  const groups = new Map<string, Group>();
  const unmatched: string[] = [];
  let matched = 0;

  const uniq = Array.from(new Set(codes.map(normalizeBinCode)))
    .filter(c => c && c !== 'UNASSIGNED' && c !== '-' && c !== 'NONE');

  for (const code of uniq) {
    // ZONE[-]BAY[.LEVEL][-MERGED_TO_BAY]
    const m = code.match(/^([A-Z]+)(-?)(\d+)(?:\.(\d+))?(?:-(\d+))?$/);
    if (!m) { unmatched.push(code); continue; }
    const [, zone, sep, bayStr, levelStr, mergeStr] = m;
    const bay = parseInt(bayStr, 10);
    const level = levelStr ? parseInt(levelStr, 10) : 1;
    if (!bay || !level || bay > 200) { unmatched.push(code); continue; }

    const g = groups.get(zone) || {
      zone, sep: sep as '-' | '', bayDigits: bayStr.length, maxBay: 0, maxLevel: 1, hasLevel: false, overrides: {}, plain: [], codes: [], bays: new Set<number>(),
    };
    g.bayDigits = Math.max(g.bayDigits, bayStr.length);
    g.hasLevel = g.hasLevel || !!levelStr;
    g.maxLevel = Math.max(g.maxLevel, level);
    g.codes.push(code);
    g.bays.add(bay);
    if (!levelStr && !mergeStr) g.plain.push({ bay, code });
    let lastBay = bay;
    if (mergeStr) {
      // "A-001-2" = bays 1..2 merged into one bin labelled A-001-2
      const to = parseInt(mergeStr, 10);
      if (to > bay && to - bay < 20) {
        lastBay = to;
        g.overrides[overrideKey(bay, level)] = code;
        for (let b = bay + 1; b <= to; b++) g.overrides[overrideKey(b, level)] = '';
      } else {
        g.overrides[overrideKey(bay, level)] = code;
      }
    }
    g.maxBay = Math.max(g.maxBay, lastBay);
    groups.set(zone, g);
  }

  // A zone whose few codes jump to a high bay number ("Z99") is almost
  // certainly not a rack row — don't draw a 100-bay rack for it.
  const sorted = Array.from(groups.values())
    .filter(g => {
      const sparse = g.maxBay > 30 && g.bays.size / g.maxBay < 0.2;
      if (sparse) unmatched.push(...g.codes);
      else matched += g.codes.length;
      return !sparse;
    })
    .sort((a, b) => a.zone.localeCompare(b.zone));
  const racks: RackConfig[] = [];
  const bayWidth = 1.5;
  const rackDepth = 0.8;
  const aisle = 3;
  // Racks back-to-back in pairs with an aisle between pairs, laid out front to back.
  let z = 0;
  sorted.forEach((g, i) => {
    // "M-002" next to "M-001.1": keep the plain code on level 1 of that bay.
    if (g.hasLevel) g.plain.forEach(({ bay, code }) => {
      if (g.overrides[overrideKey(bay, 1)] === undefined) g.overrides[overrideKey(bay, 1)] = code;
    });
    const template = `{Z}${g.sep}{${'B'.repeat(g.bayDigits)}}${g.hasLevel ? '.{L}' : ''}`;
    racks.push({
      rackCode: g.zone,
      zoneCode: g.zone,
      posX: 0,
      posZ: z,
      rotationY: 0,
      bays: g.maxBay,
      levels: g.hasLevel ? g.maxLevel : 1,
      bayWidth,
      levelHeight: g.hasLevel ? 0.6 : 1.2,
      rackDepth,
      color: zoneColor(g.zone, i),
      type: 'RACK',
      palletMode: 'NON_PALLET',
      binTemplate: template,
      binOverrides: g.overrides,
    });
    z += i % 2 === 0 ? rackDepth : rackDepth + aisle;
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
