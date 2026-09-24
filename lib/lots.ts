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

/** Add received qty to a lot (creating it if new); sets expiry when given. */
export async function recordLotReceipt(
  admin: Admin,
  orgId: string,
  p: { sku: string; lotNumber: string; qty: number; expDate?: string | null; mfgDate?: string | null; unitCost?: number; note?: string },
): Promise<void> {
  const qty = Math.max(0, Number(p.qty) || 0);
  const now = new Date().toISOString();
  const { data: existing } = await admin.from('product_lots')
    .select('id, received_qty, current_qty, exp_date')
    .eq('org_id', orgId).eq('sku', p.sku).eq('lot_number', p.lotNumber).maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {
      received_qty: Number(existing.received_qty || 0) + qty,
      current_qty: Number(existing.current_qty || 0) + qty,
      status: 'ACTIVE',
      updated_at: now,
    };
    if (p.expDate) patch.exp_date = p.expDate;
    await admin.from('product_lots').update(patch).eq('id', existing.id).eq('org_id', orgId);
    return;
  }
  await admin.from('product_lots').insert({
    org_id: orgId, sku: p.sku, lot_number: p.lotNumber, batch_number: '',
    mfg_date: p.mfgDate || null, exp_date: p.expDate || null, status: 'ACTIVE',
    received_qty: qty, current_qty: qty, unit_cost: Number(p.unitCost) || 0,
    notes: p.note || '', updated_at: now,
  });
}
