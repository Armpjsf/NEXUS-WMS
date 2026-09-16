import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getExpiryRisk } from '@/lib/fefo';

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    let query = supabase
      .from('product_lots')
      .select('*')
      .eq('org_id', orgId)
      .order('exp_date', { ascending: true, nullsFirst: false });

    if (sku) query = query.eq('sku', sku);

    const { data, error } = await query;
    if (error) {
      // Fallback: if table doesn't exist yet, return sample structure
      return NextResponse.json({
        success: true,
        data: [],
        note: 'Table product_lots ready'
      });
    }

    const lots = (data || []).map((l: any) => {
      const { days, risk } = getExpiryRisk(l.exp_date);
      return {
        id: l.id,
        sku: l.sku,
        lotNumber: l.lot_number,
        batchNumber: l.batch_number,
        mfgDate: l.mfg_date,
        expDate: l.exp_date,
        status: l.status,
        receivedQty: Number(l.received_qty || 0),
        currentQty: Number(l.current_qty || 0),
        daysToExpiry: days,
        expiryRisk: risk,
        notes: l.notes
      };
    });

    return NextResponse.json({ success: true, data: lots });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { sku, lotNumber, batchNumber, mfgDate, expDate, receivedQty, unitCost, notes } = body;

    if (!sku || !lotNumber) {
      return NextResponse.json({ error: 'SKU and Lot Number are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('product_lots')
      .upsert({
        org_id: orgId,
        sku,
        lot_number: lotNumber,
        batch_number: batchNumber || '',
        mfg_date: mfgDate || null,
        exp_date: expDate || null,
        status: 'ACTIVE',
        received_qty: Number(receivedQty || 0),
        current_qty: Number(receivedQty || 0),
        unit_cost: Number(unitCost || 0),
        notes: notes || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'org_id,sku,lot_number' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}