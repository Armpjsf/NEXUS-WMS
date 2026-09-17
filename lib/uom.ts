/**
 * A4 — Unit of Measure (pack hierarchy).
 *
 * Stock is stored in BASE units everywhere. These helpers convert a quantity
 * entered in an alternate unit (carton, pallet, inner pack) to/from base, so
 * every stock flow keeps doing base-unit math while the floor works in packs.
 *
 * A line with no `uom` (or uom === base) is already in base units — so all
 * existing callers keep working unchanged.
 */

import { getServiceSupabase } from '@/lib/supabase';

export interface Uom {
  code: string;
  name?: string;
  factor: number;   // base units per 1 of this uom
  barcode?: string;
  isBase?: boolean;
}

/** List a SKU's units, base first. Base unit comes from products.unit (factor 1). */
export async function getUoms(orgId: string, sku: string): Promise<Uom[]> {
  const admin = getServiceSupabase();
  const [{ data: prod }, { data: rows }] = await Promise.all([
    admin.from('products').select('unit').eq('org_id', orgId).eq('sku', sku).maybeSingle(),
    admin.from('product_uoms').select('uom_code, uom_name, factor, barcode').eq('org_id', orgId).eq('sku', sku),
  ]);
  const base: Uom = { code: (prod?.unit || 'pcs'), name: prod?.unit || 'ชิ้น', factor: 1, isBase: true };
  const alts: Uom[] = (rows || [])
    .map((r: any) => ({ code: r.uom_code, name: r.uom_name || r.uom_code, factor: Number(r.factor) || 1, barcode: r.barcode || undefined }))
    .filter(u => u.code && u.code !== base.code)
    .sort((a, b) => a.factor - b.factor);
  return [base, ...alts];
}

/** Convert `qty` given in `uomCode` to BASE units. Unknown/blank uom = base (factor 1). */
export async function toBaseQty(orgId: string, sku: string, qty: number, uomCode?: string | null): Promise<number> {
  const q = Number(qty) || 0;
  if (!uomCode) return q;
  const { data: prod } = await getServiceSupabase()
    .from('products').select('unit').eq('org_id', orgId).eq('sku', sku).maybeSingle();
  if (prod?.unit && String(prod.unit) === uomCode) return q; // already base
  const { data: row } = await getServiceSupabase()
    .from('product_uoms').select('factor').eq('org_id', orgId).eq('sku', sku).eq('uom_code', uomCode).maybeSingle();
  const factor = Number(row?.factor) || 1; // unknown uom → treat as base (no silent inflation)
  return q * factor;
}

/** Resolve a scanned barcode to a UOM factor (carton barcode → base qty per scan). */
export async function uomByBarcode(orgId: string, sku: string, barcode: string): Promise<Uom | null> {
  const { data } = await getServiceSupabase()
    .from('product_uoms').select('uom_code, uom_name, factor, barcode')
    .eq('org_id', orgId).eq('sku', sku).eq('barcode', barcode).maybeSingle();
  if (!data) return null;
  return { code: data.uom_code, name: data.uom_name || data.uom_code, factor: Number(data.factor) || 1, barcode: data.barcode || undefined };
}

/** Upsert one alternate unit for a SKU. */
export async function setUom(orgId: string, sku: string, uom: { code: string; name?: string; factor: number; barcode?: string }): Promise<void> {
  await getServiceSupabase().from('product_uoms').upsert({
    org_id: orgId, sku, uom_code: uom.code, uom_name: uom.name || uom.code,
    factor: Number(uom.factor) || 1, barcode: uom.barcode || null, updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,sku,uom_code' });
}
