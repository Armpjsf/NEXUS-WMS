import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { nextMasterCode } from '@/lib/docNumber';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

function mapClient(r: any) {
  return {
    id: r.id, clientCode: r.client_code, clientName: r.client_name,
    contactPerson: r.contact_person || '', email: r.email || '', phone: r.phone || '',
    storageRatePerCbmDay: Number(r.storage_rate_per_cbm_day || 0),
    storageRatePerPalletDay: Number(r.storage_rate_per_pallet_day || 0),
    pickFeeBase: Number(r.pick_fee_base || 0), pickFeePerItem: Number(r.pick_fee_per_item || 0),
    packMaterialFee: Number(r.pack_material_fee || 0), status: r.status || 'ACTIVE',
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const { data } = await getServiceSupabase()
      .from('third_party_clients').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
    return NextResponse.json({ success: true, clients: (data || []).map(mapClient) });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err), clients: [] }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const b = await req.json();
    if (!b.clientName) return NextResponse.json({ error: 'ระบุชื่อลูกค้าฝากคลัง' }, { status: 400 });
    const admin = getServiceSupabase();
    const row = {
      org_id: orgId,
      client_code: b.clientCode || await nextMasterCode('CLI', orgId, { table: 'third_party_clients', column: 'client_code' }),
      client_name: String(b.clientName).trim(),
      contact_person: b.contactPerson || '', email: b.email || '', phone: b.phone || '',
      storage_rate_per_cbm_day: Number(b.storageRatePerCbmDay) || 15,
      storage_rate_per_pallet_day: Number(b.storageRatePerPalletDay) || 25,
      pick_fee_base: Number(b.pickFeeBase) || 12,
      pick_fee_per_item: Number(b.pickFeePerItem) || 3.5,
      pack_material_fee: Number(b.packMaterialFee) || 10,
      status: b.status || 'ACTIVE',
    };
    if (b.id) {
      await admin.from('third_party_clients').update(row).eq('org_id', orgId).eq('id', b.id);
      return NextResponse.json({ success: true });
    }
    const { data, error } = await admin.from('third_party_clients').insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, client: mapClient(data) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ระบุ id' }, { status: 400 });
    await getServiceSupabase().from('third_party_clients').delete().eq('org_id', orgId).eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
