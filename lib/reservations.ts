/**
 * A1 — Stock reservation / ATP (Available To Promise) on the multi-bin model.
 *
 *   available(sku) = products.stock  −  Σ qty_reserved of ACTIVE reservations
 *
 * Policy (chosen by ops): an order is always created; each line reserves as much
 * as is available and the shortfall is reported as backorder. The reservation is
 * CONSUMED when the order ships (stock is deducted then) and RELEASED on cancel.
 *
 * Only catalog SKUs (rows in `products`) are reserved — cross-dock / off-catalog
 * lines carry no warehouse stock and are skipped.
 *
 * NOTE: the ATP check is read-modify-write; a true race between two simultaneous
 * order creations is closed in A3 (atomic reserve RPC). Until then a rare
 * over-reserve is possible but stock-out at SHIP still clamps at 0.
 */

import { getServiceSupabase } from '@/lib/supabase';

const TABLE = 'stock_reservations';

// Call an atomic Postgres function; return null (→ JS fallback) if it's absent.
async function rpcOrNull(fn: string, args: Record<string, any>): Promise<any | null> {
  try {
    const { data, error } = await getServiceSupabase().rpc(fn, args);
    if (error) {
      const code = (error as any).code;
      const msg = (error as any).message || '';
      if (code === '42883' || /does not exist|could not find/i.test(msg)) return null;
      console.warn(`[reservations] rpc ${fn} error, JS fallback:`, msg);
      return null;
    }
    return data;
  } catch { return null; }
}

export interface ReserveLine { sku: string; qty: number; }
export interface ReservedLineResult { sku: string; requested: number; reserved: number; backorder: number; offCatalog?: boolean; }
export interface ReserveResult { lines: ReservedLineResult[]; hasBackorder: boolean; }

/** Σ qty_reserved of ACTIVE reservations for a SKU. */
export async function getReservedQty(orgId: string, sku: string): Promise<number> {
  const { data } = await getServiceSupabase()
    .from(TABLE).select('qty_reserved').eq('org_id', orgId).eq('sku', sku).eq('status', 'ACTIVE');
  return (data || []).reduce((s: number, r: any) => s + Number(r.qty_reserved || 0), 0);
}

/** sku → Σ qty_reserved of ACTIVE reservations, for the whole org (one query). */
export async function getReservedMap(orgId: string): Promise<Record<string, number>> {
  const { data, error } = await getServiceSupabase()
    .from(TABLE).select('sku, qty_reserved').eq('org_id', orgId).eq('status', 'ACTIVE');
  if (error) return {}; // table not migrated → nothing reserved
  const map: Record<string, number> = {};
  for (const r of data || []) map[r.sku] = (map[r.sku] || 0) + Number(r.qty_reserved || 0);
  return map;
}

/** available = products.stock − active reservations. Null if SKU not in catalog. */
export async function getAvailable(orgId: string, sku: string): Promise<number | null> {
  const admin = getServiceSupabase();
  const { data: prod } = await admin
    .from('products').select('stock').eq('org_id', orgId).eq('sku', sku).maybeSingle();
  if (!prod) return null; // off-catalog / cross-dock
  const reserved = await getReservedQty(orgId, sku);
  return Number(prod.stock || 0) - reserved;
}

/** Reserve stock for an order's lines (as much as available; rest = backorder). */
export async function reserveForOrder(
  orgId: string, orderId: string, orderNo: string, lines: ReserveLine[]
): Promise<ReserveResult> {
  const admin = getServiceSupabase();
  const out: ReservedLineResult[] = [];
  // Merge duplicate SKUs so availability isn't counted twice within one order.
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (!l.sku) continue;
    merged.set(l.sku, (merged.get(l.sku) || 0) + (Number(l.qty) || 0));
  }

  const jsRows: any[] = [];
  for (const [sku, qty] of merged) {
    // A3: atomic reserve (locks the product row so two orders can't reserve the
    // same units). Falls back to read-modify-write if the RPC isn't applied yet.
    const atomic = await rpcOrNull('wms_reserve', {
      p_org: orgId, p_order_id: orderId, p_order_no: orderNo, p_sku: sku, p_qty: qty,
    });
    if (atomic != null) {
      if (atomic.offCatalog) { out.push({ sku, requested: qty, reserved: 0, backorder: 0, offCatalog: true }); }
      else { out.push({ sku, requested: qty, reserved: Number(atomic.reserved || 0), backorder: Number(atomic.backorder || 0) }); }
      continue;
    }
    // fallback (non-atomic)
    const available = await getAvailable(orgId, sku);
    if (available === null) { out.push({ sku, requested: qty, reserved: 0, backorder: 0, offCatalog: true }); continue; }
    const reserved = Math.max(0, Math.min(available, qty));
    out.push({ sku, requested: qty, reserved, backorder: qty - reserved });
    jsRows.push({
      org_id: orgId, order_id: orderId, order_no: orderNo, sku,
      qty_requested: qty, qty_reserved: reserved, status: 'ACTIVE',
    });
  }
  if (jsRows.length > 0) await admin.from(TABLE).insert(jsRows);

  return { lines: out, hasBackorder: out.some(l => l.backorder > 0) };
}

/** Flip an order's ACTIVE reservations to CONSUMED (call when it ships). */
export async function consumeOrderReservations(orgId: string, orderId: string): Promise<void> {
  await getServiceSupabase().from(TABLE)
    .update({ status: 'CONSUMED', updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('order_id', orderId).eq('status', 'ACTIVE');
}

/** Flip an order's ACTIVE reservations to RELEASED (call when it cancels). */
export async function releaseOrderReservations(orgId: string, orderId: string): Promise<void> {
  await getServiceSupabase().from(TABLE)
    .update({ status: 'RELEASED', updated_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('order_id', orderId).eq('status', 'ACTIVE');
}
