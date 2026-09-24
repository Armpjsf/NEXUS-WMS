import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { resetBinsBulk } from '@/lib/stockLocations';
import { upsertProductsForOrg } from '@/lib/data/productUpsert';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการสินค้าสำหรับนำเข้า' }, { status: 400 });
    }

    const cleanedProducts = products.map((item: any) => {
      const rawSku = (item.sku || item['รหัสสินค้า'] || item.id || item.name || '').toString().trim();
      const rawName = (item.name || item['ชื่อสินค้า'] || rawSku).toString().trim();
      const sku = rawSku || rawName;

      const rawStatus = (item.status ?? item['สถานะ'] ?? item['สถานะ (Status)'] ?? 'Active').toString().trim();
      const isInactive = ['inactive', 'ยกเลิก', 'discontinued', 'ระงับ', 'หมด'].includes(rawStatus.toLowerCase());
      const status = isInactive ? 'Inactive' : (rawStatus || 'Active');

      return {
        org_id: orgId,
        sku: sku,
        name: rawName,
        category: (item.category || item['หมวดหมู่'] || 'General').toString().trim(),
        stock: Number(item.stock ?? item['จำนวน'] ?? item['จำนวนคงเหลือ'] ?? 0) || 0,
        min_stock: Number(item.min_stock ?? item.minStock ?? item['จุดสั่งซื้อ'] ?? item['จุดเตือนสต็อกต่ำ'] ?? 5) || 5,
        price: Number(item.price ?? item['ราคา'] ?? item['ราคาขาย'] ?? 0) || 0,
        unit: (item.unit ?? item['หน่วยนับ'] ?? 'ชิ้น').toString().trim(),
        location: (item.location ?? item['พิกัด'] ?? item['พิกัดจัดเก็บ'] ?? item['พิกัดจัดเก็บ (Location)'] ?? 'Unassigned').toString().trim(),
        image_url: (item.image_url ?? item.image ?? item['ลิงก์รูปสินค้า (Image URL)'] ?? item['ลิงก์รูป'] ?? item['รูปภาพ'] ?? '') ? String(item.image_url ?? item.image ?? item['ลิงก์รูปสินค้า (Image URL)'] ?? item['ลิงก์รูป'] ?? item['รูปภาพ']).trim() : null,
        barcode: item.barcode ? item.barcode.toString().trim() : null,
        lot_no: item.lot_no ?? item.lotNo ?? item['หมายเลข Lot'] ?? item['Lot'] ?? null,
        expiry_date: item.expiry_date ?? item.expiryDate ?? item['วันหมดอายุ'] ?? null,
        movement_status: item.movement_status || 'Normal Moving',
        status: status,
        updated_at: new Date().toISOString()
      };
    }).filter(p => p.sku && p.name);

    if (cleanedProducts.length === 0) {
      return NextResponse.json({ error: 'ข้อมูลสินค้าไม่ถูกต้อง กรุณาระบุรหัสสินค้า (SKU) หรือชื่อสินค้า' }, { status: 400 });
    }

    // Process in chunks of 50
    const chunkSize = 50;
    let totalImported = 0;
    const errors: string[] = [];

    for (let i = 0; i < cleanedProducts.length; i += chunkSize) {
      const chunk = cleanedProducts.slice(i, i + chunkSize);

      // Conflict target is (org_id, sku) — never 'sku' alone (cross-tenant overwrite).
      const { error } = await upsertProductsForOrg(orgId, chunk);
      if (error) {
        console.error('Batch Import Chunk Error:', error);
        errors.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
        continue;
      }

      totalImported += chunk.length;

      // Keep the multi-bin ledger in sync with the imported absolute stock:
      // one bin per SKU at its declared location = its declared stock.
      try {
        await resetBinsBulk(orgId, chunk.map(p => ({ sku: p.sku, binCode: p.location || 'UNASSIGNED', quantity: p.stock })));
      } catch (e) {
        console.warn('Import: bin resync failed for chunk', e);
      }

      // Also register lots if given
      for (const p of chunk) {
        if (p.lot_no && p.expiry_date) {
          try {
            await supabase.from('product_lots').upsert({
              org_id: orgId,
              sku: p.sku,
              lot_number: p.lot_no,
              received_qty: p.stock,
              current_qty: p.stock,
              exp_date: p.expiry_date,
              status: 'RELEASED'
            }, { onConflict: 'org_id,sku,lot_number' });
          } catch {}
        }
      }
    }

    // Audit trail log
    await recordEnterpriseAudit({
      orgId,
      action: 'INSERT',
      entityName: 'products',
      entityId: `batch-${Date.now()}`,
      afterState: { count: totalImported, sampleSkus: cleanedProducts.slice(0, 5).map(p => p.sku) },
      performedBy: 'batch_import',
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: request.headers.get('user-agent') || 'WMS-Batch-Importer'
    });

    return NextResponse.json({
      success: true,
      message: `นำเข้าสินค้าสำเร็จทั้งหมด ${totalImported.toLocaleString()} รายการ`,
      count: totalImported,
      totalReceived: cleanedProducts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err: any) {
    console.error('Import API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
