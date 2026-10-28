import { NextRequest, NextResponse } from 'next/server';
import { listCodRecords, settleCodOrders } from '@/lib/data/cod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get('status') || 'ALL') as 'PENDING' | 'REMITTED' | 'ALL';
    const driver = searchParams.get('driver') || undefined;
    const tripId = searchParams.get('tripId') || undefined;
    const search = searchParams.get('search') || undefined;

    const data = await listCodRecords({ status, driver, tripId, search });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to list COD records:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลกระทบยอดเงินสด' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderIds, settledAmount, paymentChannel, transferRef, shortageReason, settledBy, markDelivered } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุ orderIds อย่างน้อย 1 รายการ' }, { status: 400 });
    }

    const result = await settleCodOrders({
      orderIds,
      settledAmount: settledAmount !== undefined ? Number(settledAmount) : undefined,
      paymentChannel: paymentChannel || 'CASH',
      transferRef: transferRef || '',
      shortageReason: shortageReason || '',
      settledBy: settledBy || 'แคชเชียร์คลังสินค้า',
      markDelivered: markDelivered ?? true,
    });

    return NextResponse.json({
      success: true,
      message: `บันทึกรับเงินนำส่งสำเร็จ ออกใบเสร็จเลขที่ ${result.receiptNo}`,
      ...result,
    });
  } catch (error: any) {
    console.error('Failed to settle COD orders:', error);
    return NextResponse.json(
      { error: error.message || 'บันทึกรับเงินนำส่งไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
