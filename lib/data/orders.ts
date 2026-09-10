// Outbound order backbone: NEW → PICKING → PICKED → PACKED → SHIPPED → DELIVERED.
// Stock is deducted (and OUT transactions logged) the moment an order ships.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { isTmsEnabled, createTmsDeliveryJob, isCompanyFleetCarrier } from '@/lib/tms';

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

export interface DeliveryDestination {
  drop: number;
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface QCSignatures {
  clientSignature?: string;
  clientName?: string;
  staffSignature?: string;
  staffName?: string;
  signedAt?: string;
  notes?: string;
}

export interface OutboundOrder {
  id: string;
  orderNo: string;
  channel: string;
  refNo: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  branchCode: string;
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
  vehicleType?: string;
  tmsJobId?: string;
  tmsStatus?: string;
  tmsSyncedAt?: string | null;
  destinations?: DeliveryDestination[];
  qcSignatures?: QCSignatures;
}

export function stripQcMetaFromNotes(notes: string): string {
  if (!notes) return '';
  return notes
    .replace(/<!--DESTINATIONS:[\s\S]*?-->/g, '')
    .replace(/<!--QC_SIGS:[\s\S]*?-->/g, '')
    .trim();
}

function mapOrder(r: any): OutboundOrder {
  const items: OrderLine[] = Array.isArray(r.items_json) ? r.items_json : [];
  
  // Extract TMS Job ID and status from columns or fallback from notes
  let tmsJobId = r.tms_job_id || '';
  if (!tmsJobId && r.notes) {
    const m = String(r.notes).match(/\[TMS Job:\s*([^\]]+)\]/i);
    if (m) tmsJobId = m[1].trim();
  }
  let tmsStatus = r.tms_status || '';
  if (!tmsStatus && tmsJobId) {
    tmsStatus = r.status === 'DELIVERED' ? 'Completed' : (r.status === 'SHIPPED' ? 'In Transit' : 'New');
  }

  // Extract branchCode from column or notes
  let branchCode = r.branch_code || '';
  if (!branchCode && r.notes) {
    const bm = String(r.notes).match(/\[Branch:\s*([^\]]+)\]/i);
    if (bm) branchCode = bm[1].trim();
  }

  // Extract vehicleType from column or notes
  let vehicleType = r.vehicle_type || '';
  if (!vehicleType && r.notes) {
    const vm = String(r.notes).match(/\[Vehicle:\s*([^\]]+)\]/i);
    if (vm) vehicleType = vm[1].trim();
  }

  // Extract Multi-drop destinations from column or notes tag
  let destinations: DeliveryDestination[] = [];
  if (Array.isArray(r.destinations_json) && r.destinations_json.length > 0) {
    destinations = r.destinations_json;
  } else if (r.notes) {
    const dm = String(r.notes).match(/<!--DESTINATIONS:(.*?)-->/);
    if (dm) {
      try { destinations = JSON.parse(dm[1]); } catch (_) {}
    }
  }
  if (destinations.length === 0 && r.ship_address) {
    destinations = [{
      drop: 1,
      name: r.customer_name || 'ผู้รับ',
      phone: r.phone || '',
      address: r.ship_address || '',
    }];
  }

  // Extract QC Dual Signatures from columns or notes tag
  let qcSignatures: QCSignatures | undefined = undefined;
  if (r.qc_signatures) {
    qcSignatures = typeof r.qc_signatures === 'string' ? JSON.parse(r.qc_signatures) : r.qc_signatures;
  } else if (r.notes) {
    const sm = String(r.notes).match(/<!--QC_SIGS:(.*?)-->/);
    if (sm) {
      try { qcSignatures = JSON.parse(sm[1]); } catch (_) {}
    }
  }
  if (!qcSignatures && (r.pod_signature || r.qc_client_signature)) {
    qcSignatures = {
      clientSignature: r.qc_client_signature || r.pod_signature || '',
      staffSignature: r.qc_staff_signature || '',
      signedAt: r.picked_at || r.updated_at,
    };
  }

  return {
    id: r.id,
    orderNo: r.order_no,
    channel: r.channel || 'MANUAL',
    refNo: r.ref_no || '',
    customerName: r.customer_name || '',
    phone: r.phone || '',
    shipAddress: r.ship_address || '',
    branchCode,
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
    vehicleType: vehicleType || undefined,
    tmsJobId: tmsJobId || undefined,
    tmsStatus: tmsStatus || undefined,
    tmsSyncedAt: r.tms_synced_at || null,
    destinations,
    qcSignatures,
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

export const getOrders = listOrders;

export async function getOrder(id: string): Promise<OutboundOrder | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from('outbound_orders').select('*').eq('id', id).eq('org_id', orgId).maybeSingle();
  if (error || !data) return null;
  return mapOrder(data);
}

export async function createOrder(input: {
  channel?: string; refNo?: string; customerName?: string; phone?: string;
  shipAddress?: string; carrier?: string; vehicleType?: string; priority?: string; items: OrderLine[]; createdBy?: string; notes?: string;
  branchCode?: string;
  status?: OrderStatus;
  destinations?: DeliveryDestination[];
  qcSignatures?: QCSignatures;
}): Promise<OutboundOrder | null> {
  const targetStatus = input.status || 'NEW';
  const isPrePicked = targetStatus === 'PICKED';
  const items = (input.items || []).map((l) => ({
    sku: l.sku, name: l.name, qty: Number(l.qty) || 0,
    picked: isPrePicked ? (Number(l.qty) || 0) : 0, packed: 0, location: l.location || '', price: Number(l.price) || 0,
  }));
  const totalQty = items.reduce((s, l) => s + l.qty, 0);
  const totalAmount = items.reduce((s, l) => s + l.qty * (l.price || 0), 0);
  const orderNo = await nextOrderNo();
  const orgId = await getCurrentOrgId();

  const targetBranch = (input.branchCode || 'URT').trim();
  const vType = (input.vehicleType || '4-Wheel').trim();

  let initialNotes = input.notes || '';
  if (input.destinations && input.destinations.length > 0) {
    initialNotes = `${initialNotes} <!--DESTINATIONS:${JSON.stringify(input.destinations)}-->`.trim();
  }
  if (input.qcSignatures) {
    initialNotes = `${initialNotes} <!--QC_SIGS:${JSON.stringify(input.qcSignatures)}-->`.trim();
  }

  const insertPayload: Record<string, any> = {
    org_id: orgId,
    order_no: orderNo,
    channel: input.channel || 'MANUAL',
    ref_no: input.refNo || '',
    customer_name: input.customerName || '',
    phone: input.phone || '',
    ship_address: input.shipAddress || '',
    carrier: input.carrier || '',
    vehicle_type: vType,
    status: targetStatus,
    ...(isPrePicked ? { picked_at: new Date().toISOString() } : {}),
    priority: input.priority || 'NORMAL',
    items_json: items,
    total_qty: totalQty,
    total_amount: totalAmount,
    created_by: input.createdBy || 'System',
    notes: initialNotes,
    branch_code: targetBranch,
  };

  // Attempt insert with branch_code and vehicle_type
  let { data, error } = await supabase.from('outbound_orders').insert(insertPayload).select().single();

  // If failed (e.g. vehicle_type or branch_code column doesn't exist yet in Supabase)
  if (error || !data) {
    const fallbackNotes = `${initialNotes ? initialNotes + ' ' : ''}[Branch: ${targetBranch}] [Vehicle: ${vType}]`.trim();
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.vehicle_type;
    delete fallbackPayload.branch_code;
    fallbackPayload.notes = fallbackNotes;

    const retryRes = await supabase.from('outbound_orders').insert(fallbackPayload).select().single();
    data = retryRes.data;
    error = retryRes.error;
  }

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
    status: OrderStatus; items: OrderLine[]; carrier: string; trackingNo: string; vehicleType: string;
    boxCount: number; weightKg: number; podSignature: string; podPhoto: string; podNote: string;
    priority: string; notes: string; tmsJobId: string; tmsStatus: string;
    destinations: DeliveryDestination[]; qcSignatures: QCSignatures;
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
  if (patch.vehicleType !== undefined) row.vehicle_type = patch.vehicleType;
  if (patch.trackingNo !== undefined) row.tracking_no = patch.trackingNo;
  if (patch.boxCount !== undefined) row.box_count = patch.boxCount;
  if (patch.weightKg !== undefined) row.weight_kg = patch.weightKg;
  if (patch.podSignature !== undefined) row.pod_signature = patch.podSignature;
  if (patch.podPhoto !== undefined) row.pod_photo = patch.podPhoto;
  if (patch.podNote !== undefined) row.pod_note = patch.podNote;
  if (patch.priority !== undefined) row.priority = patch.priority;

  // Handle destinations and qcSignatures serialized cleanly inside notes
  let currentNotes = patch.notes !== undefined ? patch.notes : (current.notes || '');
  if (patch.destinations !== undefined) {
    currentNotes = currentNotes.replace(/<!--DESTINATIONS:[\s\S]*?-->/g, '').trim();
    if (patch.destinations.length > 0) {
      currentNotes = `${currentNotes} <!--DESTINATIONS:${JSON.stringify(patch.destinations)}-->`.trim();
    }
  }
  if (patch.qcSignatures !== undefined) {
    currentNotes = currentNotes.replace(/<!--QC_SIGS:[\s\S]*?-->/g, '').trim();
    currentNotes = `${currentNotes} <!--QC_SIGS:${JSON.stringify(patch.qcSignatures)}-->`.trim();
    if (patch.qcSignatures.clientSignature && !patch.podSignature) {
      row.pod_signature = patch.qcSignatures.clientSignature;
    }
  }
  if (currentNotes !== (current.notes || '') || patch.notes !== undefined || patch.destinations !== undefined || patch.qcSignatures !== undefined) {
    row.notes = currentNotes;
  }

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

  let { data, error } = await getServiceSupabase()
    .from('outbound_orders').update(row).eq('id', id).eq('org_id', orgId).select().single();
  
  if (error && error.message && error.message.includes('vehicle_type')) {
    delete row.vehicle_type;
    if (patch.vehicleType) {
      row.notes = `${row.notes || current.notes || ''} [Vehicle: ${patch.vehicleType}]`.trim();
    }
    const retry = await getServiceSupabase()
      .from('outbound_orders').update(row).eq('id', id).eq('org_id', orgId).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('[orders] update error:', error);
    return null;
  }
  const mapped = mapOrder(data);

  // Hand the shipment to the TMS (ePOD) delivery system when the order first
  // reaches SHIPPED and is handled by the company's internal delivery fleet.
  // 3PL express carriers (Flash, Kerry, etc.) are skipped.
  if (movingToShipped && isTmsEnabled() && isCompanyFleetCarrier(mapped.carrier)) {
    const r = await createTmsDeliveryJob(mapped);
    if (r.ok && r.jobId) {
      console.log(`[tms] delivery job ${r.jobId} created for order ${mapped.orderNo}`);
      try {
        const updateTmsPayload: Record<string, any> = {
          tms_job_id: r.jobId,
          tms_status: 'New',
          tms_synced_at: new Date().toISOString(),
        };
        if (!mapped.trackingNo) {
          updateTmsPayload.tracking_no = r.jobId;
        }

        const { error: tmsErr } = await getServiceSupabase()
          .from('outbound_orders')
          .update(updateTmsPayload)
          .eq('id', id)
          .eq('org_id', orgId);

        if (tmsErr) {
          // Column might not exist yet: fallback to storing in notes and tracking_no
          const noteWithTms = `${mapped.notes ? mapped.notes + ' ' : ''}[TMS Job: ${r.jobId}]`.trim();
          await getServiceSupabase()
            .from('outbound_orders')
            .update({
              notes: noteWithTms,
              tracking_no: mapped.trackingNo || r.jobId,
            })
            .eq('id', id)
            .eq('org_id', orgId);
        }

        mapped.tmsJobId = r.jobId;
        mapped.tmsStatus = 'New';
        if (!mapped.trackingNo) mapped.trackingNo = r.jobId;
      } catch (tmsSaveErr) {
        console.warn('[orders] failed to save tms_job_id:', tmsSaveErr);
      }
    }
  }

  return mapped;
}

// Close WMS order automatically upon receiving POD from TMS Webhook
export async function closeOrderFromTmsPod(input: {
  orderNo?: string;
  tmsJobId?: string;
  signatureUrl?: string | null;
  photoUrls?: string[];
  deliveryDate?: string;
  receiverName?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  notes?: string;
}): Promise<{ ok: boolean; order?: OutboundOrder; error?: string }> {
  const admin = getServiceSupabase();
  let query = admin.from('outbound_orders').select('*');

  if (input.orderNo) {
    query = query.eq('order_no', input.orderNo);
  } else if (input.tmsJobId) {
    query = query.or(`tms_job_id.eq.${input.tmsJobId},notes.ilike.%[TMS Job: ${input.tmsJobId}]%,tracking_no.eq.${input.tmsJobId}`);
  } else {
    return { ok: false, error: 'Missing orderNo or tmsJobId' };
  }

  const { data: orderRow, error: findError } = await query.maybeSingle();
  if (findError || !orderRow) {
    return { ok: false, error: `Order not found (${input.orderNo || input.tmsJobId})` };
  }

  const podNotesParts: string[] = [];
  if (input.receiverName) podNotesParts.push(`ผู้รับ: ${input.receiverName}`);
  if (input.driverName) podNotesParts.push(`คนขับ: ${input.driverName}`);
  if (input.vehiclePlate) podNotesParts.push(`ทะเบียน: ${input.vehiclePlate}`);
  if (input.notes) podNotesParts.push(input.notes);
  const podNoteStr = podNotesParts.join(' | ') || 'ส่งมอบสำเร็จผ่านระบบ TMS ePOD';

  const deliveredAt = input.deliveryDate ? new Date(input.deliveryDate).toISOString() : new Date().toISOString();
  const photoUrl = (input.photoUrls && input.photoUrls.length > 0)
    ? input.photoUrls.join(',')
    : (orderRow.pod_photo || '');

  const updateData: Record<string, any> = {
    status: 'DELIVERED',
    delivered_at: deliveredAt,
    pod_signature: input.signatureUrl || orderRow.pod_signature || '',
    pod_photo: photoUrl,
    pod_note: podNoteStr,
    tms_status: 'Completed',
    tms_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Try updating with tms columns
  let { data: updated, error: updateError } = await admin
    .from('outbound_orders')
    .update(updateData)
    .eq('id', orderRow.id)
    .select()
    .single();

  if (updateError) {
    // Fallback: strip extra columns if not yet migrated in Supabase
    delete updateData.tms_status;
    delete updateData.tms_synced_at;
    const { data: fbData, error: fbError } = await admin
      .from('outbound_orders')
      .update(updateData)
      .eq('id', orderRow.id)
      .select()
      .single();

    if (fbError) {
      console.error('[orders] closeOrderFromTmsPod error:', fbError);
      return { ok: false, error: fbError.message };
    }
    updated = fbData;
  }

  // Log in Audit Trail
  try {
    await admin.from('audit_log').insert({
      org_id: orderRow.org_id,
      user_name: 'TMS ePOD Bot',
      action: 'UPDATE',
      module: 'ORDERS',
      record_id: orderRow.id,
      description: `ปิดออเดอร์อัตโนมัติ ${orderRow.order_no} เป็น DELIVERED ผ่าน TMS (คนขับ: ${input.driverName || '-'})`,
      new_values: { status: 'DELIVERED', pod_signature: input.signatureUrl ? 'มี' : 'ไม่มี', photos_count: input.photoUrls?.length || 0 },
    });
  } catch (e) {
    /* ignore audit log failure */
  }

  return { ok: true, order: mapOrder(updated) };
}

// On-demand status sync with TMS
export async function syncOrderWithTms(orderId: string): Promise<{ ok: boolean; order?: OutboundOrder; message?: string }> {
  const current = await getOrder(orderId);
  if (!current) return { ok: false, message: 'Order not found' };

  const targetJobId = current.tmsJobId || (current.trackingNo.startsWith('JOB-') ? current.trackingNo : undefined);
  const { fetchTmsJobStatus } = await import('@/lib/tms');
  const tmsRes = await fetchTmsJobStatus({ jobId: targetJobId, orderNo: current.orderNo });

  if (!tmsRes.ok || !tmsRes.job) {
    return { ok: false, message: tmsRes.error || 'TMS Job not found' };
  }

  const job = tmsRes.job;

  // If completed in TMS, auto-close WMS order with full POD
  if (job.isCompleted) {
    const closeRes = await closeOrderFromTmsPod({
      orderNo: current.orderNo,
      tmsJobId: job.jobId,
      signatureUrl: job.signatureUrl,
      photoUrls: job.photoUrls,
      deliveryDate: job.deliveryDate,
      receiverName: job.receiverName,
      driverName: job.driverName,
      vehiclePlate: job.vehiclePlate,
    });
    if (closeRes.ok && closeRes.order) {
      return { ok: true, order: closeRes.order, message: 'อัปเดตเป็นจัดส่งสำเร็จ (DELIVERED) พร้อมหลักฐาน POD เรียบร้อย' };
    }
  }

  // Update status and tracking info
  const patch: any = {
    tmsJobId: job.jobId,
    tmsStatus: job.status,
  };
  if (!current.trackingNo && job.jobId) {
    patch.trackingNo = job.jobId;
  }

  // Try saving tms_status to db
  try {
    const admin = getServiceSupabase();
    await admin.from('outbound_orders').update({
      tms_status: job.status,
      tms_job_id: job.jobId,
      tms_synced_at: new Date().toISOString(),
    }).eq('id', current.id);
  } catch {
    /* ignore */
  }

  const refreshed = await getOrder(orderId);
  return { ok: true, order: refreshed || current, message: `สถานะ TMS ล่าสุด: ${job.status}` };
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
