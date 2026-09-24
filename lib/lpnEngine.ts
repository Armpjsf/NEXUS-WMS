/**
 * License Plate Number (LPN) & Bulk Pallet Tracking Engine
 * WMS Smart Enterprise - Phase 2
 */

import { getServiceSupabase } from '@/lib/supabase';
import { binMoveAll } from '@/lib/stockLocations';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { nextDocNumber } from './docNumber';

// Use the service client for all LPN DB ops — RLS on license_plate_numbers /
// lpn_items otherwise hides rows from the anon client, so a moved pallet's items
// come back empty and its stock never follows.
const supabase = getServiceSupabase();

export interface LPNItem {
  id?: string;
  sku: string;
  productName?: string;
  lotNumber?: string;
  quantity: number;
  unit?: string;
}

export interface LPN {
  id?: string;
  lpnNumber: string;
  lpnType: 'PALLET' | 'MASTER_CARTON' | 'TOTE' | 'CAGE';
  locationCode: string;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'CONSUMED' | 'ARCHIVED';
  totalWeight?: number;
  maxWeight?: number;
  items: LPNItem[];
  notes?: string;
  createdAt?: string;
}

// Fallback in-memory store if database table is not yet migrated
const memoryLpns: Map<string, LPN> = new Map();

const LPN_TYPE_CODE = { PALLET: 'PL', MASTER_CARTON: 'MC', TOTE: 'TT', CAGE: 'CG' } as const;

/** LPN-<type>-YYYYMMDD-NNNN from the atomic doc sequence (no random collisions). */
export async function generateLpnNumber(type: 'PALLET' | 'MASTER_CARTON' | 'TOTE' | 'CAGE' = 'PALLET'): Promise<string> {
  return nextDocNumber(`LPN-${LPN_TYPE_CODE[type] || 'PL'}`, { date: 'yyyymmdd', pad: 4, existing: { table: 'license_plate_numbers', column: 'lpn_number' } });
}

export async function createLPN(params: {
  lpnNumber?: string;
  lpnType: 'PALLET' | 'MASTER_CARTON' | 'TOTE' | 'CAGE';
  locationCode: string;
  items: LPNItem[];
  notes?: string;
}): Promise<LPN> {
  const orgId = await getCurrentOrgId();
  const lpnNumber = params.lpnNumber || await generateLpnNumber(params.lpnType);

  const newLpn: LPN = {
    lpnNumber,
    lpnType: params.lpnType,
    locationCode: params.locationCode || 'RECEIVING-DOCK',
    status: 'ACTIVE',
    totalWeight: params.items.reduce((sum, it) => sum + (it.quantity * 2.5), 0),
    items: params.items,
    notes: params.notes || '',
    createdAt: new Date().toISOString()
  };

  {
    const { data: header, error: hErr } = await supabase
      .from('license_plate_numbers')
      .insert({
        org_id: orgId,
        lpn_number: lpnNumber,
        lpn_type: params.lpnType,
        location_code: params.locationCode || 'RECEIVING-DOCK',
        status: 'ACTIVE',
        total_weight: newLpn.totalWeight,
        notes: params.notes || ''
      })
      .select()
      .single();

    // Fail loudly: the old in-memory fallback returned success for an LPN that
    // was never saved (and vanished on the next serverless instance).
    if (hErr || !header) throw new Error(`บันทึก LPN ไม่สำเร็จ: ${hErr?.message || 'no row returned'}`);
    {
      if (params.items.length > 0) {
        const itemRows = params.items.map(it => ({
          lpn_id: header.id,
          sku: it.sku,
          product_name: it.productName || it.sku,
          lot_number: it.lotNumber || '',
          quantity: it.quantity,
          unit: it.unit || 'pcs'
        }));
        const { error: iErr } = await supabase.from('lpn_items').insert(itemRows);
        if (iErr) throw new Error(`บันทึกรายการใน LPN ${lpnNumber} ไม่สำเร็จ: ${iErr.message}`);
      }
    }
  }

  memoryLpns.set(lpnNumber, newLpn);

  await recordEnterpriseAudit({
    orgId,
    action: 'INSERT',
    entityName: 'license_plate_numbers',
    entityId: lpnNumber,
    afterState: newLpn as any,
    performedBy: 'system',
    reason: `Created LPN ${lpnNumber} with ${params.items.length} items`
  });

  return newLpn;
}

export async function moveLPN(lpnNumber: string, newLocation: string, operator = 'Operator'): Promise<{ success: boolean; lpn: LPN }> {
  const orgId = await getCurrentOrgId();
  let target = memoryLpns.get(lpnNumber);

  try {
    const { data: existing } = await supabase
      .from('license_plate_numbers')
      .select('*, lpn_items(*)')
      .eq('org_id', orgId)
      .eq('lpn_number', lpnNumber)
      .maybeSingle();

    if (existing) {
      const oldLocation = existing.location_code;
      await supabase
        .from('license_plate_numbers')
        .update({ location_code: newLocation, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('org_id', orgId);

      // ย้ายสต็อกราย SKU จาก bin เดิมของพาเลท → bin ปลายทาง (ยอดตามไปจริงต่อ bin)
      // ย้ายเฉพาะจำนวนที่อยู่ bin ต้นทางของพาเลท ไม่ไปแตะ bin อื่นของ SKU เดียวกัน
      const movedSkus: string[] = [];
      const itemSkus: string[] = (existing.lpn_items || [])
        .map((it: any) => it.sku)
        .filter(Boolean);
      for (const sku of itemSkus) {
        try {
          const { moved } = await binMoveAll(orgId, sku, oldLocation, newLocation);
          if (moved > 0) movedSkus.push(sku);
        } catch (stockErr) {
          console.warn(`LPN move: bin move failed for ${sku}:`, stockErr);
        }
      }

      target = {
        id: existing.id,
        lpnNumber: existing.lpn_number,
        lpnType: existing.lpn_type,
        locationCode: newLocation,
        status: existing.status,
        totalWeight: Number(existing.total_weight || 0),
        items: (existing.lpn_items || []).map((it: any) => ({
          sku: it.sku,
          productName: it.product_name,
          lotNumber: it.lot_number,
          quantity: Number(it.quantity || 0),
          unit: it.unit
        })),
        notes: existing.notes
      };

      await recordEnterpriseAudit({
        orgId,
        action: 'UPDATE',
        entityName: 'license_plate_numbers',
        entityId: lpnNumber,
        beforeState: { location: oldLocation, movedSkus: [] },
        afterState: { location: newLocation, movedSkus },
        performedBy: operator,
        reason: `Bulk moved LPN ${lpnNumber} from ${oldLocation} to ${newLocation}` +
          (movedSkus.length ? ` (relocated ${movedSkus.length} SKU stock: ${movedSkus.join(', ')})` : '')
      });
    }
  } catch (err) {
    console.warn('Move LPN database error, falling back to memory:', err);
  }

  if (target) {
    target.locationCode = newLocation;
    memoryLpns.set(lpnNumber, target);
    return { success: true, lpn: target };
  }

  throw new Error(`ไม่พบหมายเลข LPN: ${lpnNumber}`);
}

export async function getLPNList(): Promise<LPN[]> {
  const orgId = await getCurrentOrgId();
  try {
    const { data, error } = await supabase
      .from('license_plate_numbers')
      .select('*, lpn_items(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        lpnNumber: d.lpn_number,
        lpnType: d.lpn_type,
        locationCode: d.location_code,
        status: d.status,
        totalWeight: Number(d.total_weight || 0),
        items: (d.lpn_items || []).map((it: any) => ({
          sku: it.sku,
          productName: it.product_name,
          lotNumber: it.lot_number,
          quantity: Number(it.quantity || 0),
          unit: it.unit
        })),
        notes: d.notes,
        createdAt: d.created_at
      }));
    }
  } catch (err) {
    console.warn('LPN query fallback:', err);
  }

  return Array.from(memoryLpns.values());
}
