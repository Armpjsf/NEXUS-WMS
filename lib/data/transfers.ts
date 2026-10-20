// Stock Transfers data layer (Multi-branch transfer order flow)
// DRAFT → IN_TRANSIT (stock deducted from origin) → COMPLETED (stock added to destination)

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { nextDocNumber } from '@/lib/docNumber';
import { binAdd, binConsume } from '@/lib/stockLocations';

export type TransferStatus = 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface TransferLine {
  sku: string;
  name: string;
  qty: number;
  unit?: string;
}

export interface StockTransfer {
  id: string;
  orgId: string;
  transferNo: string;
  fromBranchId: string;
  toBranchId: string;
  status: TransferStatus;
  items: TransferLine[];
  totalQty: number;
  notes?: string;
  createdBy?: string;
  shippedAt?: string;
  receivedAt?: string;
  createdAt: string;
}

export function mapTransfer(r: any): StockTransfer {
  const items = Array.isArray(r.items) ? r.items : (typeof r.items === 'string' ? JSON.parse(r.items || '[]') : []);
  const totalQty = items.reduce((acc: number, it: any) => acc + (Number(it.qty) || 0), 0);
  return {
    id: r.id,
    orgId: r.org_id || '',
    transferNo: r.transfer_no || '',
    fromBranchId: r.from_branch_id || r.from_branch || 'hq',
    toBranchId: r.to_branch_id || r.to_branch || '',
    status: r.status || 'DRAFT',
    items,
    totalQty: r.total_qty || totalQty,
    notes: r.notes || '',
    createdBy: r.created_by || '',
    shippedAt: r.shipped_at || '',
    receivedAt: r.received_at || '',
    createdAt: r.created_at || new Date().toISOString(),
  };
}

export async function getTransfers(): Promise<StockTransfer[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('stock_transfers')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // No demo fallback: an empty/missing table must show as empty, never as
  // invented transfers on a live system.
  if (error) {
    console.warn('[transfers] list error:', error.message);
    return [];
  }

  return data.map(mapTransfer);
}

export async function createTransfer(input: {
  fromBranchId: string;
  toBranchId: string;
  items: TransferLine[];
  notes?: string;
}): Promise<StockTransfer | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const transferNo = await nextDocNumber('TR', { date: 'yyyymmdd', existing: { table: 'stock_transfers', column: 'transfer_no' } });
  const totalQty = input.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  const row = {
    org_id: orgId,
    transfer_no: transferNo,
    from_branch_id: input.fromBranchId,
    to_branch_id: input.toBranchId,
    status: 'DRAFT',
    items: input.items,
    total_qty: totalQty,
    notes: input.notes || '',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('stock_transfers')
    .insert(row)
    .select()
    .single();

  if (error) {
    // Report the failure — returning a fake row made the UI say "saved".
    console.error('[transfers] insert failed:', error.message);
    return null;
  }

  return mapTransfer(data);
}

export async function updateTransferStatus(
  id: string,
  newStatus: TransferStatus,
  approvedBy?: string,
): Promise<StockTransfer | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  const { data: existing, error: fetchErr } = await client
    .from('stock_transfers')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (fetchErr || !existing) {
    console.warn('[transfers] transfer not found:', fetchErr?.message);
    return null;
  }

  if (existing.status === newStatus) {
    return mapTransfer(existing);
  }

  const prevStatus: TransferStatus = existing.status || 'DRAFT';
  const items: TransferLine[] = Array.isArray(existing.items)
    ? existing.items
    : typeof existing.items === 'string'
      ? JSON.parse(existing.items || '[]')
      : [];
  const fromBranch = existing.from_branch || existing.from_branch_id || 'HQ';
  const toBranch = existing.to_branch || existing.to_branch_id || 'MAIN';
  const actor = approvedBy || existing.created_by || 'System';

  const patch: Record<string, any> = { status: newStatus };
  if (newStatus === 'IN_TRANSIT') {
    patch.shipped_at = new Date().toISOString();
  } else if (newStatus === 'COMPLETED') {
    patch.received_at = new Date().toISOString();
    if (!existing.shipped_at) patch.shipped_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('stock_transfers')
    .update(patch)
    .eq('id', id)
    .eq('org_id', orgId)
    .neq('status', newStatus)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[transfers] update error fallback:', error.message);
    return null;
  }
  if (!data) {
    return mapTransfer(existing);
  }

  // Move stock & log stock_transactions according to transition
  if (newStatus === 'IN_TRANSIT' && (prevStatus === 'DRAFT' || prevStatus === 'PENDING')) {
    for (const item of items) {
      const qty = Number(item.qty || 0);
      if (!item.sku || qty <= 0) continue;
      await binConsume(orgId, item.sku, qty, {
        preferBin: fromBranch,
        docRef: existing.transfer_no,
        party: toBranch,
      });
      await client.from('stock_transactions').insert({
        org_id: orgId,
        sku: item.sku,
        product_name: item.name || item.sku,
        type: 'OUT',
        qty,
        location: fromBranch,
        doc_ref: existing.transfer_no,
        notes: 'Transfer Out to ' + toBranch,
        user_name: actor,
      });
    }
  } else if (newStatus === 'COMPLETED') {
    if (prevStatus === 'DRAFT' || prevStatus === 'PENDING') {
      // Skipped IN_TRANSIT — consume from origin first
      for (const item of items) {
        const qty = Number(item.qty || 0);
        if (!item.sku || qty <= 0) continue;
        await binConsume(orgId, item.sku, qty, {
          preferBin: fromBranch,
          docRef: existing.transfer_no,
          party: toBranch,
        });
        await client.from('stock_transactions').insert({
          org_id: orgId,
          sku: item.sku,
          product_name: item.name || item.sku,
          type: 'OUT',
          qty,
          location: fromBranch,
          doc_ref: existing.transfer_no,
          notes: 'Transfer Out to ' + toBranch,
          user_name: actor,
        });
      }
    }
    for (const item of items) {
      const qty = Number(item.qty || 0);
      if (!item.sku || qty <= 0) continue;
      await binAdd(orgId, item.sku, toBranch || 'MAIN', qty, {
        docRef: existing.transfer_no,
        party: fromBranch,
      });
      await client.from('stock_transactions').insert({
        org_id: orgId,
        sku: item.sku,
        product_name: item.name || item.sku,
        type: 'IN',
        qty,
        location: toBranch || 'MAIN',
        doc_ref: existing.transfer_no,
        notes: 'Transfer In from ' + fromBranch,
        user_name: actor,
      });
    }
  } else if (newStatus === 'CANCELLED' && prevStatus === 'IN_TRANSIT') {
    // Restore deducted stock back to origin branch
    for (const item of items) {
      const qty = Number(item.qty || 0);
      if (!item.sku || qty <= 0) continue;
      await binAdd(orgId, item.sku, fromBranch || 'HQ', qty, {
        docRef: existing.transfer_no,
        party: toBranch,
      });
      await client.from('stock_transactions').insert({
        org_id: orgId,
        sku: item.sku,
        product_name: item.name || item.sku,
        type: 'IN',
        qty,
        location: fromBranch || 'HQ',
        doc_ref: existing.transfer_no,
        notes: 'Transfer Reversal (Cancelled) from ' + toBranch,
        user_name: actor,
      });
    }
  }

  return mapTransfer(data);
}
