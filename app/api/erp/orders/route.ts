import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveErpOrg } from '@/lib/erpAuth';
import { ErpOutboundOrderSchema } from '@/lib/erp/erpConnector';
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

    // Log to erp_sync_logs
    await supabase.from('erp_sync_logs').insert({
      org_id: orgId,
      direction: 'OUTBOUND_ORDER',
      source_system: request.headers.get('x-erp-source') || 'ERP_EXTERNAL',
      reference_doc: order.orderNumber,
      payload: order,
      status: 'SUCCESS',
      processed_items: order.items.length
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.orderNumber} ingested from ERP. Ready for Wave Allocation.`,
      orderNumber: order.orderNumber
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}