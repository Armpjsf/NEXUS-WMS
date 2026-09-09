import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { mapProductRows, mapProductRow } from '@/lib/data/products';
import { getCurrentOrgId } from '@/lib/orgContext';
import { checkPlanLimit } from '@/lib/planLimits';

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase GET Products Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(mapProductRows(products));
  } catch (error: any) {
    console.error('API GET Products Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, sku, category, stock, minStock, min_stock, unit, price, location, barcode, image_url, image } = body;

    if (!name) {
      return NextResponse.json({ error: 'Product Name is required' }, { status: 400 });
    }

    const itemSku = sku || name;
    const orgId = await getCurrentOrgId();

    // Enforce plan limit only for genuinely new SKUs (upsert also handles edits).
    const { data: existing } = await supabase
      .from('products').select('id').eq('org_id', orgId).eq('sku', itemSku).maybeSingle();
    if (!existing) {
      const limitErr = await checkPlanLimit(orgId, 'products', 'products');
      if (limitErr) return NextResponse.json({ error: limitErr }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('products')
      .upsert({
        org_id: orgId,
        sku: itemSku,
        name,
        category: category || 'General',
        stock: Number(stock || 0),
        min_stock: Number(min_stock || minStock || 5),
        unit: unit || 'pcs',
        price: Number(price || 0),
        location: location || 'Unassigned',
        barcode: barcode || null,
        image_url: image_url || image || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sku' })
      .select();

    if (error) {
      console.error('Supabase Add Product Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: data?.[0] ? mapProductRow(data[0]) : null });
  } catch (error: any) {
    console.error('API POST Product Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sku, id, updates } = body;

    const targetSku = sku || updates?.sku;
    const orgId = await getCurrentOrgId();

    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq(id ? 'id' : 'sku', id || targetSku)
      .select();

    if (error) {
      console.error('Supabase Update Product Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: data?.[0] ? mapProductRow(data[0]) : null });
  } catch (error: any) {
    console.error('API PUT Product Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const id = searchParams.get('id');

    if (!sku && !id) {
      return NextResponse.json({ error: 'SKU or ID is required' }, { status: 400 });
    }

    const orgId = await getCurrentOrgId();
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('org_id', orgId)
      .eq(id ? 'id' : 'sku', id || sku);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
