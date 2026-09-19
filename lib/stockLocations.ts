/**
 * Multi-bin stock engine.
 *
 * The single source of truth for how much of a SKU sits in each bin/location.
 * `products.stock` is kept equal to the SUM of a SKU's bins, and
 * `products.location` is kept pointing at the bin holding the most units, so
 * every legacy screen that reads a single stock number / location keeps working.
 *
 * Rules of use:
 *  - Every stock-changing flow (receiving, picking/ship, returns, kitting,
 *    outbound, adjustments, LPN move) routes its quantity change through here
 *    INSTEAD of writing products.stock directly, so the total never drifts.
 *  - Legacy SKUs that have no bin rows yet are seeded on first touch from their
 *    current products.stock @ products.location, so no stock is ever lost.
 */

import { getServiceSupabase } from '@/lib/supabase';

const TABLE = 'stock_locations';
export const UNASSIGNED = 'UNASSIGNED';

export interface BinStock {
  binCode: string;
  quantity: number;
  lotNo?: string;
}

export interface ConsumeResult {
  taken: { binCode: string; quantity: number; lotNo?: string }[];
  shortfall: number; // qty that could not be satisfied from any bin
  total: number;     // resulting total stock after consume
}

// C1: append a lot-traceability row for each lotted movement (non-lot skipped).
async function logLotMoves(
  orgId: string, sku: string, direction: 'IN' | 'OUT' | 'MOVE',
  taken: { binCode: string; quantity: number; lotNo?: string }[],
  opts?: { docRef?: string; party?: string },
): Promise<void> {
  const rows = taken
    .filter(t => t.lotNo && Number(t.quantity) > 0)
    .map(t => ({
      org_id: orgId, sku, lot_number: t.lotNo, qty: Number(t.quantity), direction,
      doc_ref: opts?.docRef || null, party: opts?.party || null, location: t.binCode,
    }));
  if (rows.length === 0) return;
  try { await getServiceSupabase().from('lot_movements').insert(rows); }
  catch (e) { /* lot_movements optional until migrated */ }
}

type Admin = ReturnType<typeof getServiceSupabase>;

function norm(bin?: string | null): string {
  const b = String(bin ?? '').trim();
  return b || UNASSIGNED;
}

// A3: call an atomic Postgres function; return null (→ JS fallback) only when
// the function is absent (SQL not applied yet). Real errors still fall back but
// are logged, so a missing migration degrades gracefully instead of breaking.
async function rpcOrNull(fn: string, args: Record<string, any>): Promise<any | null> {
  try {
    const { data, error } = await getServiceSupabase().rpc(fn, args);
    if (error) {
      const code = (error as any).code;
      const msg = (error as any).message || '';
      if (code === '42883' || /does not exist|could not find/i.test(msg)) return null; // undefined_function
      console.warn(`[stock] rpc ${fn} error, using JS fallback:`, msg);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/** Ensure a SKU has at least one bin row; seed from products if none exist. */
async function ensureSeeded(admin: Admin, orgId: string, sku: string): Promise<void> {
  const { data: rows } = await admin
    .from(TABLE).select('id').eq('org_id', orgId).eq('sku', sku).limit(1);
  if (rows && rows.length > 0) return;

  const { data: prod } = await admin
    .from('products').select('stock, location').eq('org_id', orgId).eq('sku', sku).maybeSingle();
  const qty = Number(prod?.stock || 0);
  const bin = norm(prod?.location);
  // Always create the seed row (qty may be 0) so the SKU is "bin-managed".
  await admin.from(TABLE).insert({ org_id: orgId, sku, bin_code: bin, quantity: qty });
}

/** Recompute products.stock (= sum of bins) and products.location (= fullest bin). */
async function reconcile(admin: Admin, orgId: string, sku: string): Promise<number> {
  const { data: rows } = await admin
    .from(TABLE).select('bin_code, quantity').eq('org_id', orgId).eq('sku', sku);
  const bins = rows || [];
  const total = bins.reduce((s: number, b: any) => s + Number(b.quantity || 0), 0);
  // Fullest BIN = sum over its lot rows (a bin may now hold several lots).
  const byBin = new Map<string, number>();
  for (const b of bins) byBin.set(b.bin_code, (byBin.get(b.bin_code) || 0) + Number(b.quantity || 0));
  const primary = [...byBin.entries()]
    .filter(([, q]) => q > 0)
    .sort((a, b) => b[1] - a[1])[0];
  await admin.from('products')
    .update({
      stock: total,
      location: primary?.[0] || 'Unassigned',
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId).eq('sku', sku);
  return total;
}

/** Increment (or create) a bin's quantity, then reconcile the SKU total. */
export async function binAdd(
  orgId: string, sku: string, binCode: string, qty: number, opts?: { lotNo?: string; docRef?: string; party?: string }
): Promise<number> {
  // C1: record an IN lot movement (lotted receipts only)
  if (opts?.lotNo && (Number(qty) || 0) > 0) {
    await logLotMoves(orgId, sku, 'IN', [{ binCode: norm(binCode), quantity: Number(qty) || 0, lotNo: opts.lotNo }], opts);
  }
  const atomic = await rpcOrNull('wms_bin_add', {
    p_org: orgId, p_sku: sku, p_bin: norm(binCode), p_qty: Number(qty) || 0, p_lot: opts?.lotNo ?? null,
  });
  if (atomic != null) return Number(atomic);

  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  const bin = norm(binCode);
  const add = Number(qty) || 0;

  const lot = opts?.lotNo || '';
  const { data: existing } = await admin
    .from(TABLE).select('id, quantity').eq('org_id', orgId).eq('sku', sku).eq('bin_code', bin).eq('lot_no', lot).maybeSingle();
  if (existing) {
    await admin.from(TABLE)
      .update({ quantity: Number(existing.quantity || 0) + add, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await admin.from(TABLE)
      .insert({ org_id: orgId, sku, bin_code: bin, quantity: add, lot_no: lot });
  }
  return reconcile(admin, orgId, sku);
}

/**
 * Consume qty from a SKU across its bins. If `preferBin` is given it is drained
 * first; otherwise bins are drained fullest-first. Clamps at 0 (never negative)
 * and reports any shortfall — matching the old Math.max(0, ...) behaviour.
 */
export async function binConsume(
  orgId: string, sku: string, qty: number, opts?: { preferBin?: string; docRef?: string; party?: string }
): Promise<ConsumeResult> {
  const atomic = await rpcOrNull('wms_bin_consume', {
    p_org: orgId, p_sku: sku, p_qty: Number(qty) || 0, p_prefer: opts?.preferBin ? norm(opts.preferBin) : null,
  });
  if (atomic != null) {
    const takenA = Array.isArray(atomic.taken) ? atomic.taken : [];
    await logLotMoves(orgId, sku, 'OUT', takenA, opts); // C1 traceability
    return { taken: takenA, shortfall: Number(atomic.shortfall || 0), total: Number(atomic.total || 0) };
  }

  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  let need = Math.max(0, Number(qty) || 0);
  const taken: { binCode: string; quantity: number; lotNo?: string }[] = [];

  const { data: rows } = await admin
    .from(TABLE).select('id, bin_code, quantity, lot_no, created_at').eq('org_id', orgId).eq('sku', sku);
  const bins = (rows || []).filter((b: any) => Number(b.quantity || 0) > 0);
  const prefer = opts?.preferBin ? norm(opts.preferBin) : null;

  // A2 — FEFO: consume the lot expiring soonest first. Look up each bin's lot
  // expiry from product_lots; bins with no lot/expiry fall back to FIFO (oldest
  // stock_locations row first). A picked `preferBin` still wins so a physical
  // pick from a scanned bin is honoured over the automatic FEFO order.
  const lotNos = Array.from(new Set(bins.map((b: any) => b.lot_no).filter(Boolean)));
  const expMap = new Map<string, { exp: number | null; expired: boolean }>();
  if (lotNos.length > 0) {
    try {
      const { data: lots } = await admin
        .from('product_lots').select('lot_number, exp_date')
        .eq('org_id', orgId).eq('sku', sku).in('lot_number', lotNos);
      for (const l of lots || []) {
        const exp = l.exp_date ? new Date(l.exp_date).getTime() : null;
        expMap.set(l.lot_number, { exp, expired: exp != null && exp <= Date.now() });
      }
    } catch { /* product_lots optional — fall back to FIFO */ }
  }
  const meta = (b: any) => (b.lot_no && expMap.get(b.lot_no)) || { exp: null, expired: false };

  bins.sort((a: any, b: any) => {
    if (prefer) {
      if (a.bin_code === prefer && b.bin_code !== prefer) return -1;
      if (b.bin_code === prefer && a.bin_code !== prefer) return 1;
    }
    const ma = meta(a), mb = meta(b);
    if (ma.expired !== mb.expired) return ma.expired ? 1 : -1;           // avoid expired unless forced
    if (ma.exp != null && mb.exp != null && ma.exp !== mb.exp) return ma.exp - mb.exp; // earliest expiry first
    if (ma.exp != null && mb.exp == null) return -1;                     // dated lots before undated
    if (ma.exp == null && mb.exp != null) return 1;
    const ca = new Date(a.created_at || 0).getTime();                    // FIFO tiebreak
    const cb = new Date(b.created_at || 0).getTime();
    if (ca !== cb) return ca - cb;
    return Number(b.quantity || 0) - Number(a.quantity || 0);
  });

  for (const b of bins) {
    if (need <= 0) break;
    const avail = Number(b.quantity || 0);
    const use = Math.min(avail, need);
    if (use <= 0) continue;
    await admin.from(TABLE)
      .update({ quantity: avail - use, updated_at: new Date().toISOString() })
      .eq('id', b.id);
    taken.push({ binCode: b.bin_code, quantity: use, lotNo: b.lot_no || undefined });
    need -= use;
  }

  const total = await reconcile(admin, orgId, sku);
  await logLotMoves(orgId, sku, 'OUT', taken, opts); // C1 traceability
  return { taken, shortfall: need, total };
}

/** Move qty of a SKU from one bin to another (partial or whole). */
export async function binMove(
  orgId: string, sku: string, fromBin: string, toBin: string, qty: number
): Promise<{ moved: number; total: number }> {
  const atomic = await rpcOrNull('wms_bin_move', {
    p_org: orgId, p_sku: sku, p_from: norm(fromBin), p_to: norm(toBin), p_qty: Math.max(0, Number(qty) || 0),
  });
  if (atomic != null) return { moved: Number(atomic.moved || 0), total: Number(atomic.total || 0) };

  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  const from = norm(fromBin);
  const to = norm(toBin);
  const want = Math.max(0, Number(qty) || 0);
  if (from === to || want <= 0) {
    const total = await reconcile(admin, orgId, sku);
    return { moved: 0, total };
  }

  // Move up to `want` from the source bin across its lots (FIFO by created_at),
  // preserving each lot on the destination bin (a bin can hold many lots now).
  const { data: srcRows } = await admin
    .from(TABLE).select('id, quantity, lot_no, created_at')
    .eq('org_id', orgId).eq('sku', sku).eq('bin_code', from)
    .order('created_at', { ascending: true });
  let need = want;
  let moved = 0;
  for (const s of srcRows || []) {
    if (need <= 0) break;
    const avail = Number(s.quantity || 0);
    const use = Math.min(avail, need);
    if (use <= 0) continue;
    await admin.from(TABLE)
      .update({ quantity: avail - use, updated_at: new Date().toISOString() }).eq('id', s.id);
    const lot = s.lot_no || '';
    const { data: dst } = await admin
      .from(TABLE).select('id, quantity').eq('org_id', orgId).eq('sku', sku).eq('bin_code', to).eq('lot_no', lot).maybeSingle();
    if (dst) {
      await admin.from(TABLE)
        .update({ quantity: Number(dst.quantity || 0) + use, updated_at: new Date().toISOString() }).eq('id', dst.id);
    } else {
      await admin.from(TABLE)
        .insert({ org_id: orgId, sku, bin_code: to, quantity: use, lot_no: lot });
    }
    moved += use; need -= use;
  }
  const total = await reconcile(admin, orgId, sku);
  return { moved, total };
}

/** Move an entire bin's contents of a SKU to another bin (used by LPN move). */
export async function binMoveAll(
  orgId: string, sku: string, fromBin: string, toBin: string
): Promise<{ moved: number; total: number }> {
  const admin = getServiceSupabase();
  const from = norm(fromBin);
  const { data: src } = await admin
    .from(TABLE).select('quantity').eq('org_id', orgId).eq('sku', sku).eq('bin_code', from).maybeSingle();
  return binMove(orgId, sku, from, toBin, Number(src?.quantity || 0));
}

/** Set an exact counted quantity for a specific bin (used by adjustments). */
export async function binSet(
  orgId: string, sku: string, binCode: string, countedQty: number
): Promise<number> {
  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  const bin = norm(binCode);
  const val = Math.max(0, Number(countedQty) || 0);
  // A physical count is per bin, not per lot. Collapse any lot rows in this bin
  // into a single unlotted row holding the counted quantity.
  await admin.from(TABLE).delete().eq('org_id', orgId).eq('sku', sku).eq('bin_code', bin);
  await admin.from(TABLE)
    .insert({ org_id: orgId, sku, bin_code: bin, quantity: val, lot_no: '' });
  return reconcile(admin, orgId, sku);
}

/**
 * Reset the bin distribution for many SKUs to a single bin each. Used by the
 * product-master import, which declares an absolute stock @ location per SKU:
 * we drop existing bin rows for those SKUs and write one bin, so the bin ledger
 * matches the imported total (otherwise the next bin op would reconcile
 * products.stock back to the stale bin sum and silently undo the import).
 */
export async function resetBinsBulk(
  orgId: string,
  rows: { sku: string; binCode: string; quantity: number }[]
): Promise<void> {
  const list = rows.filter(r => r.sku);
  if (list.length === 0) return;
  const admin = getServiceSupabase();
  const skus = Array.from(new Set(list.map(r => r.sku)));
  await admin.from(TABLE).delete().eq('org_id', orgId).in('sku', skus);
  await admin.from(TABLE).insert(
    list.map(r => ({ org_id: orgId, sku: r.sku, bin_code: norm(r.binCode), quantity: Math.max(0, Number(r.quantity) || 0) }))
  );
}

/** List a SKU's bins (qty desc), for display. */
export async function getBins(orgId: string, sku: string): Promise<BinStock[]> {
  const admin = getServiceSupabase();
  const { data } = await admin
    .from(TABLE).select('bin_code, quantity, lot_no').eq('org_id', orgId).eq('sku', sku);
  return (data || [])
    .map((r: any) => ({ binCode: r.bin_code, quantity: Number(r.quantity || 0), lotNo: r.lot_no || undefined }))
    .sort((a, b) => b.quantity - a.quantity);
}

/** Bins for many SKUs at once → map of sku -> bins (qty desc). */
export async function getBinsForSkus(orgId: string, skus: string[]): Promise<Record<string, BinStock[]>> {
  const out: Record<string, BinStock[]> = {};
  const list = Array.from(new Set(skus.filter(Boolean)));
  if (list.length === 0) return out;
  const admin = getServiceSupabase();
  const { data } = await admin
    .from(TABLE).select('sku, bin_code, quantity, lot_no').eq('org_id', orgId).in('sku', list);
  for (const r of data || []) {
    (out[r.sku] ||= []).push({ binCode: r.bin_code, quantity: Number(r.quantity || 0), lotNo: r.lot_no || undefined });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b.quantity - a.quantity);
  return out;
}
