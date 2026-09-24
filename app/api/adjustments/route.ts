import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { nextDocNumber } from '@/lib/docNumber';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
      .from('stock_adjustment_requests')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    console.warn('Adjustments query error:', err?.message);
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { sku, productName, locationCode, systemQty, countedQty, reasonCode, notes, requestedBy = 'Operator' } = body;

    const diffQty = Number(countedQty || 0) - Number(systemQty || 0);
    const requestNo = await nextDocNumber('ADJ', { date: 'yyyymmdd', pad: 4, existing: { table: 'stock_adjustment_requests', column: 'request_no' } });

    const newReq = {
      id: requestNo,
      requestNo,
      sku,
      productName: productName || sku,
      locationCode: locationCode || 'Unassigned',
      systemQty: Number(systemQty || 0),
      countedQty: Number(countedQty || 0),
      diffQty,
      unit: 'ชิ้น',
      reasonCode: reasonCode || 'COUNT_MISMATCH',
      notes: notes || '',
      requestedBy,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };

    try {
      await supabase.from('stock_adjustment_requests').insert({
        org_id: orgId,
        request_no: requestNo,
        sku,
        product_name: productName || sku,
        location_code: locationCode || 'Unassigned',
        system_qty: Number(systemQty || 0),
        counted_qty: Number(countedQty || 0),
        reason_code: reasonCode || 'COUNT_MISMATCH',
        notes: notes || '',
        requested_by: requestedBy,
        status: 'PENDING_APPROVAL'
      });
    } catch (e) {
      console.warn('Adjustment DB insert fallback:', e);
    }

    await recordEnterpriseAudit({
      orgId,
      action: 'INSERT',
      entityName: 'stock_adjustment_requests',
      entityId: requestNo,
      afterState: newReq,
      performedBy: requestedBy,
      reason: `Submitted stock adjustment request ${requestNo} for ${sku} (diff: ${diffQty})`
    });

    return NextResponse.json({
      success: true,
      message: `ส่งคำขอปรับยอดสต็อกหมายเลข ${requestNo} เข้าสู่ระบบรออนุมัติเรียบร้อยแล้ว`,
      data: newReq
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}