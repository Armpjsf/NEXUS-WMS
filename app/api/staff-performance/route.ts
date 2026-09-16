import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// GET /api/staff-performance — สถิติรายบุคคลจาก snapshot ล่าสุด (ว่างได้ = ยังไม่บันทึก)
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();

    // หา snapshot_date ล่าสุดที่มีข้อมูล แล้วดึงทุกคนของวันนั้น
    const { data: latest } = await supabase
      .from('staff_performance')
      .select('snapshot_date')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1);

    const latestDate = latest?.[0]?.snapshot_date;
    if (!latestDate) return NextResponse.json({ staffList: [] });

    const { data, error } = await supabase
      .from('staff_performance')
      .select('*')
      .eq('org_id', orgId)
      .eq('snapshot_date', latestDate)
      .order('score', { ascending: false });

    if (error) throw error;

    const staffList = (data || []).map((s: any) => ({
      id: s.id,
      name: s.staff_name,
      avatar: s.avatar || '👤',
      role: s.role || '',
      branch: s.branch_label || '',
      totalPicks: Number(s.total_picks || 0),
      picksPerHour: Number(s.picks_per_hour || 0),
      packedOrders: Number(s.packed_orders || 0),
      cycleCountsCompleted: Number(s.cycle_counts_completed || 0),
      accuracyRate: Number(s.accuracy_rate || 0),
      avgTurnaroundMinutes: Number(s.avg_turnaround_minutes || 0),
      status: s.status || 'ACTIVE',
      score: Number(s.score || 0),
      badge: s.badge || '',
    }));

    return NextResponse.json({ staffList });
  } catch (error: any) {
    console.error('API staff-performance GET error:', error);
    return NextResponse.json({ staffList: [], error: error.message }, { status: 200 });
  }
}
