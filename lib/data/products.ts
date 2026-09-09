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
  unit: string;
  image: string;
  status: string;
  minStock: number;
  location: string;
  barcode?: string;
  owner: string;
  movementStatus?: string;
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
    unit: row.unit ?? 'pcs',
    image: row.image_url ?? '',
    status: row.status ?? 'ACTIVE',
    minStock: Number(row.min_stock ?? 0),
    location: row.location ?? 'Unassigned',
    barcode: row.barcode ?? '',
    owner: row.owner ?? '',
    movementStatus: row.movement_status ?? undefined,
  };
}

export function mapProductRows(rows: any[] | null | undefined): UIProduct[] {
  return (rows ?? []).map(mapProductRow);
}
