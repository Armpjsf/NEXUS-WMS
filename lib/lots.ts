// product_lots writers (server only). A lot row is lot METADATA (number,
// expiry, received/current qty); the physical stock lives in stock_locations
// (lot_no per bin). Receipts must go through recordLotReceipt so an existing
// lot is incremented — never overwritten.
import { getServiceSupabase } from './supabase';

type Admin = ReturnType<typeof getServiceSupabase>;

/** YYYY-MM-DD or null; rejects anything that isn't a real date. */
export function normalizeDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export interface LotReceiptPayload {
  sku: string;
  lotNumber: string;
  qty: number;
  expDate?: string | null;
  mfgDate?: string | null;
  unitCost?: number;
  note?: string;
}

/** Add received qty to a lot (creating it if new); sets expiry when given. */
export async function recordLotReceipt(
  adminOrPayload: Admin | (LotReceiptPayload & { orgId: string }),
  orgId?: string,
  p?: LotReceiptPayload,
): Promise<void> {
  let admin: Admin;
  let resolvedOrgId: string;
  let payload: LotReceiptPayload;
  if (typeof (adminOrPayload as any)?.from === 'function') {
    admin = adminOrPayload as Admin;
    resolvedOrgId = orgId!;
    payload = p!;
  } else {
    const single = adminOrPayload as LotReceiptPayload & { orgId: string };
    admin = getServiceSupabase();
    resolvedOrgId = single.orgId;
    payload = single;
  }

  const qty = Math.max(0, Number(payload.qty) || 0);
  const now = new Date().toISOString();
  const { data: existing } = await admin.from('product_lots')
    .select('id, received_qty, current_qty, exp_date')
    .eq('org_id', resolvedOrgId).eq('sku', payload.sku).eq('lot_number', payload.lotNumber).maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {
      received_qty: Number(existing.received_qty || 0) + qty,
      current_qty: Number(existing.current_qty || 0) + qty,
      status: 'ACTIVE',
      updated_at: now,
    };
    if (payload.expDate) patch.exp_date = payload.expDate;
    await admin.from('product_lots').update(patch).eq('id', existing.id).eq('org_id', resolvedOrgId);
    return;
  }
  await admin.from('product_lots').insert({
    org_id: resolvedOrgId, sku: payload.sku, lot_number: payload.lotNumber, batch_number: '',
    mfg_date: payload.mfgDate || null, exp_date: payload.expDate || null, status: 'ACTIVE',
    received_qty: qty, current_qty: qty, unit_cost: Number(payload.unitCost) || 0,
    notes: payload.note || '', updated_at: now,
  });
}

/** Decrement current_qty (clamped at 0) on product_lots when lotted stock is consumed. */
export async function consumeLotQty(
  orgId: string,
  sku: string,
  lotNumber: string,
  qty: number,
): Promise<void> {
  const deduct = Math.max(0, Number(qty) || 0);
  if (!lotNumber || deduct <= 0) return;
  const admin = getServiceSupabase();
  const { data: existing } = await admin
    .from('product_lots')
    .select('id, current_qty')
    .eq('org_id', orgId)
    .eq('sku', sku)
    .eq('lot_number', lotNumber)
    .maybeSingle();
  if (!existing) return;
  const nextQty = Math.max(0, Number(existing.current_qty || 0) - deduct);
  await admin
    .from('product_lots')
    .update({ current_qty: nextQty, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .eq('org_id', orgId);
}
