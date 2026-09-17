import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getAvailable, getReservedQty } from '@/lib/reservations';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/stock/available?sku=ABC
// available = on-hand (products.stock) − active reservations
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const sku = new URL(request.url).searchParams.get('sku');
    if (!sku) return NextResponse.json({ success: false, error: 'ระบุ sku' }, { status: 400 });

    const { data: prod } = await getServiceSupabase()
      .from('products').select('stock').eq('org_id', orgId).eq('sku', sku).maybeSingle();
    const onHand = Number(prod?.stock ?? 0);
    const reserved = await getReservedQty(orgId, sku);
    const available = await getAvailable(orgId, sku);

    return NextResponse.json({
      success: true, sku,
      onHand,
      reserved,
      available: available ?? onHand, // off-catalog: available = on-hand
      offCatalog: available === null,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 200 });
  }
}
