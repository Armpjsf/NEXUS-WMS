// Supabase <-> UI Product mapping helpers.
// The UI pages (inventory, dashboard, reports) expect the legacy `Product`
// shape that the old Google Sheets layer produced. Supabase stores snake_case
// columns, so we translate here to keep the frontend rendering fully.

export interface UIProduct {
  id: string; // SKU (business id used by the UI, keys, CSV export)
  rowId?: string; // Supabase UUID primary key (for precise updates/deletes)
  name: string;
  category: string;
  stock: number;
  price: number;
  /** Unit cost (moving average). undefined = not recorded. */
  cost?: number;
  /** Held by open orders (deducted at SHIPPED). Set by GET /api/products. */
  reserved?: number;
  /** stock − reserved. */
  available?: number;
  unit: string;
  image: string;
  status: string;
  minStock: number;
  location: string;
  barcode?: string;
  owner: string;
  movementStatus?: string;
  lotNo?: string;
  expiryDate?: string;
  mfgDate?: string;
}

export function getDaysUntilExpiry(expiryDate?: string | null): number | null {
  if (!expiryDate) return null;
  const target = new Date(expiryDate).getTime();
  if (isNaN(target)) return null;
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function isExpired(expiryDate?: string | null): boolean {
  const days = getDaysUntilExpiry(expiryDate);
  return days !== null && days < 0;
}

export function isExpiringSoon(expiryDate?: string | null, daysThreshold = 30): boolean {
  const days = getDaysUntilExpiry(expiryDate);
  return days !== null && days >= 0 && days <= daysThreshold;
}

// Map one raw Supabase row -> UIProduct shape expected by the frontend.
export function mapProductRow(row: any): UIProduct {
  return {
    id: row.sku ?? row.id ?? '',
    rowId: row.id,
    name: row.name ?? '',
    category: row.category ?? 'General',
    stock: Number(row.stock ?? 0),
    price: Number(row.price ?? 0),
    cost: row.cost_price == null ? undefined : Number(row.cost_price),
    unit: row.unit ?? 'pcs',
    image: row.image_url ?? '',
    status: row.status ?? 'ACTIVE',
    minStock: Number(row.min_stock ?? 0),
    location: row.location ?? 'Unassigned',
    barcode: row.barcode ?? '',
    owner: row.owner ?? '',
    movementStatus: row.movement_status ?? undefined,
    lotNo: row.lot_no ?? row.batch_no ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    mfgDate: row.mfg_date ?? undefined,
  };
}

export function mapProductRows(rows: any[] | null | undefined): UIProduct[] {
  return (rows ?? []).map(mapProductRow);
}

export async function createOrUpdateProductWithQuota(
  orgId: string,
  row: Record<string, any> & { sku: string },
  opts?: { eventId?: string },
) {
  const { getServiceSupabase } = await import('@/lib/supabase');
  const { countResource } = await import('@/lib/planLimits');
  const { checkAndReserveQuota, releaseQuotaReservation, commitQuotaReservation } = await import('@/lib/entitlements');
  const { upsertProductsForOrg } = await import('@/lib/data/productUpsert');

  const db = getServiceSupabase();
  const { data: existing } = await db
    .from('products').select('id').eq('org_id', orgId).eq('sku', row.sku).maybeSingle();

  const eventId = opts?.eventId || `wms:product:${orgId}:${row.sku}`;
  let reserved = false;
  if (!existing) {
    const qRes = await checkAndReserveQuota(
      orgId,
      'products',
      () => countResource(orgId, 'products', 'products'),
      { module: 'wms', eventId },
    );
    reserved = qRes.limit >= 0;
  }

  let committed = false;
  try {
    const res = await upsertProductsForOrg(orgId, [row]);
    if (reserved && !res?.error) {
      await commitQuotaReservation(orgId, 'products', { module: 'wms', eventId });
      committed = true;
    }
    return res;
  } finally {
    if (reserved && !committed) {
      await releaseQuotaReservation(orgId, 'products', 1, { module: 'wms', eventId }).catch(() => {});
    }
  }
}
