import { NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { binSet } from '@/lib/stockLocations';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { requestId, action, approvedBy = 'Manager Admin', rejectionReason = '' } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสคำขอและการดำเนินการ (APPROVE / REJECT)' }, { status: 400 });
    }

    const isApprove = action === 'APPROVE';
    const newStatus = isApprove ? 'APPROVED' : 'REJECTED';

    // Load the request so an approval can actually apply the counted qty to the bin.
    const { data: reqRow } = await supabase
      .from('stock_adjustment_requests')
      .select('sku, product_name, location_code, system_qty, counted_qty')
      .eq('org_id', orgId).eq('request_no', requestId).maybeSingle();

    try {
      await supabase
        .from('stock_adjustment_requests')
        .update({
          status: newStatus,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          rejection_reason: isApprove ? null : rejectionReason
        })
        .eq('org_id', orgId)
        .eq('request_no', requestId);
    } catch (e) {
      console.warn('Adjustment approval update fallback:', e);
    }

    // On approval, set the counted quantity on that specific bin and reconcile
    // the SKU total. This was previously a no-op (status changed but stock never
    // moved), so counts were approved without ever correcting the balance.
    let applied = false;
    if (isApprove && reqRow?.sku) {
      try {
        const bin = reqRow.location_code || 'UNASSIGNED';
        const counted = Number(reqRow.counted_qty || 0);
        const systemQty = Number(reqRow.system_qty || 0);
        await binSet(orgId, reqRow.sku, bin, counted);
        applied = true;
        // ledger entry for the correction (positive or negative)
        await getServiceSupabase().from('stock_transactions').insert({
          org_id: orgId, type: 'ADJUST', sku: reqRow.sku,
          product_name: reqRow.product_name || reqRow.sku,
          qty: counted - systemQty, unit_price: 0,
          doc_ref: requestId, location: bin, user_name: approvedBy,
        });
      } catch (e) {
        console.warn('Adjustment stock apply failed:', e);
      }
    }

    await recordEnterpriseAudit({
      orgId,
      action: 'UPDATE',
      entityName: 'stock_adjustment_requests',
      entityId: requestId,
      afterState: { status: newStatus, approvedBy, rejectionReason },
      performedBy: approvedBy,
      reason: `${newStatus} stock adjustment request ${requestId}. Note: ${rejectionReason || 'Approved'}`
    });

    return NextResponse.json({
      success: true,
      message: isApprove
        ? `อนุมัติการปรับยอดสต็อกคำขอ ${requestId} เรียบร้อยแล้ว${applied ? ' (ยอดในระบบถูกอัปเดตแล้ว)' : ''}`
        : `ปฏิเสธคำขอปรับยอดสต็อก ${requestId} แล้ว`,
      status: newStatus
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}