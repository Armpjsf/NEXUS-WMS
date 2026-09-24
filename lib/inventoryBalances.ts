/**
 * Multi-Bin Inventory Balances & Real-Time Allocation Engine
 * WMS Smart Enterprise Core
 */

import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';

export interface InventoryBalanceRecord {
  id: string;
  sku: string;
  lotNumber: string;
  locationCode: string;
  qtyOnHand: number;
  qtyAllocated: number;
  qtyAvailable: number;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  updatedAt?: string;
}

/**
 * Get balances for SKU or Location with safe fallback to products table
 */
export async function getInventoryBalances(
  orgId: string,
  filter?: { sku?: string; locationCode?: string }
): Promise<InventoryBalanceRecord[]> {
  try {
    let query = supabase
      .from('inventory_balances')
      .select('*')
      .eq('org_id', orgId);

    if (filter?.sku) query = query.eq('sku', filter.sku);
    if (filter?.locationCode) query = query.eq('location_code', filter.locationCode);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      // Fallback to single product view if inventory_balances table is not yet seeded
      if (filter?.sku) {
        const { data: prod } = await supabase
          .from('products')
          .select('id, sku, name, stock, location')
          .eq('org_id', orgId)
          .eq('sku', filter.sku)
          .maybeSingle();

        if (prod) {
          return [{
            id: prod.id,
            sku: prod.sku,
            lotNumber: 'DEFAULT',
            locationCode: prod.location || 'A-01-01',
            qtyOnHand: Number(prod.stock || 0),
            qtyAllocated: 0,
            qtyAvailable: Number(prod.stock || 0),
            zone: (prod.location || 'A').charAt(0),
          }];
        }
      }
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      sku: row.sku,
      lotNumber: row.lot_number || '',
      locationCode: row.location_code,
      qtyOnHand: Number(row.qty_on_hand || 0),
      qtyAllocated: Number(row.qty_allocated || 0),
      qtyAvailable: Number(row.qty_available ?? (Number(row.qty_on_hand || 0) - Number(row.qty_allocated || 0))),
      zone: row.zone,
      aisle: row.aisle,
      rack: row.rack,
      shelf: row.shelf,
      updatedAt: row.updated_at
    }));
  } catch (err) {
    console.error('getInventoryBalances error:', err);
    return [];
  }
}

/**
 * Real-time stock reservation / allocation for an order
 */
export async function allocateStock(
  orgId: string,
  sku: string,
  locationCode: string,
  lotNumber: string,
  qtyToAllocate: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: record, error: fetchErr } = await supabase
      .from('inventory_balances')
      .select('*')
      .eq('org_id', orgId)
      .eq('sku', sku)
      .eq('location_code', locationCode)
      .eq('lot_number', lotNumber)
      .maybeSingle();

    if (fetchErr || !record) {
      return { success: false, error: 'Inventory balance record not found' };
    }

    const currentAlloc = Number(record.qty_allocated || 0);
    const onHand = Number(record.qty_on_hand || 0);
    if (onHand - (currentAlloc + qtyToAllocate) < 0) {
      return { success: false, error: 'Insufficient available quantity to reserve' };
    }

    // Optimistic lock: only apply if nobody changed qty_allocated since we read
    // it — two concurrent reservations could otherwise both pass the check above.
    const { data: updatedRows, error: updateErr } = await supabase
      .from('inventory_balances')
      .update({
        qty_allocated: currentAlloc + qtyToAllocate,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id)
      .eq('org_id', orgId)
      .eq('qty_allocated', record.qty_allocated ?? 0)
      .select('id');

    if (updateErr) return { success: false, error: updateErr.message };
    if (!updatedRows || updatedRows.length === 0) {
      return { success: false, error: 'ยอดจองถูกแก้ไขพร้อมกัน กรุณาลองใหม่ (concurrent reservation)' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}