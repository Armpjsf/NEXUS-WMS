// Returns / RMA: REQUESTED → APPROVED → RECEIVED → RESTOCKED | SCRAPPED (or REJECTED).
// On RESTOCKED, stock is incremented and an IN transaction is logged.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export type RmaStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'RESTOCKED' | 'SCRAPPED' | 'REJECTED';

export interface RmaLine { sku: string; name: string; qty: number; }
export interface ReturnOrder {
  id: string;
  rmaNo: string;
  orderNo: string;
  customerName: string;
  reason: string;
  status: RmaStatus;
  disposition: string;
  items: RmaLine[];
  createdBy: string;
  notes: string;
  createdAt: string;
}

function mapRma(r: any): ReturnOrder {
  const items: RmaLine[] = Array.isArray(r.items_json) ? r.items_json : [];
  return {
    id: r.id, rmaNo: r.rma_no, orderNo: r.order_no || '', customerName: r.customer_name || '',
    reason: r.reason || '', status: r.status || 'REQUESTED', disposition: r.disposition || '',
    items, createdBy: r.created_by || '', notes: r.notes || '', createdAt: r.created_at,
  };
}

async function nextRmaNo(): Promise<string> {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `RMA-${ymd}-`;
  const { count } = await supabase.from('return_orders').select('id', { count: 'exact', head: true }).like('rma_no', `${prefix}%`);
  return `${prefix}${String((count || 0) + 1).padStart(3, '0')}`;
}

export async function listReturns(opts: { status?: string } = {}): Promise<ReturnOrder[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase.from('return_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(200);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) { console.error('[returns] list error:', error); return []; }
  return (data || []).map(mapRma);
}

export async function getReturn(id: string): Promise<ReturnOrder | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from('return_orders').select('*').eq('id', id).eq('org_id', orgId).maybeSingle();
  if (error || !data) return null;
  return mapRma(data);
}

export async function createReturn(input: {
  orderNo?: string; customerName?: string; reason?: string; items: RmaLine[]; createdBy?: string; notes?: string;
}): Promise<ReturnOrder | null> {
  const rmaNo = await nextRmaNo();
  const orgId = await getCurrentOrgId();
  const items = (input.items || []).map((l) => ({ sku: l.sku, name: l.name, qty: Number(l.qty) || 0 }));
  const { data, error } = await supabase.from('return_orders').insert({
    org_id: orgId,
    rma_no: rmaNo, order_no: input.orderNo || '', customer_name: input.customerName || '',
    reason: input.reason || '', status: 'REQUESTED', items_json: items,
    created_by: input.createdBy || 'System', notes: input.notes || '',
  }).select().single();
  if (error) { console.error('[returns] create error:', error); return null; }
  return mapRma(data);
}

// Restock returned goods: increment stock + log IN transaction.
async function restock(rma: ReturnOrder, orgId: string) {
  const admin = getServiceSupabase();
  for (const line of rma.items) {
    const { data: prod } = await admin.from('products').select('stock, name, location, price').eq('org_id', orgId).eq('sku', line.sku).maybeSingle();
    if (prod) {
      await admin.from('products').update({ stock: Number(prod.stock || 0) + line.qty, updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('sku', line.sku);
    }
    await admin.from('stock_transactions').insert({
      org_id: orgId,
      type: 'IN', sku: line.sku, product_name: line.name || prod?.name || line.sku,
      qty: line.qty, unit_price: Number(prod?.price || 0), doc_ref: `${rma.rmaNo} (คืน)`,
      location: prod?.location || '', user_name: rma.createdBy || 'Warehouse',
    });
  }
}

export async function updateReturn(
  id: string,
  patch: Partial<{ status: RmaStatus; disposition: string; notes: string }>,
): Promise<ReturnOrder | null> {
  const current = await getReturn(id);
  if (!current) return null;

  const orgId = await getCurrentOrgId();
  const movingToRestocked = patch.status === 'RESTOCKED' && current.status !== 'RESTOCKED';
  if (movingToRestocked) await restock(current, orgId);

  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.disposition !== undefined) row.disposition = patch.disposition;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const { data, error } = await getServiceSupabase().from('return_orders').update(row).eq('id', id).eq('org_id', orgId).select().single();
  if (error) { console.error('[returns] update error:', error); return null; }
  return mapRma(data);
}
