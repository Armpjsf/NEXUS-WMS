import { NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { addBranch } from '@/lib/branches';
import { EntitlementError } from '@/lib/entitlements';
import { errorMessage } from '@/lib/errors';

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

    const result = await addBranch(orgId, {
      code,
      name: body.name,
      color: body.color,
      warehouseName: body.warehouseName,
      pickupAddress: body.pickupAddress,
    });

    if (!result.success) {
      console.error('branches POST error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
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
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
