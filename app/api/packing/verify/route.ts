import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderNo, scannedBarcode, currentItems = [] } = body;

    if (!scannedBarcode) {
      return NextResponse.json({ error: 'ไม่พบบาร์โค้ดที่สแกน' }, { status: 400 });
    }

    const cleanCode = scannedBarcode.trim().toLowerCase();
    
    // Find matching item by SKU or Barcode
    const matchIndex = currentItems.findIndex((it: any) => 
      (it.sku && it.sku.toLowerCase() === cleanCode) ||
      (it.barcode && it.barcode.toLowerCase() === cleanCode) ||
      (it.name && it.name.toLowerCase().includes(cleanCode))
    );

    if (matchIndex === -1) {
      return NextResponse.json({
        success: false,
        isMatch: false,
        error: `❌ สินค้าไม่ตรงออเดอร์! บาร์โค้ด "${scannedBarcode}" ไม่อยู่ในรายการสั่งซื้อนี้`,
        scannedCode: scannedBarcode
      }, { status: 422 });
    }

    const targetItem = currentItems[matchIndex];
    const currentVerified = targetItem.verifiedQty || 0;
    const requested = targetItem.qty || targetItem.requestedQty || 1;

    if (currentVerified >= requested) {
      return NextResponse.json({
        success: false,
        isMatch: true,
        isOverpack: true,
        error: `⚠️ สแกนเกินจำนวน! SKU "${targetItem.sku}" ครบตามจำนวนแล้ว (${requested} ชิ้น)`,
        item: targetItem
      }, { status: 422 });
    }

    const updatedItem = {
      ...targetItem,
      verifiedQty: currentVerified + 1,
      isVerified: (currentVerified + 1) >= requested
    };

    return NextResponse.json({
      success: true,
      isMatch: true,
      message: `✅ สแกนตรวจถูกต้อง: ${targetItem.sku} (${currentVerified + 1}/${requested})`,
      updatedItem,
      matchIndex
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}