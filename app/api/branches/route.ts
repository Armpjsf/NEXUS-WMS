import { NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { checkPlanLimit } from '@/lib/planLimits';

export const dynamic = 'force-dynamic';

// Branches are now real Supabase rows (no per-branch spreadsheet). `id` in the
// UI maps to the branch `code`.
export async function GET() {
  const orgId = await getCurrentOrgId();
  let data: any[] | null = null;
  let error: any = null;

  const res = await supabase
    .from('branches')
    .select('code, name, color, status, warehouse_name, pickup_address')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true });

  data = res.data;
  error = res.error;

  if (error && error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
    const fallback = await supabase
      .from('branches')
      .select('code, name, color, status')
      .eq('org_id', orgId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('branches GET error:', error);
    return NextResponse.json([]);
  }
  return NextResponse.json((data || []).map((b: any) => ({
    id: b.code,
    name: b.name,
    color: b.color,
    warehouseName: b.warehouse_name || '',
    pickupAddress: b.pickup_address || '',
  })));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = (body.id || body.code || '').trim();
    if (!code || !body.name) {
      return NextResponse.json({ error: 'ต้องมีรหัสและชื่อสาขา' }, { status: 400 });
    }
    const orgId = await getCurrentOrgId();

    // Enforce plan limit for new branch codes.
    const { data: existing } = await getServiceSupabase()
      .from('branches').select('id').eq('org_id', orgId).eq('code', code).maybeSingle();
    if (!existing) {
      const limitErr = await checkPlanLimit(orgId, 'branches', 'branches');
      if (limitErr) return NextResponse.json({ error: limitErr }, { status: 403 });
    }

    const upsertPayload: Record<string, any> = {
      org_id: orgId,
      code,
      name: body.name,
      color: body.color || 'slate',
      status: 'ACTIVE',
      warehouse_name: body.warehouseName || body.name,
      pickup_address: body.pickupAddress || '',
    };

    let { error } = await getServiceSupabase().from('branches').upsert(
      upsertPayload,
      { onConflict: 'org_id,code' },
    );

    if (error && error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
      delete upsertPayload.warehouse_name;
      delete upsertPayload.pickup_address;
      const retry = await getServiceSupabase().from('branches').upsert(
        upsertPayload,
        { onConflict: 'org_id,code' },
      );
      error = retry.error;
    }

    if (error) {
      console.error('branches POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('id');
    if (!code) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // Soft-deactivate rather than hard delete (keeps historical references intact).
    const { error } = await getServiceSupabase()
      .from('branches').update({ status: 'INACTIVE' }).eq('org_id', await getCurrentOrgId()).eq('code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
