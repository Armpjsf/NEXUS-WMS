// Outbound order backbone: NEW → PICKING → PICKED → PACKED → SHIPPED → DELIVERED.
// Stock is deducted (and OUT transactions logged) the moment an order ships.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { isTmsEnabled, createTmsDeliveryJob } from '@/lib/tms';

export type OrderStatus =
  | 'NEW' | 'PICKING' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export const ORDER_FLOW: OrderStatus[] = ['NEW', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED'];

export interface OrderLine {
  sku: string;
  name: string;
  qty: number;
  picked?: number;
  packed?: number;
  location?: string;
  price?: number;
}

export interface OutboundOrder {
  id: string;
  orderNo: string;
  channel: string;
  refNo: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  status: OrderStatus;
  priority: string;
  items: OrderLine[];
  totalQty: number;
  totalAmount: number;
  carrier: string;
  trackingNo: string;
  boxCount: number;
  weightKg: number;
  podSignature: string;
  podPhoto: string;
  podNote: string;
  createdBy: string;
  notes: string;
  createdAt: string;
  pickedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

function mapOrder(r: any): OutboundOrder {
  const items: OrderLine[] = Array.isArray(r.items_json) ? r.items_json : [];
  return {
    id: r.id,
    orderNo: r.order_no,
    channel: r.channel || 'MANUAL',
    refNo: r.ref_no || '',
    customerName: r.customer_name || '',
    phone: r.phone || '',
    shipAddress: r.ship_address || '',
    status: r.status || 'NEW',
    priority: r.priority || 'NORMAL',
    items,
    totalQty: Number(r.total_qty ?? 0),
    totalAmount: Number(r.total_amount ?? 0),
    carrier: r.carrier || '',
    trackingNo: r.tracking_no || '',
    boxCount: Number(r.box_count ?? 0),
    weightKg: Number(r.weight_kg ?? 0),
    podSignature: r.pod_signature || '',
    podPhoto: r.pod_photo || '',
    podNote: r.pod_note || '',
    createdBy: r.created_by || '',
    notes: r.notes || '',
    createdAt: r.created_at,
    pickedAt: r.picked_at,
    packedAt: r.packed_at,
    shippedAt: r.shipped_at,
    deliveredAt: r.delivered_at,
  };
}

async function nextOrderNo(): Promise<string> {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `ORD-${ymd}-`;
  const { count } = await supabase
    .from('outbound_orders')
    .select('id', { count: 'exact', head: true })
    .like('order_no', `${prefix}%`);
  return `${prefix}${String((count || 0) + 1).padStart(3, '0')}`;
}

export async function listOrders(opts: { status?: string; limit?: number } = {}): Promise<OutboundOrder[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase.from('outbound_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(opts.limit || 200);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) {
    console.error('[orders] list error:', error);
    return [];
  }
  return (data || []).map(mapOrder);
}

export async function getOrder(id: string): Promise<OutboundOrder | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from('outbound_orders').select('*').eq('id', id).eq('org_id', orgId).maybeSingle();
  if (error || !data) return null;
  return mapOrder(data);
}

export async function createOrder(input: {
  channel?: string; refNo?: string; customerName?: string; phone?: string;
  shipAddress?: string; carrier?: string; priority?: string; items: OrderLine[]; createdBy?: string; notes?: string;
}): Promise<OutboundOrder | null> {
  const items = (input.items || []).map((l) => ({
    sku: l.sku, name: l.name, qty: Number(l.qty) || 0,
    picked: 0, packed: 0, location: l.location || '', price: Number(l.price) || 0,
  }));
  const totalQty = items.reduce((s, l) => s + l.qty, 0);
  const totalAmount = items.reduce((s, l) => s + l.qty * (l.price || 0), 0);
  const orderNo = await nextOrderNo();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase.from('outbound_orders').insert({
    org_id: orgId,
    order_no: orderNo,
    channel: input.channel || 'MANUAL',
    ref_no: input.refNo || '',
    customer_name: input.customerName || '',
    phone: input.phone || '',
    ship_address: input.shipAddress || '',
    carrier: input.carrier || '',
    status: 'NEW',
    priority: input.priority || 'NORMAL',
    items_json: items,
    total_qty: totalQty,
    total_amount: totalAmount,
    created_by: input.createdBy || 'System',
    notes: input.notes || '',
  }).select().single();

  if (error) {
    console.error('[orders] create error:', error);
    return null;
  }
  return mapOrder(data);
}

// Deduct stock + log OUT transactions for every line (called on SHIPPED).
async function commitStockOut(order: OutboundOrder, orgId: string) {
  const admin = getServiceSupabase();
  for (const line of order.items) {
    const { data: prod } = await admin.from('products').select('stock, name, location, price').eq('org_id', orgId).eq('sku', line.sku).maybeSingle();
    const current = Number(prod?.stock || 0);
    const newStock = Math.max(0, current - line.qty);
    if (prod) {
      await admin.from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('org_id', orgId).eq('sku', line.sku);
    }
    await admin.from('stock_transactions').insert({
      org_id: orgId,
      type: 'OUT',
      sku: line.sku,
      product_name: line.name || prod?.name || line.sku,
      qty: line.qty,
      unit_price: line.price || Number(prod?.price || 0),
      doc_ref: order.orderNo,
      location: line.location || prod?.location || '',
      user_name: order.createdBy || 'Warehouse',
    });
  }
}

const STAMP: Record<string, string> = {
  PICKED: 'picked_at', PACKED: 'packed_at', SHIPPED: 'shipped_at', DELIVERED: 'delivered_at',
};

export async function updateOrder(
  id: string,
  patch: Partial<{
    status: OrderStatus; items: OrderLine[]; carrier: string; trackingNo: string;
    boxCount: number; weightKg: number; podSignature: string; podPhoto: string; podNote: string;
    priority: string; notes: string;
  }>,
): Promise<OutboundOrder | null> {
  const current = await getOrder(id);
  if (!current) return null;

  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.items) {
    row.items_json = patch.items;
    row.total_qty = patch.items.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    row.total_amount = patch.items.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  }
  if (patch.carrier !== undefined) row.carrier = patch.carrier;
  if (patch.trackingNo !== undefined) row.tracking_no = patch.trackingNo;
  if (patch.boxCount !== undefined) row.box_count = patch.boxCount;
  if (patch.weightKg !== undefined) row.weight_kg = patch.weightKg;
  if (patch.podSignature !== undefined) row.pod_signature = patch.podSignature;
  if (patch.podPhoto !== undefined) row.pod_photo = patch.podPhoto;
  if (patch.podNote !== undefined) row.pod_note = patch.podNote;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const movingToShipped = patch.status === 'SHIPPED' && current.status !== 'SHIPPED';
  if (patch.status) {
    row.status = patch.status;
    if (STAMP[patch.status]) row[STAMP[patch.status]] = new Date().toISOString();
  }

  // Deduct stock once, when the order first reaches SHIPPED.
  const orgId = await getCurrentOrgId();
  if (movingToShipped) {
    await commitStockOut(current, orgId);
  }

  const { data, error } = await getServiceSupabase()
    .from('outbound_orders').update(row).eq('id', id).eq('org_id', orgId).select().single();
  if (error) {
    console.error('[orders] update error:', error);
    return null;
  }
  const mapped = mapOrder(data);

  // Hand the shipment to the TMS (ePOD) delivery system when the order first
  // reaches SHIPPED. Feature-flagged and fault-isolated: it never throws and is
  // a no-op unless TMS_API_URL/TMS_API_KEY are configured, so the ship flow is
  // unaffected whether TMS is reachable or not.
  if (movingToShipped && isTmsEnabled()) {
    const r = await createTmsDeliveryJob(mapped);
    if (r.ok) console.log(`[tms] delivery job ${r.jobId} created for order ${mapped.orderNo}`);
  }

  return mapped;
}

// Orders still awaiting pick/pack — feeds Wave Picking's "load pending orders".
export async function getPendingFulfillment(): Promise<{ pending_tasks: any[] }> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('outbound_orders')
    .select('order_no, items_json, status, priority')
    .eq('org_id', orgId)
    .in('status', ['NEW', 'PICKING'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[orders] fulfillment error:', error);
    return { pending_tasks: [] };
  }

  const tasks: any[] = [];
  for (const o of data || []) {
    const items: OrderLine[] = Array.isArray(o.items_json) ? o.items_json : [];
    for (const l of items) {
      const remaining = (Number(l.qty) || 0) - (Number(l.picked) || 0);
      if (remaining > 0) {
        tasks.push({ item_name: l.name || l.sku, sku: l.sku, amount: remaining, qty: remaining, order_no: o.order_no, doc_ref: o.order_no });
      }
    }
  }
  return { pending_tasks: tasks };
}
