import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

// Unified movements report for IN (รับ) / OUT (จ่าย) / RETURN (คืน) / DAMAGE (ชำรุด).
// Normalizes every source into: { date, type, docRef, product, sku, qty, location, note, status }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'IN').toUpperCase(); // IN | OUT | RETURN | DAMAGE
    const start = searchParams.get('start'); // yyyy-mm-dd
    const end = searchParams.get('end');
    const orgId = await getCurrentOrgId();

    const startTs = start ? new Date(start).getTime() : 0;
    const endTs = end ? new Date(end).getTime() + 24 * 60 * 60 * 1000 - 1 : Number.MAX_SAFE_INTEGER;
    const inRange = (d: any) => {
      const t = new Date(d).getTime();
      return !isNaN(t) ? t >= startTs && t <= endTs : true;
    };

    let rows: any[] = [];

    if (type === 'IN' || type === 'OUT') {
      const { data } = await supabase
        .from('stock_transactions').select('*')
        .eq('org_id', orgId).eq('type', type)
        .order('created_at', { ascending: false });
      rows = (data || []).filter(r => inRange(r.created_at)).map(r => ({
        date: r.created_at, type, docRef: r.doc_ref || '-',
        product: r.product_name || r.sku || '', sku: r.sku || '',
        qty: Number(r.qty || 0), location: r.location || '-', note: r.notes || '', status: '',
      }));
    } else if (type === 'DAMAGE') {
      const { data } = await supabase
        .from('damage_records').select('*')
        .eq('org_id', orgId).order('created_at', { ascending: false });
      rows = (data || []).filter(r => inRange(r.report_date || r.created_at)).map(r => ({
        date: r.report_date || r.created_at, type: 'DAMAGE', docRef: '-',
        product: r.product_name || '', sku: '', qty: Number(r.quantity || 0),
        location: '-', note: r.reason || '', status: r.status || '',
      }));
    } else if (type === 'RETURN') {
      const { data } = await supabase
        .from('return_orders').select('*')
        .eq('org_id', orgId).order('created_at', { ascending: false });
      (data || []).filter(r => inRange(r.created_at)).forEach((r: any) => {
        const items: any[] = Array.isArray(r.items_json) ? r.items_json : [];
        items.forEach(it => rows.push({
          date: r.created_at, type: 'RETURN', docRef: r.rma_no || '-',
          product: it.name || it.sku || '', sku: it.sku || '', qty: Number(it.qty || 0),
          location: '-', note: r.reason || '', status: r.status || '',
        }));
      });
    }

    const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    return NextResponse.json({ rows, summary: { count: rows.length, totalQty } });
  } catch (error: any) {
    console.error('API movements report error:', error);
    return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
  }
}
