import { NextResponse } from 'next/server';
import { getCurrentOrgId } from '@/lib/orgContext';
import { getServiceSupabase } from '@/lib/supabase';
import { binAdd, binConsume, binSet, getBins } from '@/lib/stockLocations';
import { toBaseQty } from '@/lib/uom';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // large history loads take time (per-row stock apply)

// C — Bulk historical-movement import (migration strategy B: the system builds
// current stock by replaying every movement chronologically).
//
// POST { rows: [{ date, type, sku, qty, ref?, note?, location?, uom?, by? }] }
//   type: IN | OUT | DAMAGE | ADJUST   (Thai synonyms accepted)
//   ADJUST sets the bin to an absolute counted qty; the rest move stock.
//
// Import the product master FIRST (with Stock left blank/0) so SKUs exist and
// aren't double-counted.

function normType(t: string): 'IN' | 'OUT' | 'DAMAGE' | 'ADJUST' | null {
  const s = String(t || '').trim().toUpperCase();
  if (['IN', 'RECEIVE', 'RECEIPT', 'รับ', 'รับเข้า', 'GRN'].includes(s)) return 'IN';
  if (['OUT', 'ISSUE', 'SHIP', 'จ่าย', 'จ่ายออก', 'เบิก'].includes(s)) return 'OUT';
  if (['DAMAGE', 'DAMAGED', 'ชำรุด', 'เสีย', 'เสียหาย'].includes(s)) return 'DAMAGE';
  if (['ADJUST', 'ADJUSTMENT', 'COUNT', 'ปรับ', 'ปรับยอด', 'นับ'].includes(s)) return 'ADJUST';
  return null;
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการประวัติสำหรับนำเข้า' }, { status: 400 });
    }
    if (rows.length > 20000) {
      return NextResponse.json({ error: 'เกิน 20,000 แถว/ครั้ง — แบ่งไฟล์เป็นก้อนย่อย' }, { status: 400 });
    }
    const admin = getServiceSupabase();

    // known SKUs + names (import product master first)
    const skus = Array.from(new Set(rows.map((r: any) => String(r.sku || '').trim()).filter(Boolean)));
    const nameMap = new Map<string, string>();
    for (let i = 0; i < skus.length; i += 500) {
      const chunk = skus.slice(i, i + 500);
      const { data } = await admin.from('products').select('sku, name').eq('org_id', orgId).in('sku', chunk);
      for (const p of data || []) nameMap.set(p.sku, p.name || p.sku);
    }

    // replay chronologically so FEFO/stock math is correct
    const parsed = rows.map((r: any, idx: number) => ({
      idx, sku: String(r.sku || '').trim(),
      type: normType(r.type), qty: Number(r.qty || 0),
      date: r.date ? new Date(r.date) : null,
      ref: r.ref || r.doc_ref || '', note: r.note || '', location: r.location || '', uom: r.uom || '', by: r.by || 'import',
    })).sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

    const errors: string[] = [];
    const byType: Record<string, number> = { IN: 0, OUT: 0, DAMAGE: 0, ADJUST: 0 };
    let txns: any[] = [];
    let applied = 0;

    // Flush the ledger as we go (every 200 rows) so an interruption/timeout can't
    // leave stock applied with an empty ledger — the two stay in step.
    const flush = async () => { if (txns.length) { await admin.from('stock_transactions').insert(txns); txns = []; } };

    for (const r of parsed) {
      if (!r.sku) { errors.push(`แถว ${r.idx + 1}: ไม่มี SKU`); continue; }
      if (!r.type) { errors.push(`แถว ${r.idx + 1}: ประเภทไม่ถูกต้อง (${r.sku})`); continue; }
      if (!nameMap.has(r.sku)) { errors.push(`แถว ${r.idx + 1}: ไม่พบสินค้า ${r.sku} (นำเข้า Product Master ก่อน)`); continue; }
      const baseQty = await toBaseQty(orgId, r.sku, r.qty, r.uom);
      const when = (r.date && !isNaN(r.date.getTime()) ? r.date : new Date()).toISOString();

      // ADJUST rows are a counted quantity for the bin; the ledger stores the
      // signed correction (counted − before), same as count approval does.
      let ledgerQty = baseQty;
      let note = r.note || null;
      try {
        if (r.type === 'IN') await binAdd(orgId, r.sku, r.location || 'RECEIVING-DOCK', baseQty);
        else if (r.type === 'OUT' || r.type === 'DAMAGE') await binConsume(orgId, r.sku, baseQty, { preferBin: r.location, docRef: r.ref });
        else if (r.type === 'ADJUST') {
          const bin = (r.location || '').trim() || 'UNASSIGNED'; // same normalisation as stockLocations
          const before = (await getBins(orgId, r.sku))
            .filter(b => b.binCode === bin)
            .reduce((s, b) => s + Number(b.quantity || 0), 0);
          await binSet(orgId, r.sku, r.location || 'UNASSIGNED', baseQty);
          ledgerQty = baseQty - before;
          note = [note, `นับได้ ${baseQty} (เดิม ${before})`].filter(Boolean).join(' · ');
        }
      } catch (e) { errors.push(`แถว ${r.idx + 1}: ${errorMessage(e)}`); continue; }

      txns.push({
        org_id: orgId, type: r.type === 'ADJUST' ? 'ADJUST' : r.type, sku: r.sku,
        product_name: nameMap.get(r.sku) || r.sku, qty: ledgerQty, unit_price: 0,
        doc_ref: r.ref || `HIST-${r.type}`, location: r.location || '', user_name: r.by,
        notes: note, created_at: when,
      });
      byType[r.type]++; applied++;
      if (txns.length >= 200) await flush();
    }
    await flush();

    return NextResponse.json({
      success: true, total: rows.length, applied, byType,
      errors: errors.slice(0, 100), errorCount: errors.length,
      message: `นำเข้าประวัติ ${applied}/${rows.length} รายการ — ระบบคำนวณยอดคงเหลือจากประวัติแล้ว`,
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
