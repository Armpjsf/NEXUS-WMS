import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/data/fetchAll';

export const dynamic = 'force-dynamic';

// C3 — Labor Management (LMS): operator productivity from the stock ledger.
// GET /api/lms/productivity?days=7
export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get('days')) || 7));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const admin = getServiceSupabase();

    const txns = await fetchAllRows((f, t) => admin
      .from('stock_transactions')
      .select('type, qty, user_name, created_at')
      .eq('org_id', orgId).gte('created_at', since)
      .order('created_at', { ascending: false }).range(f, t));

    interface Op {
      operator: string;
      linesIn: number; unitsIn: number; linesOut: number; unitsOut: number;
      linesAdjust: number; totalLines: number; totalUnits: number;
      firstAt: string; lastAt: string; days: Set<string>;
    }
    const map = new Map<string, Op>();
    for (const r of txns) {
      const op = (r.user_name || 'ไม่ระบุ').trim() || 'ไม่ระบุ';
      const o = map.get(op) || { operator: op, linesIn: 0, unitsIn: 0, linesOut: 0, unitsOut: 0, linesAdjust: 0, totalLines: 0, totalUnits: 0, firstAt: r.created_at, lastAt: r.created_at, days: new Set<string>() };
      const q = Math.abs(Number(r.qty || 0));
      if (r.type === 'IN') { o.linesIn++; o.unitsIn += q; }
      else if (r.type === 'OUT') { o.linesOut++; o.unitsOut += q; }
      else { o.linesAdjust++; }
      o.totalLines++; o.totalUnits += q;
      if (r.created_at < o.firstAt) o.firstAt = r.created_at;
      if (r.created_at > o.lastAt) o.lastAt = r.created_at;
      o.days.add(String(r.created_at).slice(0, 10));
      map.set(op, o);
    }

    const operators = Array.from(map.values())
      .map(o => {
        const activeDays = o.days.size || 1;
        return {
          operator: o.operator,
          linesIn: o.linesIn, unitsIn: o.unitsIn, linesOut: o.linesOut, unitsOut: o.unitsOut,
          linesAdjust: o.linesAdjust, totalLines: o.totalLines, totalUnits: o.totalUnits,
          activeDays, linesPerDay: Math.round(o.totalLines / activeDays), lastAt: o.lastAt,
        };
      })
      .sort((a, b) => b.totalUnits - a.totalUnits);

    const team = operators.reduce((s, o) => ({
      operators: s.operators + 1, totalLines: s.totalLines + o.totalLines, totalUnits: s.totalUnits + o.totalUnits,
      unitsIn: s.unitsIn + o.unitsIn, unitsOut: s.unitsOut + o.unitsOut,
    }), { operators: 0, totalLines: 0, totalUnits: 0, unitsIn: 0, unitsOut: 0 });

    return NextResponse.json({ success: true, days, since, team, operators });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
