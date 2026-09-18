import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function mapBay(r: any) {
  return {
    id: r.id, name: r.name, bayType: r.bay_type, status: r.status || 'AVAILABLE',
    vehicle: r.vehicle || '', palletsDone: Number(r.pallets_done || 0), palletsTotal: Number(r.pallets_total || 0),
    progress: Number(r.progress || 0), eta: r.eta || '', sortOrder: Number(r.sort_order || 0),
  };
}

// GET — list dock bays (add as many as the warehouse needs)
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data } = await getServiceSupabase()
      .from('dock_bays').select('*').eq('org_id', orgId)
      .order('sort_order', { ascending: true }).order('name', { ascending: true });
    return NextResponse.json({ success: true, bays: (data || []).map(mapBay) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, bays: [] }, { status: 200 });
  }
}

// POST — create or update a bay { id?, name, bayType, status?, sortOrder? }
export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const b = await request.json();
    if (!b.name) return NextResponse.json({ error: 'ระบุชื่อช่องเทียบท่า' }, { status: 400 });
    const admin = getServiceSupabase();

    if (b.id) {
      await admin.from('dock_bays').update({
        name: String(b.name).trim(), bay_type: b.bayType || 'INBOUND',
        ...(b.status ? { status: b.status } : {}), ...(b.sortOrder != null ? { sort_order: Number(b.sortOrder) } : {}),
        updated_at: new Date().toISOString(),
      }).eq('org_id', orgId).eq('id', b.id);
      return NextResponse.json({ success: true });
    }

    // new bay → append at the end
    const { data: last } = await admin.from('dock_bays').select('sort_order')
      .eq('org_id', orgId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await admin.from('dock_bays').insert({
      org_id: orgId, name: String(b.name).trim(), bay_type: b.bayType || 'INBOUND',
      status: b.status || 'AVAILABLE', sort_order: Number(last?.sort_order || 0) + 1,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, bay: mapBay(data) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE ?id=
export async function DELETE(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ระบุ id' }, { status: 400 });
    await getServiceSupabase().from('dock_bays').delete().eq('org_id', orgId).eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
