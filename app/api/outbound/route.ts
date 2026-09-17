import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { binConsume } from '@/lib/stockLocations';
import { toBaseQty } from '@/lib/uom';

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
    const baseQtyBySku: Record<string, number> = {};
    for (const item of items) {
      const sku = item.sku;
      // A4: convert the requested qty (any unit) to base units for validation.
      const qtyNum = await toBaseQty(orgId, sku, Number(item.qty) || 0, item.uom);
      baseQtyBySku[sku] = (baseQtyBySku[sku] || 0) + qtyNum;
      const { data: prodData } = await supabase
        .from('products').select('*').eq('org_id', orgId).eq('sku', sku).maybeSingle();
      stockCache[sku] = prodData;
      const avail = Number(prodData?.stock || 0);
      if (!prodData) {
        shortages.push(`${sku}: ไม่พบสินค้าในคลัง`);
      } else if (baseQtyBySku[sku] > avail) {
        shortages.push(`${prodData.name || sku}: ต้องการ ${baseQtyBySku[sku]} แต่คงเหลือ ${avail}`);
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
      const sku = item.sku;
      // A4: base-unit qty (converted from item.uom in the validation pass)
      const qtyNum = await toBaseQty(orgId, sku, Number(item.qty) || 0, item.uom);

      // Reuse the product fetched during validation
      const prodData = stockCache[sku];

      // 2. Update Product Stock — deduct across bins; products.stock reconciled inside
      if (prodData) {
        await binConsume(orgId, sku, qtyNum, { preferBin: item.location || prodData?.location });
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
        location: item.location || prodData?.location || 'Unassigned',
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
