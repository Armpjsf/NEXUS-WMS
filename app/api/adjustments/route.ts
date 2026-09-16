import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';

export const dynamic = 'force-dynamic';

// In-memory fallback
const memoryAdjustments: any[] = [
  {
    id: 'ADJ-2026-001',
    requestNo: 'ADJ-2026-001',
    sku: 'SKU-BEV-002',
    productName: 'นมสดพาสเจอร์ไรส์ 100% (2 ลิตร)',
    locationCode: 'B-02-01',
    systemQty: 80,
    countedQty: 76,
    diffQty: -4,
    unit: 'ขวด',
    reasonCode: 'EXPIRED',
    reasonLabel: 'หมดอายุ / เสียสภาพ',
    notes: 'พบสินค้ากล่องบวมระหว่างตรวจนับรอบเช้า',
    requestedBy: 'นายสมศักดิ์ (หัวหน้าทีมหยิบ)',
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString()
  },
  {
    id: 'ADJ-2026-002',
    requestNo: 'ADJ-2026-002',
    sku: 'SKU-MED-001',
    productName: 'พาราเซตามอล 500mg (100 เม็ด)',
    locationCode: 'A-01-02',
    systemQty: 150,
    countedQty: 152,
    diffQty: +2,
    unit: 'กล่อง',
    reasonCode: 'COUNT_MISMATCH',
    reasonLabel: 'ตรวจนับเกินจากยอดบันทึก',
    notes: 'พบเกินจากการจัดของค้างในถาดหยิบ',
    requestedBy: 'วิชัย (Operator)',
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString()
  }
];

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await supabase
      .from('stock_adjustment_requests')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return NextResponse.json({ success: true, data });
    }
  } catch (err) {
    console.warn('Adjustments query fallback:', err);
  }

  return NextResponse.json({ success: true, data: memoryAdjustments });
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { sku, productName, locationCode, systemQty, countedQty, reasonCode, notes, requestedBy = 'Operator' } = body;

    const diffQty = Number(countedQty || 0) - Number(systemQty || 0);
    const requestNo = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

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

    memoryAdjustments.unshift(newReq);

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