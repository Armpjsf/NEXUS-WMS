// Receiving (GRN) + putaway: EXPECTED → RECEIVING → DONE.
// Committing a receipt increments stock, logs IN transactions, and (optionally)
// sets each product's location to the chosen putaway bin.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { binAdd } from '@/lib/stockLocations';
import { toBaseQty } from '@/lib/uom';
import { nextDocNumber } from '@/lib/docNumber';

export type ReceiptStatus = 'EXPECTED' | 'RECEIVING' | 'DONE' | 'CANCELLED';

export interface ReceiptLine {
  sku: string;
  name: string;
  expectedQty: number;
  receivedQty?: number;
  putawayBin?: string;
  uom?: string;      // A4/A-UI: unit the receivedQty is counted in (blank = base)
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
    // add to the put-away bin; products.stock (= sum of bins) is reconciled inside
    await binAdd(orgId, line.sku, binCode, recv);

    await admin.from('stock_transactions').insert({
      org_id: orgId,
      type: 'IN', sku: line.sku, product_name: line.name || prod?.name || line.sku,
      qty: recv, unit_price: Number(prod?.price || 0), doc_ref: receipt.receiptNo,
      location: line.putawayBin || prod?.location || '', user_name: receipt.createdBy || 'Warehouse',
    });
  }

  const merged = toRow(lines.map((l) => ({ ...l, done: (Number(l.receivedQty) || 0) > 0 })));
  const now = new Date().toISOString();
  const { data, error } = await admin.from('receipts').update({
    items_json: merged, status: 'DONE', received_at: now, completed_at: now,
  }).eq('id', id).eq('org_id', orgId).select().single();
  if (error) { console.error('[receipts] commit error:', error); return null; }
  return mapReceipt(data);
}

export async function cancelReceipt(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const { error } = await getServiceSupabase().from('receipts').update({ status: 'CANCELLED' }).eq('id', id).eq('org_id', orgId);
  return !error;
}
