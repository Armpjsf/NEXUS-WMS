// Real inventory cost (server only).
//
// products.price is the SELLING price. Cost lives in products.cost_price
// (moving average) and stock_transactions.unit_cost (cost of each receipt),
// added by sql/20260925_cost_ratelimit_memberships.sql. Every function here
// tolerates those columns not existing yet (the SQL is run by hand).
import { getServiceSupabase } from './supabase';

type Admin = ReturnType<typeof getServiceSupabase>;

const MISSING_COLUMN = /cost_price|unit_cost|column .* does not exist|PGRST204/i;

/** New moving-average unit cost after receiving `qtyIn` at `unitCost`. */
export function movingAverageCost(stockBefore: number, costBefore: number | null, qtyIn: number, unitCost: number): number {
  const before = Math.max(0, stockBefore);
  if (costBefore == null || costBefore <= 0 || before <= 0) return round4(unitCost);
  return round4((before * costBefore + qtyIn * unitCost) / (before + qtyIn));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** sku → unit price from a purchase order's lines (the PO price is the cost). */
export async function poCostMap(admin: Admin, orgId: string, poNumber: string): Promise<Record<string, number>> {
  if (!poNumber) return {};
  const { data } = await admin.from('purchase_orders').select('items_json')
    .eq('org_id', orgId).eq('po_number', poNumber).maybeSingle();
  const map: Record<string, number> = {};
  for (const l of (data?.items_json as any[]) || []) {
    const price = Number(l.price ?? l.unitPrice ?? l.unit_price ?? 0);
    if (l.sku && price > 0) map[l.sku] = price;
  }
  return map;
}

/** Update products.cost_price with a moving average. No-op if the column is missing. */
export async function applyReceiptCost(
  admin: Admin, orgId: string, sku: string, stockBefore: number, qtyIn: number, unitCost: number,
): Promise<void> {
  if (!(unitCost > 0) || !(qtyIn > 0)) return;
  const { data, error } = await admin.from('products').select('cost_price')
    .eq('org_id', orgId).eq('sku', sku).maybeSingle();
  if (error) {
    if (!MISSING_COLUMN.test(error.message)) console.warn('[costing] read cost failed:', error.message);
    return;
  }
  const next = movingAverageCost(stockBefore, data?.cost_price == null ? null : Number(data.cost_price), qtyIn, unitCost);
  const { error: upErr } = await admin.from('products').update({ cost_price: next })
    .eq('org_id', orgId).eq('sku', sku);
  if (upErr && !MISSING_COLUMN.test(upErr.message)) console.warn('[costing] write cost failed:', upErr.message);
}

/** Insert a stock transaction, dropping unit_cost if that column isn't migrated yet. */
export async function insertTxWithCost(admin: Admin, row: Record<string, any>): Promise<void> {
  const { error } = await admin.from('stock_transactions').insert(row);
  if (!error) return;
  if ('unit_cost' in row && MISSING_COLUMN.test(error.message)) {
    const { unit_cost: _drop, ...rest } = row;
    const retry = await admin.from('stock_transactions').insert(rest);
    if (retry.error) console.error('[costing] tx insert failed:', retry.error.message);
    return;
  }
  console.error('[costing] tx insert failed:', error.message);
}
