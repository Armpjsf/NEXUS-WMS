import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { normalizeBinCode } from '@/lib/warehouseLayout';

export const dynamic = 'force-dynamic';

/**
 * Per-bin stock for the warehouse map: one row per (SKU, bin) with lots summed,
 * read from stock_locations (the multi-bin ledger). Stock is org-wide — products
 * aren't split by branch — so every branch's layout overlays the same rows and
 * picks up the bin codes it contains.
 */
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();

    const raw = await fetchAllRows<any>((f, t) =>
      admin.from('stock_locations').select('sku, bin_code, quantity').eq('org_id', orgId).gt('quantity', 0).range(f, t));

    const merged = new Map<string, { sku: string; binCode: string; quantity: number }>();
    raw.forEach(r => {
      const binCode = normalizeBinCode(r.bin_code) || 'UNASSIGNED';
      const key = `${r.sku}\u0000${binCode}`;
      const row = merged.get(key) || { sku: String(r.sku), binCode, quantity: 0 };
      row.quantity += Number(r.quantity || 0);
      merged.set(key, row);
    });

    return NextResponse.json({ success: true, source: 'stock_locations', rows: Array.from(merged.values()) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
