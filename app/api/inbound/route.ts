import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    const transactionInserts: any[] = [];

    for (const item of items) {
      const qtyNum = Number(item.qty) || 0;
      const sku = item.sku;

      // 1. Fetch current product
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();

      const currentStock = Number(prodData?.stock || 0);
      const newStock = currentStock + qtyNum;

      // 2. Update Product Stock
      if (prodData) {
        await supabase
          .from('products')
          .update({
            stock: newStock,
            location: item.location || prodData.location,
            updated_at: new Date().toISOString(),
          })
          .eq('sku', sku);
      } else {
        // Create product if not exists
        await supabase.from('products').insert({
          sku,
          name: sku,
          stock: qtyNum,
          location: item.location || 'Unassigned',
          price: Number(item.salePrice || item.price || 0),
        });
      }

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
