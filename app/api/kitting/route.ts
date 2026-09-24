import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// map DB row (snake_case) -> app shape (camelCase)
function mapBom(r: any) {
  return {
    id: r.id,
    kitSku: r.kit_sku,
    kitName: r.kit_name,
    version: r.version || '1.0',
    assemblyLaborCost: Number(r.assembly_labor_cost || 0),
    status: r.status || 'ACTIVE',
    components: Array.isArray(r.components) ? r.components : [],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await getServiceSupabase()
      .from('bill_of_materials')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, boms: (data || []).map(mapBom) });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err), boms: [] }, { status: 200 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const orgId = await getCurrentOrgId();
    const body = await req.json();
    if (!body.kitSku || !body.kitName) {
      return NextResponse.json({ error: 'กรุณาระบุ SKU และชื่อชุดสินค้า' }, { status: 400 });
    }
    const { data, error } = await getServiceSupabase()
      .from('bill_of_materials')
      .insert({
        org_id: orgId,
        kit_sku: String(body.kitSku).trim(),
        kit_name: String(body.kitName).trim(),
        version: body.version || '1.0',
        assembly_labor_cost: Number(body.assemblyLaborCost) || 0,
        status: 'ACTIVE',
        components: Array.isArray(body.components) ? body.components : [],
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, bom: mapBom(data) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
