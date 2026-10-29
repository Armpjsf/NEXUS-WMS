import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getExpiryRisk } from '@/lib/fefo';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export interface FefoBinLot {
  lotId: string;
  lotNumber: string;
  expDate?: string;
  locationCode: string;
  qtyAvailable: number;
  status: string;
  daysToExpiry: number;
  expiryRisk: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY';
}

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const admin = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const skuParam = searchParams.get('skus') || searchParams.get('sku');
    const requestedSkus = skuParam ? skuParam.split(',').map(s => s.trim()).filter(Boolean) : null;

    // 1. Fetch available bins from stock_locations
    let binQuery = admin
      .from('stock_locations')
      .select('id, sku, bin_code, quantity, lot_no')
      .eq('org_id', orgId)
      .gt('quantity', 0);

    if (requestedSkus && requestedSkus.length > 0) {
      binQuery = binQuery.in('sku', requestedSkus);
    }

    const { data: binRows, error: binErr } = await binQuery;
    if (binErr) {
      return NextResponse.json({ success: false, error: binErr.message }, { status: 500 });
    }

    // 2. Fetch lot metadata from product_lots
    let lotQuery = admin
      .from('product_lots')
      .select('id, sku, lot_number, exp_date, status, current_qty')
      .eq('org_id', orgId);

    if (requestedSkus && requestedSkus.length > 0) {
      lotQuery = lotQuery.in('sku', requestedSkus);
    }

    const { data: lotRows } = await lotQuery;
    const lotMap = new Map<string, { id: string; exp_date?: string; status: string }>();
    for (const l of lotRows || []) {
      const key = `${l.sku}:::${l.lot_number}`;
      lotMap.set(key, { id: l.id, exp_date: l.exp_date, status: l.status || 'ACTIVE' });
    }

    // 3. Assemble FEFO structures grouped by SKU
    const resultBySku: Record<string, FefoBinLot[]> = {};

    for (const b of binRows || []) {
      const sku = b.sku;
      if (!resultBySku[sku]) resultBySku[sku] = [];

      const lotInfo = b.lot_no ? lotMap.get(`${sku}:::${b.lot_no}`) : null;
      const expDate = lotInfo?.exp_date || undefined;
      const status = lotInfo?.status || 'ACTIVE';
      const { days, risk } = getExpiryRisk(expDate);

      resultBySku[sku].push({
        lotId: lotInfo?.id || b.id,
        lotNumber: b.lot_no || 'UNASSIGNED',
        expDate,
        locationCode: b.bin_code || 'UNASSIGNED',
        qtyAvailable: Number(b.quantity || 0),
        status,
        daysToExpiry: days,
        expiryRisk: risk,
      });
    }

    // 4. Sort each SKU's list by FEFO (earliest expiry first, unassigned/no expiry at end)
    for (const sku of Object.keys(resultBySku)) {
      resultBySku[sku].sort((a, b) => {
        if (!a.expDate && !b.expDate) return 0;
        if (!a.expDate) return 1;
        if (!b.expDate) return -1;
        return new Date(a.expDate).getTime() - new Date(b.expDate).getTime();
      });
    }

    return NextResponse.json({
      success: true,
      data: resultBySku,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}
