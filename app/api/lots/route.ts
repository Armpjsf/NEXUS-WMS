import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getExpiryRisk } from '@/lib/fefo';
import { errorMessage } from '@/lib/errors';
import { normalizeDate } from '@/lib/lots';

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
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

// POST — register a NEW lot record (metadata only: this does not add stock;
// goods are received through /ops/receiving). An existing lot number is
// refused — it used to be upserted, overwriting the lot's quantities.
export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { sku, lotNumber, batchNumber, mfgDate, expDate, receivedQty, unitCost, notes } = body;

    if (!sku || !lotNumber) {
      return NextResponse.json({ error: 'SKU and Lot Number are required' }, { status: 400 });
    }
    if (expDate && !normalizeDate(expDate)) {
      return NextResponse.json({ error: 'วันหมดอายุไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
    }

    const { data: existing } = await supabase.from('product_lots').select('id')
      .eq('org_id', orgId).eq('sku', sku).eq('lot_number', lotNumber).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `ล็อต ${lotNumber} มีอยู่แล้ว — ใช้ "แก้วันหมดอายุ" ที่รายการล็อตแทน` }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('product_lots')
      .insert({
        org_id: orgId,
        sku,
        lot_number: lotNumber,
        batch_number: batchNumber || '',
        mfg_date: normalizeDate(mfgDate),
        exp_date: normalizeDate(expDate),
        status: 'ACTIVE',
        received_qty: Number(receivedQty || 0),
        current_qty: Number(receivedQty || 0),
        unit_cost: Number(unitCost || 0),
        notes: notes || '',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

// PATCH { sku, lotNumber, expDate, mfgDate? } — change only the dates of an
// existing lot (quantities untouched). expDate '' clears it.
export async function PATCH(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { sku, lotNumber, expDate, mfgDate } = await request.json();
    if (!sku || !lotNumber) return NextResponse.json({ error: 'ระบุ sku และ lotNumber' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (expDate !== undefined) {
      const d = normalizeDate(expDate);
      if (expDate && !d) return NextResponse.json({ error: 'วันหมดอายุไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
      patch.exp_date = d;
    }
    if (mfgDate !== undefined) {
      const d = normalizeDate(mfgDate);
      if (mfgDate && !d) return NextResponse.json({ error: 'วันผลิตไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 });
      patch.mfg_date = d;
    }

    const { data, error } = await supabase.from('product_lots').update(patch)
      .eq('org_id', orgId).eq('sku', sku).eq('lot_number', lotNumber).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'ไม่พบล็อต' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
