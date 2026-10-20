import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { binAdd } from '@/lib/stockLocations';
import { toBaseQty } from '@/lib/uom';
import { recordLotReceipt, normalizeDate } from '@/lib/lots';
import { errorMessage } from '@/lib/errors';

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
      const targetSku = item.sku;
      // A4: entry can be in any unit (e.g. 2 CARTON) — convert to base units.
      const baseQty = await toBaseQty(orgId, targetSku, Number(item.qty) || 0, item.uom);

      // 1. Fetch current product
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', orgId)
        .eq('sku', targetSku)
        .maybeSingle();

      const binCode = item.location || prodData?.location || 'RECEIVING-DOCK';

      // 2. Update Product Stock — add to bin; products.stock (= sum of bins) reconciled inside
      if (!prodData) {
        await supabase.from('products').insert({
          org_id: orgId,
          sku: targetSku,
          name: targetSku,
          stock: 0,
          location: binCode,
          price: Number(item.salePrice || item.price || 0),
        });
      }
      await binAdd(orgId, targetSku, binCode, baseQty, { lotNo: item.batch || undefined, docRef: item.docRef || undefined });
      if (item.batch) {
        await recordLotReceipt({
          orgId,
          sku: targetSku,
          lotNumber: String(item.batch),
          expDate: normalizeDate(item.expiryDate),
          qty: baseQty,
        });
      }

      // 3. Prepare Transaction Record
      transactionInserts.push({
        org_id: orgId,
        type: 'IN',
        sku: targetSku,
        product_name: prodData?.name || targetSku,
        qty: baseQty,
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
  } catch (error) {
    console.error('API Inbound Error:', error);
    return NextResponse.json({ error: errorMessage(error) || 'Internal Server Error' }, { status: 500 });
  }
}
