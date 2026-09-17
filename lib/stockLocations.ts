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
  taken: { binCode: string; quantity: number }[];
  shortfall: number; // qty that could not be satisfied from any bin
  total: number;     // resulting total stock after consume
}

type Admin = ReturnType<typeof getServiceSupabase>;

function norm(bin?: string | null): string {
  const b = String(bin ?? '').trim();
  return b || UNASSIGNED;
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
  const primary = bins
    .filter((b: any) => Number(b.quantity || 0) > 0)
    .sort((a: any, b: any) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
  await admin.from('products')
    .update({
      stock: total,
      location: primary?.bin_code || 'Unassigned',
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId).eq('sku', sku);
  return total;
}

/** Increment (or create) a bin's quantity, then reconcile the SKU total. */
export async function binAdd(
  orgId: string, sku: string, binCode: string, qty: number, opts?: { lotNo?: string }
): Promise<number> {
  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  const bin = norm(binCode);
  const add = Number(qty) || 0;

  const { data: existing } = await admin
    .from(TABLE).select('id, quantity').eq('org_id', orgId).eq('sku', sku).eq('bin_code', bin).maybeSingle();
  if (existing) {
    await admin.from(TABLE)
      .update({ quantity: Number(existing.quantity || 0) + add, lot_no: opts?.lotNo ?? undefined, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await admin.from(TABLE)
      .insert({ org_id: orgId, sku, bin_code: bin, quantity: add, lot_no: opts?.lotNo || null });
  }
  return reconcile(admin, orgId, sku);
}

/**
 * Consume qty from a SKU across its bins. If `preferBin` is given it is drained
 * first; otherwise bins are drained fullest-first. Clamps at 0 (never negative)
 * and reports any shortfall — matching the old Math.max(0, ...) behaviour.
 */
export async function binConsume(
  orgId: string, sku: string, qty: number, opts?: { preferBin?: string }
): Promise<ConsumeResult> {
  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  let need = Math.max(0, Number(qty) || 0);
  const taken: { binCode: string; quantity: number }[] = [];

  const { data: rows } = await admin
    .from(TABLE).select('id, bin_code, quantity').eq('org_id', orgId).eq('sku', sku);
  const bins = (rows || []).filter((b: any) => Number(b.quantity || 0) > 0);
  const prefer = opts?.preferBin ? norm(opts.preferBin) : null;
  bins.sort((a: any, b: any) => {
    if (prefer) {
      if (a.bin_code === prefer && b.bin_code !== prefer) return -1;
      if (b.bin_code === prefer && a.bin_code !== prefer) return 1;
    }
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
    taken.push({ binCode: b.bin_code, quantity: use });
    need -= use;
  }

  const total = await reconcile(admin, orgId, sku);
  return { taken, shortfall: need, total };
}

/** Move qty of a SKU from one bin to another (partial or whole). */
export async function binMove(
  orgId: string, sku: string, fromBin: string, toBin: string, qty: number
): Promise<{ moved: number; total: number }> {
  const admin = getServiceSupabase();
  await ensureSeeded(admin, orgId, sku);
  const from = norm(fromBin);
  const to = norm(toBin);
  const want = Math.max(0, Number(qty) || 0);
  if (from === to || want <= 0) {
    const total = await reconcile(admin, orgId, sku);
    return { moved: 0, total };
  }

  const { data: src } = await admin
    .from(TABLE).select('id, quantity').eq('org_id', orgId).eq('sku', sku).eq('bin_code', from).maybeSingle();
  const avail = Number(src?.quantity || 0);
  const move = Math.min(avail, want);
  if (move > 0 && src) {
    await admin.from(TABLE)
      .update({ quantity: avail - move, updated_at: new Date().toISOString() })
      .eq('id', src.id);
    const { data: dst } = await admin
      .from(TABLE).select('id, quantity').eq('org_id', orgId).eq('sku', sku).eq('bin_code', to).maybeSingle();
    if (dst) {
      await admin.from(TABLE)
        .update({ quantity: Number(dst.quantity || 0) + move, updated_at: new Date().toISOString() })
        .eq('id', dst.id);
    } else {
      await admin.from(TABLE)
        .insert({ org_id: orgId, sku, bin_code: to, quantity: move });
    }
  }
  const total = await reconcile(admin, orgId, sku);
  return { moved: move, total };
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
  const { data: existing } = await admin
    .from(TABLE).select('id').eq('org_id', orgId).eq('sku', sku).eq('bin_code', bin).maybeSingle();
  if (existing) {
    await admin.from(TABLE)
      .update({ quantity: val, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await admin.from(TABLE)
      .insert({ org_id: orgId, sku, bin_code: bin, quantity: val });
  }
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
