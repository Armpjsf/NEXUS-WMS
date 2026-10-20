import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveErpOrg } from '@/lib/erpAuth';
import { ErpOutboundOrderSchema } from '@/lib/erp/erpConnector';
import { reserveForOrder } from '@/lib/reservations';
import { nextDocNumber } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const auth = await resolveErpOrg(request);
    if (auth.error) return auth.error;
    const orgId = auth.orgId;
    const body = await request.json();

    const parseResult = ErpOutboundOrderSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.format()
      }, { status: 400 });
    }

    const order = parseResult.data;
    const sourceSystem = request.headers.get('x-erp-source') || 'ERP_EXTERNAL';
    const admin = getServiceSupabase();

    // 1. Create Outbound Order in outbound_orders scoped to auth.orgId
    const orderNo = await nextDocNumber('ORD', { existing: { table: 'outbound_orders', column: 'order_no' } });
    const items = order.items.map(i => ({
      sku: i.sku,
      name: i.productName || i.sku,
      qty: Number(i.requestedQty) || 0,
      picked: 0,
      packed: 0,
      location: '',
      price: Number(i.unitPrice) || 0,
      drop: 1,
    }));
    const totalQty = items.reduce((s, l) => s + l.qty, 0);
    const totalAmount = items.reduce((s, l) => s + l.qty * (l.price || 0), 0);
    const priorityMap: Record<string, string> = {
      STANDARD: 'NORMAL',
      EXPRESS: 'HIGH',
      SAMEDAY: 'URGENT',
    };

    const { data: createdOrder, error: orderErr } = await admin
      .from('outbound_orders')
      .insert({
        org_id: orgId,
        order_no: orderNo,
        channel: 'ERP',
        ref_no: order.orderNumber,
        customer_name: order.customerName,
        phone: '',
        ship_address: order.shippingAddress || '',
        carrier: order.carrier || 'STANDARD',
        status: 'NEW',
        priority: priorityMap[order.priority] || 'NORMAL',
        items_json: items,
        total_qty: totalQty,
        total_amount: totalAmount,
        created_by: sourceSystem,
        notes: `[${sourceSystem}] ERP Order #${order.orderNumber}${order.customerCode ? ` (${order.customerCode})` : ''}`,
      })
      .select()
      .single();

    if (orderErr || !createdOrder) {
      return NextResponse.json(
        { success: false, error: orderErr?.message || 'Failed to create outbound order' },
        { status: 500 }
      );
    }

    // 2. Reserve stock for order lines
    let reservation = null;
    try {
      reservation = await reserveForOrder(
        orgId,
        createdOrder.id,
        orderNo,
        items.map(l => ({ sku: l.sku, qty: l.qty }))
      );
    } catch (e) {
      console.warn('[erp/orders] reservation warning (non-fatal):', e);
    }

    // 3. Log to erp_sync_logs
    await admin.from('erp_sync_logs').insert({
      org_id: orgId,
      direction: 'OUTBOUND_ORDER',
      source_system: sourceSystem,
      reference_doc: order.orderNumber,
      payload: order,
      status: 'SUCCESS',
      processed_items: order.items.length
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.orderNumber} (${orderNo}) ingested from ERP and reserved. Ready for Wave Allocation.`,
      orderNumber: order.orderNumber,
      orderNo,
      orderId: createdOrder.id,
      reservation,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
