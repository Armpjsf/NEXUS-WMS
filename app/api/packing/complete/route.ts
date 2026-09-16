import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { orderNo, orderId, packedBy = 'Operator', actualWeightKg = 0, estWeightKg = 0, items = [] } = body;

    // Weight tolerance check (±15%)
    let weightStatus = 'MATCHED';
    if (estWeightKg > 0 && actualWeightKg > 0) {
      const diffPercent = Math.abs(actualWeightKg - estWeightKg) / estWeightKg;
      if (diffPercent > 0.15) {
        weightStatus = actualWeightKg > estWeightKg ? 'OVERWEIGHT' : 'UNDERWEIGHT';
      }
    }

    // Try update order in DB to PACKED
    try {
      if (orderNo) {
        await supabase
          .from('orders')
          .update({
            status: 'PACKED',
            packed_at: new Date().toISOString()
          })
          .eq('org_id', orgId)
          .eq('order_no', orderNo);
      }
    } catch (e) {
      console.warn('Order status update fallback:', e);
    }

    // Audit trail log
    await recordEnterpriseAudit({
      orgId,
      action: 'UPDATE',
      entityName: 'orders',
      entityId: orderNo || orderId || 'PACK-SESSION',
      afterState: { status: 'PACKED', packedBy, actualWeightKg, estWeightKg, weightStatus },
      performedBy: packedBy,
      reason: `Completed Packing QA verification for order ${orderNo}. Weight status: ${weightStatus}`
    });

    return NextResponse.json({
      success: true,
      message: `บรรจุหีบห่อและตรวจสอบความถูกต้องของออเดอร์ ${orderNo} เรียบร้อยแล้ว`,
      weightStatus,
      packedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}