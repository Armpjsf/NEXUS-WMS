import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement } from '@/lib/apiAuth';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { binSet, getBins } from '@/lib/stockLocations';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { requestId, action, approvedBy = guard.user?.name || 'Manager Admin', rejectionReason = '' } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสคำขอและการดำเนินการ (APPROVE / REJECT)' }, { status: 400 });
    }

    const isApprove = action === 'APPROVE';
    const newStatus = isApprove ? 'APPROVED' : 'REJECTED';

    // Load the request so an approval can actually apply the counted qty to the
    // bin. Use the service client — RLS on stock_adjustment_requests otherwise
    // hides the row from the anon client and the adjustment silently no-ops.
    const admin = getServiceSupabase();
    const { data: reqRow } = await admin
      .from('stock_adjustment_requests')
      .select('sku, product_name, location_code, system_qty, counted_qty, status')
      .eq('org_id', orgId)
      .eq('request_no', requestId)
      .maybeSingle();

    if (reqRow?.status && reqRow.status !== 'PENDING_APPROVAL' && reqRow.status !== 'PENDING') {
      return NextResponse.json({ error: 'รายการนี้ถูกดำเนินการไปแล้ว' }, { status: 409 });
    }

    try {
      await admin
        .from('stock_adjustment_requests')
        .update({
          status: newStatus,
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          rejection_reason: isApprove ? null : rejectionReason,
        })
        .eq('org_id', orgId)
        .eq('request_no', requestId);
    } catch (e) {
      console.warn('Adjustment approval update fallback:', e);
    }

    // On approval, set the counted quantity on that specific bin and reconcile
    // the SKU total. Read current bin stock before binSet so the ADJUST
    // transaction logs the true delta against current bin stock.
    let applied = false;
    if (isApprove && reqRow?.sku) {
      try {
        const bin = (reqRow.location_code || 'UNASSIGNED').trim() || 'UNASSIGNED';
        const counted = Number(reqRow.counted_qty || 0);
        const currentBins = await getBins(orgId, reqRow.sku);
        const matchingBins = currentBins.filter(b => b.binCode === bin);
        const currentBinQty = matchingBins.length > 0
          ? matchingBins.reduce((s, b) => s + Number(b.quantity || 0), 0)
          : Number(reqRow.system_qty || 0);

        await binSet(orgId, reqRow.sku, bin, counted);
        applied = true;
        // ledger entry for the correction (positive or negative true delta)
        await admin.from('stock_transactions').insert({
          org_id: orgId,
          type: 'ADJUST',
          sku: reqRow.sku,
          product_name: reqRow.product_name || reqRow.sku,
          qty: counted - currentBinQty,
          unit_price: 0,
          doc_ref: requestId,
          location: bin,
          user_name: approvedBy,
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
      reason: `${newStatus} stock adjustment request ${requestId}. Note: ${rejectionReason || 'Approved'}`,
    });

    return NextResponse.json({
      success: true,
      message: isApprove
        ? `อนุมัติการปรับยอดสต็อกคำขอ ${requestId} เรียบร้อยแล้ว${applied ? ' (ยอดในระบบถูกอัปเดตแล้ว)' : ''}`
        : `ปฏิเสธคำขอปรับยอดสต็อก ${requestId} แล้ว`,
      status: newStatus,
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
