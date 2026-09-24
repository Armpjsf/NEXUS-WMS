import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// C5 — manage carrier rate cards.
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data } = await getServiceSupabase().from('carrier_rates').select('*')
      .eq('org_id', orgId).order('carrier', { ascending: true }).order('min_weight', { ascending: true });
    const rates = (data || []).map((r: any) => ({
      id: r.id, carrier: r.carrier, zone: r.zone, minWeight: Number(r.min_weight || 0), maxWeight: Number(r.max_weight || 0),
      price: Number(r.price || 0), etaDays: r.eta_days, active: !!r.active,
    }));
    return NextResponse.json({ success: true, rates });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const b = await request.json();
    if (!b.carrier || !(Number(b.price) >= 0)) return NextResponse.json({ error: 'ต้องระบุ carrier และ price' }, { status: 400 });
    const admin = getServiceSupabase();
    const row = {
      org_id: orgId, carrier: String(b.carrier).trim(), zone: (b.zone || 'ALL').trim(),
      min_weight: Number(b.minWeight) || 0, max_weight: Number(b.maxWeight) || 999999,
      price: Number(b.price) || 0, eta_days: b.etaDays != null ? Number(b.etaDays) : null,
      active: b.active !== false, updated_at: new Date().toISOString(),
    };
    if (b.id) await admin.from('carrier_rates').update(row).eq('org_id', orgId).eq('id', b.id);
    else await admin.from('carrier_rates').insert(row);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ระบุ id' }, { status: 400 });
    await getServiceSupabase().from('carrier_rates').delete().eq('org_id', orgId).eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
