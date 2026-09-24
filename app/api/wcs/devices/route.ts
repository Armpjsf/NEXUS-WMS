import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// C — Register / manage robot fleet devices (so the fleet isn't hardcoded and
// can be built for the real warehouse, mirroring the dock-bays flow).
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const { data } = await getServiceSupabase()
      .from('wcs_devices').select('*').eq('org_id', orgId).order('code', { ascending: true });
    return NextResponse.json({ success: true, devices: (data || []).map((d: any) => ({
      id: d.id, code: d.code, name: d.name, type: d.type, status: d.status,
      batteryLevel: Number(d.battery_level ?? 100), currentLocation: d.current_location || '', ipAddress: d.ip_address || '',
    })) });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err), devices: [] }, { status: 200 });
  }
}

// POST { code, name, type, currentLocation?, ipAddress? }
export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const b = await request.json();
    if (!b.code || !b.name) return NextResponse.json({ error: 'ระบุรหัส (code) และชื่อหุ่นยนต์' }, { status: 400 });
    const admin = getServiceSupabase();
    const now = new Date().toISOString();
    const { error } = await admin.from('wcs_devices').insert({
      id: `dev-${Date.now()}`,
      org_id: orgId,
      code: String(b.code).trim(),
      name: String(b.name).trim(),
      type: b.type || 'AGV_PALLET_LIFT',
      status: 'IDLE',
      battery_level: 100,
      current_location: b.currentLocation || 'DOCK-01',
      ip_address: b.ipAddress || null,
      last_ping: now, updated_at: now,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

// DELETE ?code=  (or ?id=)
export async function DELETE(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const sp = new URL(request.url).searchParams;
    const code = sp.get('code'); const id = sp.get('id');
    if (!code && !id) return NextResponse.json({ error: 'ระบุ code หรือ id' }, { status: 400 });
    let q = getServiceSupabase().from('wcs_devices').delete().eq('org_id', orgId);
    q = code ? q.eq('code', code) : q.eq('id', id!);
    await q;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
