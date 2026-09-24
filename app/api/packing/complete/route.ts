import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { updateOrder } from '@/lib/data/orders';

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

    // Mark the order PACKED through the order service (outbound_orders, org-
    // scoped, stamps packed_at). This used to write to a non-existent `orders`
    // table and swallow the error, so the UI said "packed" while nothing changed.
    if (orderNo || orderId) {
      let q = supabase.from('outbound_orders').select('id, status').eq('org_id', orgId);
      q = orderId ? q.eq('id', orderId) : q.eq('order_no', orderNo);
      const { data: row, error: findErr } = await q.maybeSingle();
      if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
      if (!row) return NextResponse.json({ error: `ไม่พบออเดอร์ ${orderNo || orderId}` }, { status: 404 });
      // Never move a shipped/delivered/cancelled order back to PACKED.
      if (!['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(row.status)) {
        const updated = await updateOrder(row.id, {
          status: 'PACKED',
          ...(Number(actualWeightKg) > 0 ? { weightKg: Number(actualWeightKg) } : {}),
        });
        if (!updated) return NextResponse.json({ error: 'อัปเดตสถานะออเดอร์ไม่สำเร็จ' }, { status: 500 });
      }
    }

    // Audit trail log
    await recordEnterpriseAudit({
      orgId,
      action: 'UPDATE',
      entityName: 'outbound_orders',
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