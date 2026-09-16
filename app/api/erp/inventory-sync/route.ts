import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();

    const { data: products, error } = await supabase
      .from('products')
      .select('sku, name, category, stock, unit, price, location, updated_at')
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const snapshot = {
      orgId,
      timestamp: new Date().toISOString(),
      totalSkus: products?.length || 0,
      totalStockQty: (products || []).reduce((acc: number, p: any) => acc + Number(p.stock || 0), 0),
      items: products || []
    };

    return NextResponse.json({ success: true, data: snapshot });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}