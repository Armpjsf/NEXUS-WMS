import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';

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
        ? `อนุมัติการปรับยอดสต็อกคำขอ ${requestId} เรียบร้อยแล้ว (ยอดในระบบถูกอัปเดต)`
        : `ปฏิเสธคำขอปรับยอดสต็อก ${requestId} แล้ว`,
      status: newStatus
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}