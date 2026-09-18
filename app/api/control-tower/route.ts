import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/data/fetchAll';

export const dynamic = 'force-dynamic';

// C2 — Control Tower: one aggregated snapshot for the manager dashboard.
// Read-only. Uses cheap head-count queries where possible; the one full scan is
// products (needed for low-stock + total units), already paged.
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();
    const now = Date.now();
    const cutoff = (d: number) => new Date(now + d * 864e5).toISOString().slice(0, 10);
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

    const count = async (table: string, apply?: (q: any) => any): Promise<number> => {
      let q = admin.from(table).select('*', { count: 'exact', head: true }).eq('org_id', orgId);
      if (apply) q = apply(q);
      const { count } = await q;
      return count || 0;
    };

    const [
      products,
      lotsExpiring, recalledCount,
      ordersNew, ordersFulfilling, ordersShippedToday,
      reservationsActive,
      wcsDevices, wcsActiveMissions,
      recentMoves,
    ] = await Promise.all([
      fetchAllRows((f, t) => admin.from('products').select('sku, name, stock, min_stock, unit').eq('org_id', orgId).range(f, t)),
      admin.from('product_lots').select('sku, lot_number, exp_date, current_qty').eq('org_id', orgId)
        .eq('recalled', false).not('exp_date', 'is', null).lte('exp_date', cutoff(30))
        .order('exp_date', { ascending: true }).limit(12),
      count('product_lots', q => q.eq('recalled', true)),
      count('outbound_orders', q => q.eq('status', 'NEW')),
      count('outbound_orders', q => q.in('status', ['PICKING', 'PICKED', 'PACKED'])),
      count('outbound_orders', q => q.eq('status', 'SHIPPED').gte('shipped_at', startToday.toISOString())),
      count('stock_reservations', q => q.eq('status', 'ACTIVE')),
      admin.from('wcs_devices').select('code, status, battery_level').eq('org_id', orgId),
      count('wcs_missions', q => q.in('status', ['DISPATCHED', 'IN_TRANSIT'])),
      admin.from('stock_transactions').select('type, sku, product_name, qty, location, created_at, user_name')
        .eq('org_id', orgId).order('created_at', { ascending: false }).limit(10),
    ]);

    const prods = products || [];
    const totalUnits = prods.reduce((s: number, p: any) => s + Number(p.stock || 0), 0);
    const low = prods
      .filter((p: any) => Number(p.stock || 0) <= Number(p.min_stock || 0))
      .sort((a: any, b: any) => Number(a.stock || 0) - Number(b.stock || 0));
    const outOfStock = prods.filter((p: any) => Number(p.stock || 0) <= 0).length;

    const devices = wcsDevices.data || [];
    const wcs = {
      total: devices.length,
      idle: devices.filter((d: any) => d.status === 'IDLE').length,
      active: devices.filter((d: any) => ['NAVIGATING', 'LIFTING'].includes(d.status)).length,
      error: devices.filter((d: any) => d.status === 'ERROR' || d.status === 'OFFLINE').length,
      charging: devices.filter((d: any) => d.status === 'CHARGING').length,
      activeMissions: wcsActiveMissions,
      lowBattery: devices.filter((d: any) => Number(d.battery_level || 100) < 20).length,
    };

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      inventory: {
        skus: prods.length,
        totalUnits,
        lowStock: low.length,
        outOfStock,
        topLow: low.slice(0, 8).map((p: any) => ({ sku: p.sku, name: p.name, stock: Number(p.stock || 0), min: Number(p.min_stock || 0), unit: p.unit })),
      },
      orders: { new: ordersNew, fulfilling: ordersFulfilling, shippedToday: ordersShippedToday, reservationsActive },
      lots: {
        recalled: recalledCount,
        expiringSoon: (lotsExpiring.data || []).map((l: any) => ({
          sku: l.sku, lot: l.lot_number, expDate: l.exp_date, qty: Number(l.current_qty || 0),
          days: Math.ceil((new Date(l.exp_date).getTime() - now) / 864e5),
        })),
      },
      robotics: wcs,
      recentMovements: (recentMoves.data || []).map((m: any) => ({
        type: m.type, sku: m.sku, name: m.product_name || m.sku, qty: Number(m.qty || 0),
        location: m.location, at: m.created_at, by: m.user_name,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
