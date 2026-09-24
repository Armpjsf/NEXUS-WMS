import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { resolveErpOrg } from '@/lib/erpAuth';
import { fetchAllRows } from '@/lib/data/fetchAll';

export async function GET(request: Request) {
  try {
    const auth = await resolveErpOrg(request);
    if (auth.error) return auth.error;
    const orgId = auth.orgId;

    // B2: an external inventory sync must be COMPLETE — page past the 1000 cap.
    const products = await fetchAllRows((f, t) => supabase
      .from('products')
      .select('sku, name, category, stock, unit, price, location, updated_at')
      .eq('org_id', orgId).range(f, t));

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