import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';

export const dynamic = 'force-dynamic';

// Outbound delivery summary grouped by destination province.
// Freight is read from a structured field when present, else parsed from the
// migration note ("ค่าขนส่ง=1600"), so historical shipments still total up.
function parseFreight(o: any): number {
  const amt = Number(o.total_amount || 0);
  if (amt > 0 && o.channel !== 'MIGRATION') return amt; // new orders may store goods value; keep freight from note for migrated
  const m = String(o.notes || '').match(/ค่าขนส่ง\s*=?\s*([\d,]+(?:\.\d+)?)/);
  if (m) return Number(m[1].replace(/,/g, '')) || 0;
  return amt;
}

function province(o: any): string {
  const s = String(o.ship_address || '').trim();
  if (s) return s.split(/[\n,]/)[0].trim();
  // fall back to the first multi-drop destination if present
  try {
    const d = Array.isArray(o.destinations_json) ? o.destinations_json[0] : null;
    if (d?.address) return String(d.address).split(/[\n,]/)[0].trim();
  } catch { /* ignore */ }
  return 'ไม่ระบุปลายทาง';
}

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const from = startDate ? new Date(startDate).getTime() : -Infinity;
    const to = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

    const orders = await fetchAllRows((f, t) => supabase
      .from('outbound_orders')
      .select('order_no, ship_address, destinations_json, total_qty, total_amount, notes, channel, status, created_at, customer_name')
      .eq('org_id', orgId).range(f, t));

    const rows = orders.filter(o => {
      if (o.status === 'CANCELLED') return false;
      const ts = o.created_at ? new Date(o.created_at).getTime() : 0;
      return ts >= from && ts <= to;
    });

    const byProv = new Map<string, { province: string; trips: number; pieces: number; freight: number; customers: Set<string> }>();
    let totTrips = 0, totPieces = 0, totFreight = 0;
    for (const o of rows) {
      const p = province(o);
      const e = byProv.get(p) || { province: p, trips: 0, pieces: 0, freight: 0, customers: new Set<string>() };
      const pieces = Number(o.total_qty || 0);
      const freight = parseFreight(o);
      e.trips += 1; e.pieces += pieces; e.freight += freight;
      if (o.customer_name) e.customers.add(o.customer_name);
      byProv.set(p, e);
      totTrips += 1; totPieces += pieces; totFreight += freight;
    }

    const provinces = [...byProv.values()]
      .map(e => ({ province: e.province, trips: e.trips, pieces: e.pieces, freight: e.freight, customers: e.customers.size }))
      .sort((a, b) => b.trips - a.trips);

    return NextResponse.json({
      totals: { trips: totTrips, pieces: totPieces, freight: totFreight, provinces: provinces.length },
      provinces,
    });
  } catch (err: any) {
    console.error('outbound-summary error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
