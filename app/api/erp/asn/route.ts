import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveErpOrg } from '@/lib/erpAuth';
import { ErpInboundAsnSchema } from '@/lib/erp/erpConnector';

export async function POST(request: Request) {
  try {
    const auth = await resolveErpOrg(request);
    if (auth.error) return auth.error;
    const orgId = auth.orgId;
    const body = await request.json();

    const parseResult = ErpInboundAsnSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.format()
      }, { status: 400 });
    }

    const asn = parseResult.data;

    // Log to erp_sync_logs
    await supabase.from('erp_sync_logs').insert({
      org_id: orgId,
      direction: 'INBOUND_ASN',
      source_system: request.headers.get('x-erp-source') || 'ERP_EXTERNAL',
      reference_doc: asn.asnNumber,
      payload: asn,
      status: 'SUCCESS',
      processed_items: asn.items.length
    });

    return NextResponse.json({
      success: true,
      message: `ASN ${asn.asnNumber} ingested successfully with ${asn.items.length} items. Assigned to ${asn.dockBay}.`,
      asnNumber: asn.asnNumber
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}