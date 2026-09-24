import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement } from '@/lib/apiAuth';
import { upsertProductsForOrg } from '@/lib/data/productUpsert';
import { errorMessage } from '@/lib/errors';

export async function POST() {
  try {
    // Seeding demo stock overwrites real SKUs with the same code — management only.
    const guard = await requireManagement();
    if (guard.error) return guard.error;
    const orgId = await getCurrentOrgId();

    const now = new Date();
    const addDays = (d: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      return date.toISOString().split('T')[0];
    };

    const demoProducts = [
      {
        org_id: orgId,
        sku: 'SKU-MED-001',
        name: 'พาราเซตามอล 500mg (100 เม็ด)',
        category: 'เวชภัณฑ์และยา',
        stock: 150,
        min_stock: 30,
        unit: 'box',
        price: 120,
        location: 'A-01-02',
        barcode: '8850123450011',
        lot_no: 'LOT-2026-MED1',
        expiry_date: addDays(8), // Critical FEFO (8 days left)
        movement_status: 'Fast Moving',
        status: 'ACTIVE',
      },
      {
        org_id: orgId,
        sku: 'SKU-BEV-002',
        name: 'นมสดพาสเจอร์ไรส์ 100% (2 ลิตร)',
        category: 'อาหารสด/เครื่องดื่ม',
        stock: 80,
        min_stock: 20,
        unit: 'bottle',
        price: 95,
        location: 'B-02-01',
        barcode: '8850123450028',
        lot_no: 'LOT-2026-MILK',
        expiry_date: addDays(3), // Critical FEFO (3 days left)
        movement_status: 'Fast Moving',
        status: 'ACTIVE',
      },
      {
        org_id: orgId,
        sku: 'SKU-DRY-003',
        name: 'ข้าวหอมมะลิเกรดพรีเมียม 5kg',
        category: 'สินค้าแห้ง',
        stock: 240,
        min_stock: 50,
        unit: 'bag',
        price: 215,
        location: 'C-01-04',
        barcode: '8850123450035',
        lot_no: 'LOT-2026-RICE',
        expiry_date: addDays(180), // Healthy FEFO
        movement_status: 'Normal Moving',
        status: 'ACTIVE',
      },
      {
        org_id: orgId,
        sku: 'SKU-IND-004',
        name: 'น้ำมันหล่อลื่นสังเคราะห์ 10W-40 (4 ลิตร)',
        category: 'เคมีภัณฑ์อุตสาหกรรม',
        stock: 60,
        min_stock: 15,
        unit: 'can',
        price: 850,
        location: 'D-03-02',
        barcode: '8850123450042',
        lot_no: 'LOT-2026-OIL',
        expiry_date: addDays(365), // Healthy FEFO
        movement_status: 'Slow Moving',
        status: 'ACTIVE',
      },
      {
        org_id: orgId,
        sku: 'SKU-EXP-005',
        name: 'โยเกิร์ตพร้อมดื่ม รสธรรมชาติ (แพ็ค 4)',
        category: 'อาหารสด/ควบคุมอุณหภูมิ',
        stock: 25,
        min_stock: 10,
        unit: 'pack',
        price: 48,
        location: 'B-01-03',
        barcode: '8850123450059',
        lot_no: 'LOT-2026-YGT',
        expiry_date: addDays(-3), // Expired FEFO
        movement_status: 'Fast Moving',
        status: 'ACTIVE',
      },
      {
        org_id: orgId,
        sku: 'SKU-ELEC-006',
        name: 'สายไฟ VCT 2x2.5 SQ.MM. (100 เมตร)',
        category: 'อุปกรณ์ช่างและไฟฟ้า',
        stock: 45,
        min_stock: 10,
        unit: 'roll',
        price: 1850,
        location: 'E-02-01',
        barcode: '8850123450066',
        lot_no: 'LOT-2026-VCT',
        expiry_date: addDays(730),
        movement_status: 'Normal Moving',
        status: 'ACTIVE',
      }
    ];

    // Upsert products
    const { data, error } = await upsertProductsForOrg(orgId, demoProducts);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: 'สร้างสินค้าตัวอย่างพร้อมข้อมูล Lot และวันหมดอายุ (FEFO) สำเร็จ',
      count: demoProducts.length
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
