import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let items = [];

    if (body.items && Array.isArray(body.items)) {
      items = body.items;
    } else if (body.sku && body.qty) {
      items.push(body);
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const orgId = await getCurrentOrgId();

    // Guard: block dispatch that exceeds available stock (validate ALL lines
    // before mutating anything, so a partial commit can't happen).
    const stockCache: Record<string, any> = {};
    const shortages: string[] = [];
    for (const item of items) {
      const qtyNum = Number(item.qty) || 0;
      const sku = item.sku;
      const { data: prodData } = await supabase
        .from('products').select('*').eq('org_id', orgId).eq('sku', sku).maybeSingle();
      stockCache[sku] = prodData;
      const avail = Number(prodData?.stock || 0);
      if (!prodData) {
        shortages.push(`${sku}: ไม่พบสินค้าในคลัง`);
      } else if (qtyNum > avail) {
        shortages.push(`${prodData.name || sku}: ต้องการ ${qtyNum} แต่คงเหลือ ${avail}`);
      }
    }
    if (shortages.length > 0) {
      return NextResponse.json(
        { error: 'สต็อกไม่พอสำหรับการจ่ายออก', shortages },
        { status: 409 },
      );
    }

    const transactionInserts: any[] = [];

    for (const item of items) {
      const qtyNum = Number(item.qty) || 0;
      const sku = item.sku;

      // Reuse the product fetched during validation
      const prodData = stockCache[sku];

      const currentStock = Number(prodData?.stock || 0);
      const newStock = Math.max(0, currentStock - qtyNum);

      // 2. Update Product Stock
      if (prodData) {
        await supabase
          .from('products')
          .update({
            stock: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq('org_id', orgId)
          .eq('sku', sku);
      }

      // 3. Prepare Transaction Record
      transactionInserts.push({
        org_id: orgId,
        type: 'OUT',
        sku,
        product_name: prodData?.name || sku,
        qty: qtyNum,
        unit_price: Number(item.salePrice || item.price || prodData?.price || 0),
        doc_ref: item.docRef || '',
        location: prodData?.location || 'Unassigned',
        user_name: 'Warehouse Operator',
        created_at: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      });
    }

    // 4. Batch Insert Transactions
    if (transactionInserts.length > 0) {
      const { error: txError } = await supabase
        .from('stock_transactions')
        .insert(transactionInserts);

      if (txError) {
        console.error('Supabase Outbound Tx Error:', txError);
      }
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error: any) {
    console.error('API Outbound Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
