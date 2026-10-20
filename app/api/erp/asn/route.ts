import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveErpOrg } from '@/lib/erpAuth';
import { ErpInboundAsnSchema } from '@/lib/erp/erpConnector';
import { nextDocNumber } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

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
    const sourceSystem = request.headers.get('x-erp-source') || 'ERP_EXTERNAL';
    const admin = getServiceSupabase();

    // 1. Create / Upsert ASN in asn_headers and asn_lines
    const supplierLabel = asn.supplierName || asn.supplierCode || '';
    const asnNotes = `Dock: ${asn.dockBay || 'BAY-01'}${asn.containerNumber ? `, Container: ${asn.containerNumber}` : ''}`;

    const { data: asnHeader, error: asnErr } = await admin
      .from('asn_headers')
      .upsert(
        {
          org_id: orgId,
          asn_no: asn.asnNumber,
          supplier: supplierLabel,
          po_number: asn.asnNumber,
          eta: asn.expectedDeliveryDate || null,
          status: 'PENDING',
          notes: asnNotes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,asn_no' }
      )
      .select()
      .single();

    let asnId: string | null = null;
    if (!asnErr && asnHeader) {
      asnId = asnHeader.id;
      await admin.from('asn_lines').delete().eq('org_id', orgId).eq('asn_id', asnHeader.id);
      const lineRows = asn.items.map(i => ({
        org_id: orgId,
        asn_id: asnHeader.id,
        sku: i.sku,
        name: i.productName || i.sku,
        expected_qty: Number(i.expectedQty) || 0,
      }));
      await admin.from('asn_lines').insert(lineRows);
    }

    // 2. Create an EXPECTED receipt in receipts scoped to auth.orgId
    const receiptNo = await nextDocNumber('GRN', { existing: { table: 'receipts', column: 'receipt_no' } });
    const receiptItems = asn.items.map(i => ({
      sku: i.sku,
      name: i.productName || i.sku,
      expected_qty: Number(i.expectedQty) || 0,
      received_qty: 0,
      putaway_bin: asn.dockBay || '',
      done: false,
      ...(Number(i.unitCost) > 0 ? { unit_cost: Number(i.unitCost) } : {}),
      ...(i.lotNumber ? { lot_no: i.lotNumber } : {}),
      ...(i.expDate ? { exp_date: i.expDate } : {}),
    }));

    const { data: receiptRow } = await admin
      .from('receipts')
      .insert({
        org_id: orgId,
        receipt_no: receiptNo,
        po_number: asn.asnNumber,
        supplier: supplierLabel,
        status: 'EXPECTED',
        items_json: receiptItems,
        created_by: sourceSystem,
        notes: `[${sourceSystem}] ASN ${asn.asnNumber} (${asnNotes})`,
      })
      .select()
      .single();

    if (asnId && receiptRow?.id) {
      await admin
        .from('asn_headers')
        .update({ receipt_id: receiptRow.id, updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .eq('id', asnId);
    }

    // 3. Log to erp_sync_logs
    await admin.from('erp_sync_logs').insert({
      org_id: orgId,
      direction: 'INBOUND_ASN',
      source_system: sourceSystem,
      reference_doc: asn.asnNumber,
      payload: asn,
      status: 'SUCCESS',
      processed_items: asn.items.length
    });

    return NextResponse.json({
      success: true,
      message: `ASN ${asn.asnNumber} ingested successfully with ${asn.items.length} items. Assigned to ${asn.dockBay}.`,
      asnNumber: asn.asnNumber,
      asnId,
      receiptId: receiptRow?.id || null,
      receiptNo: receiptRow?.receipt_no || receiptNo,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
