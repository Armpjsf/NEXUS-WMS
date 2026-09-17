import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { binAdd } from '@/lib/stockLocations';
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
    const transactionInserts: any[] = [];

    for (const item of items) {
      const sku = item.sku;
      // A4: entry can be in any unit (e.g. 2 CARTON) — convert to base units.
      const qtyNum = await toBaseQty(orgId, sku, Number(item.qty) || 0, item.uom);

      // 1. Fetch current product
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', orgId)
        .eq('sku', sku)
        .maybeSingle();

      const binCode = item.location || prodData?.location || 'RECEIVING-DOCK';

      // 2. Update Product Stock — add to bin; products.stock (= sum of bins) reconciled inside
      if (!prodData) {
        await supabase.from('products').insert({
          org_id: orgId,
          sku,
          name: sku,
          stock: 0,
          location: binCode,
          price: Number(item.salePrice || item.price || 0),
        });
      }
      await binAdd(orgId, sku, binCode, qtyNum, { lotNo: item.batch || undefined });

      // 3. Prepare Transaction Record
      transactionInserts.push({
        type: 'IN',
        sku,
        product_name: prodData?.name || sku,
        qty: qtyNum,
        unit_price: Number(item.salePrice || item.price || prodData?.price || 0),
        doc_ref: item.docRef || '',
        location: item.location || prodData?.location || 'Unassigned',
        batch_no: item.batch || '',
        expiry_date: item.expiryDate || null,
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
        console.error('Supabase Inbound Tx Error:', txError);
      }
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error: any) {
    console.error('API Inbound Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
