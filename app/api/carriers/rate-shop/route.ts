import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// C5 — rate-shop: cheapest carrier for a weight + zone.
// GET /api/carriers/rate-shop?weight=5&zone=BKK
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const sp = new URL(request.url).searchParams;
    const weight = Number(sp.get('weight')) || 0;
    const zone = (sp.get('zone') || 'ALL').trim();
    const admin = getServiceSupabase();

    // rates for this zone OR the catch-all 'ALL' zone, within the weight band
    const { data } = await admin.from('carrier_rates').select('*')
      .eq('org_id', orgId).eq('active', true)
      .in('zone', Array.from(new Set([zone, 'ALL'])))
      .lte('min_weight', weight).gte('max_weight', weight);

    // best price per carrier (a carrier may have both a zone rate and an ALL rate)
    const best = new Map<string, any>();
    for (const r of data || []) {
      const cur = best.get(r.carrier);
      // prefer an exact-zone match over ALL when prices tie
      const better = !cur || Number(r.price) < Number(cur.price) || (Number(r.price) === Number(cur.price) && r.zone === zone && cur.zone === 'ALL');
      if (better) best.set(r.carrier, r);
    }

    const options = Array.from(best.values())
      .map((r: any) => ({ carrier: r.carrier, zone: r.zone, price: Number(r.price || 0), etaDays: r.eta_days }))
      .sort((a, b) => a.price - b.price);

    return NextResponse.json({
      success: true, weight, zone,
      cheapest: options[0] || null,
      options,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
