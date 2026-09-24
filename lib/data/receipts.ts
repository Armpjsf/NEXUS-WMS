// Receiving (GRN) + putaway: EXPECTED → RECEIVING → DONE.
// Committing a receipt increments stock, logs IN transactions, and (optionally)
// sets each product's location to the chosen putaway bin.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { binAdd } from '@/lib/stockLocations';
import { toBaseQty } from '@/lib/uom';
import { poCostMap, applyReceiptCost, insertTxWithCost } from '@/lib/costing';
import { recordLotReceipt, normalizeDate } from '@/lib/lots';
import { nextDocNumber } from '@/lib/docNumber';

export type ReceiptStatus = 'EXPECTED' | 'RECEIVING' | 'DONE' | 'CANCELLED';

export interface ReceiptLine {
  sku: string;
  name: string;
  expectedQty: number;
  receivedQty?: number;
  putawayBin?: string;
  uom?: string;      // A4/A-UI: unit the receivedQty is counted in (blank = base)
  /** Cost per base unit. Blank = taken from the linked PO line, if any. */
  unitCost?: number;
  /** Lot / batch received (blank = unlotted). */
  lotNo?: string;
  /** Expiry of that lot, YYYY-MM-DD. */
  expDate?: string;
  done?: boolean;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  poNumber: string;
  supplier: string;
  status: ReceiptStatus;
  items: ReceiptLine[];
  createdBy: string;
  notes: string;
  createdAt: string;
  receivedAt: string | null;
  completedAt: string | null;
}

function mapReceipt(r: any): Receipt {
  const raw: any[] = Array.isArray(r.items_json) ? r.items_json : [];
  return {
    id: r.id,
    receiptNo: r.receipt_no,
    poNumber: r.po_number || '',
    supplier: r.supplier || '',
    status: r.status || 'EXPECTED',
    items: raw.map((l) => ({
      sku: l.sku, name: l.name, expectedQty: Number(l.expected_qty ?? l.expectedQty ?? 0),
      receivedQty: Number(l.received_qty ?? l.receivedQty ?? 0),
      putawayBin: l.putaway_bin ?? l.putawayBin ?? '', done: !!l.done,
      ...(l.unit_cost != null ? { unitCost: Number(l.unit_cost) } : {}),
      ...(l.lot_no ? { lotNo: String(l.lot_no) } : {}),
      ...(l.exp_date ? { expDate: String(l.exp_date) } : {}),
    })),
    createdBy: r.created_by || '',
    notes: r.notes || '',
    createdAt: r.created_at,
    receivedAt: r.received_at,
    completedAt: r.completed_at,
  };
}

function toRow(items: ReceiptLine[]) {
  return items.map((l) => ({
    sku: l.sku, name: l.name, expected_qty: Number(l.expectedQty) || 0,
    received_qty: Number(l.receivedQty) || 0, putaway_bin: l.putawayBin || '', done: !!l.done,
    ...(Number(l.unitCost) > 0 ? { unit_cost: Number(l.unitCost) } : {}),
    ...(l.lotNo?.trim() ? { lot_no: l.lotNo.trim() } : {}),
    ...(normalizeDate(l.expDate) ? { exp_date: normalizeDate(l.expDate) } : {}),
  }));
}

async function nextReceiptNo(): Promise<string> {
  return nextDocNumber('GRN', { existing: { table: 'receipts', column: 'receipt_no' } });
}

export async function listReceipts(opts: { status?: string; limit?: number } = {}): Promise<Receipt[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase.from('receipts').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(opts.limit || 200);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) { console.error('[receipts] list error:', error); return []; }
  return (data || []).map(mapReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from('receipts').select('*').eq('id', id).eq('org_id', orgId).maybeSingle();
  if (error || !data) return null;
  return mapReceipt(data);
}

export async function createReceipt(input: {
  poNumber?: string; supplier?: string; items: ReceiptLine[]; createdBy?: string; notes?: string;
}): Promise<Receipt | null> {
  const receiptNo = await nextReceiptNo();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from('receipts').insert({
    org_id: orgId,
    receipt_no: receiptNo,
    po_number: input.poNumber || '',
    supplier: input.supplier || '',
    status: 'EXPECTED',
    items_json: toRow(input.items || []),
    created_by: input.createdBy || 'System',
    notes: input.notes || '',
  }).select().single();
  if (error) { console.error('[receipts] create error:', error); return null; }
  return mapReceipt(data);
}

// Commit received quantities: increment stock + log IN + set putaway location, mark DONE.
export async function commitReceipt(id: string, lines: ReceiptLine[]): Promise<Receipt | null> {
  const receipt = await getReceipt(id);
  if (!receipt) return null;
  const admin = getServiceSupabase();
  const orgId = await getCurrentOrgId();
  // Cost comes from the line, else from the linked PO (PO price = purchase cost).
  const poCost = await poCostMap(admin, orgId, receipt.poNumber);

  for (const line of lines) {
    // A-UI #2: receivedQty may be entered in cartons/pallets — convert to base.
    const recv = await toBaseQty(orgId, line.sku, Number(line.receivedQty) || 0, line.uom);
    if (recv <= 0) continue;

    const { data: prod } = await admin.from('products').select('stock, name, location, price').eq('org_id', orgId).eq('sku', line.sku).maybeSingle();
    const binCode = line.putawayBin || prod?.location || 'RECEIVING-DOCK';
    if (!prod) {
      // create the product first with 0 stock; binAdd reconciles the total from bins
      await admin.from('products').insert({
        org_id: orgId, sku: line.sku, name: line.name || line.sku, stock: 0,
        location: binCode,
      });
    }
    const stockBefore = Number(prod?.stock || 0);
    // add to the put-away bin; products.stock (= sum of bins) is reconciled inside.
    // A lot number puts the qty on that lot in the bin (FEFO/trace) and
    // increments the lot record — creating it, with its expiry, if new.
    const lotNo = line.lotNo?.trim() || '';
    const expDate = normalizeDate(line.expDate);
    await binAdd(orgId, line.sku, binCode, recv, lotNo ? { lotNo, docRef: receipt.receiptNo, party: receipt.supplier || undefined } : undefined);
    if (lotNo) {
      await recordLotReceipt(admin, orgId, { sku: line.sku, lotNumber: lotNo, qty: recv, expDate, note: `รับเข้า ${receipt.receiptNo}` });
    }

    // Cost per BASE unit. A cost typed on the line is per the line's uom
    // (carton/pallet) and is converted; a PO price is already per base unit.
    let unitCost = poCost[line.sku] || 0;
    if (Number(line.unitCost) > 0) {
      const perUom = await toBaseQty(orgId, line.sku, 1, line.uom);
      unitCost = Number(line.unitCost) / (perUom > 0 ? perUom : 1);
    }
    await applyReceiptCost(admin, orgId, line.sku, stockBefore, recv, unitCost);

    await insertTxWithCost(admin, {
      org_id: orgId,
      type: 'IN', sku: line.sku, product_name: line.name || prod?.name || line.sku,
      qty: recv, unit_price: Number(prod?.price || 0), doc_ref: receipt.receiptNo,
      location: line.putawayBin || prod?.location || '', user_name: receipt.createdBy || 'Warehouse',
      ...(lotNo ? { batch_no: lotNo } : {}),
      ...(expDate ? { expiry_date: expDate } : {}),
      ...(unitCost > 0 ? { unit_cost: unitCost } : {}),
    });
  }

  const merged = toRow(lines.map((l) => ({ ...l, done: (Number(l.receivedQty) || 0) > 0 })));
  const now = new Date().toISOString();
  const { data, error } = await admin.from('receipts').update({
    items_json: merged, status: 'DONE', received_at: now, completed_at: now,
  }).eq('id', id).eq('org_id', orgId).select().single();
  if (error) { console.error('[receipts] commit error:', error); return null; }

  // A receipt made from a PO closes that PO.
  if (receipt.poNumber) {
    await admin.from('purchase_orders').update({ status: 'RECEIVED', updated_at: now })
      .eq('org_id', orgId).eq('po_number', receipt.poNumber).in('status', ['DRAFT', 'ORDERED']);
  }
  return mapReceipt(data);
}

export async function cancelReceipt(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const { error } = await getServiceSupabase().from('receipts').update({ status: 'CANCELLED' }).eq('id', id).eq('org_id', orgId);
  return !error;
}
