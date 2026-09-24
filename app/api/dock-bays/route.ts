import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// GET /api/dock-bays — สถานะลานเทียบ/เบย์โหลด (ว่างได้ = ยังไม่ตั้งค่าลานเทียบ)
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    let query = supabase
      .from('dock_bays')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (branchId && branchId !== 'hq') query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw error;

    const bays = (data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      type: (b.bay_type || 'INBOUND').toUpperCase(),
      status: (b.status || 'AVAILABLE').toUpperCase(),
      vehicle: b.vehicle || '-',
      pallets: `${b.pallets_done ?? 0}/${b.pallets_total ?? 0} พ.`,
      progress: Number(b.progress || 0),
      eta: b.eta || '',
    }));

    return NextResponse.json({ bays });
  } catch (error) {
    console.error('API dock-bays GET error:', error);
    return NextResponse.json({ bays: [], error: errorMessage(error) }, { status: 200 });
  }
}
