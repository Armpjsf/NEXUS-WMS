// Inventory valuation & dead stock — from REAL data only.
//
// Previously "days dormant" came from the product's row index (idx % 4) and
// cost was assumed to be 68% of the selling price, so the report invented both
// its dead-stock list and its valuation. Now:
//  - days dormant = days since the SKU's last stock transaction (any type), or
//    since the product was created if it never moved;
//  - unit cost    = products.cost_price → last receipt unit_cost → latest PO
//    line price; when none exists the SKU is reported as "no cost" and left out
//    of cost totals instead of being guessed.

import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { hasColumn } from '@/lib/schemaProbe';

export type CostSource = 'PRODUCT' | 'RECEIPT' | 'PO' | 'NONE';

export interface DeadStockItem {
  sku: string;
  name: string;
  category: string;
  location: string;
  stock: number;
  unit: string;
  costPrice: number;
  costSource: CostSource;
  retailPrice: number;
  totalCostValue: number;
  totalRetailValue: number;
  daysDormant: number;
  lastMovedDate: string;
  /** true = never had a stock transaction; dormancy counted from creation. */
  neverMoved: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedAction: string;
}

export interface ValuationSummary {
  totalSkus: number;
  totalUnits: number;
  totalCostValuation: number;
  totalRetailValuation: number;
  estimatedMargin: number;
  deadStock30DaysCount: number;
  deadStock60DaysCount: number;
  deadStock90DaysCount: number;
  deadStockLockedCapital: number;
  /** SKUs in stock with no recorded cost (excluded from cost totals). */
  skusWithoutCost: number;
  deadStockItems: DeadStockItem[];
}

export interface ValuationProduct {
  sku: string;
  name: string;
  category?: string;
  location?: string;
  stock: number;
  unit?: string;
  price: number;
  costPrice?: number | null;
  createdAt?: string | null;
}

export interface ValuationInputs {
  products: ValuationProduct[];
  /** sku → ISO time of the latest stock transaction */
  lastMoved: Record<string, string>;
  /** sku → latest receipt unit cost */
  receiptCost: Record<string, number>;
  /** sku → latest PO line price */
  poCost: Record<string, number>;
  now?: number;
}

const DAY = 86_400_000;

function resolveCost(p: ValuationProduct, inp: ValuationInputs): { cost: number; source: CostSource } {
  if (Number(p.costPrice) > 0) return { cost: Number(p.costPrice), source: 'PRODUCT' };
  if (inp.receiptCost[p.sku] > 0) return { cost: inp.receiptCost[p.sku], source: 'RECEIPT' };
  if (inp.poCost[p.sku] > 0) return { cost: inp.poCost[p.sku], source: 'PO' };
  return { cost: 0, source: 'NONE' };
}

/** Pure calculation (unit-tested). */
export function computeValuation(inp: ValuationInputs): ValuationSummary {
  const now = inp.now ?? Date.now();
  let totalUnits = 0;
  let totalCost = 0;
  let totalRetail = 0;
  let retailWithCost = 0;
  let skusWithoutCost = 0;
  const dead: DeadStockItem[] = [];

  for (const p of inp.products) {
    const qty = Math.max(0, Number(p.stock) || 0);
    const retail = Number(p.price) || 0;
    const { cost, source } = resolveCost(p, inp);

    totalUnits += qty;
    totalRetail += qty * retail;
    if (source === 'NONE') {
      if (qty > 0) skusWithoutCost++;
    } else {
      totalCost += qty * cost;
      retailWithCost += qty * retail;
    }

    const moved = inp.lastMoved[p.sku];
    const ref = moved || p.createdAt || null;
    if (!ref || qty <= 0) continue;
    const daysDormant = Math.floor((now - new Date(ref).getTime()) / DAY);
    if (!(daysDormant >= 30)) continue;

    let severity: DeadStockItem['severity'] = 'MEDIUM';
    let suggestedAction = 'ย้ายไปวางหน้าร้าน หรือจัด Flash Sale';
    if (daysDormant >= 90) {
      severity = 'CRITICAL';
      suggestedAction = 'ลดล้างสต็อกด่วน (Clearance Sale) หรือรวมเซ็ต Bundle';
    } else if (daysDormant >= 60) {
      severity = 'HIGH';
      suggestedAction = 'ทำโปรโมชั่น 1 แถม 1 หรือคืนซัพพลายเออร์';
    }

    dead.push({
      sku: p.sku,
      name: p.name,
      category: p.category || 'General',
      location: p.location || 'Unassigned',
      stock: qty,
      unit: p.unit || 'ชิ้น',
      costPrice: cost,
      costSource: source,
      retailPrice: retail,
      totalCostValue: qty * cost,
      totalRetailValue: qty * retail,
      daysDormant,
      lastMovedDate: new Date(ref).toISOString().slice(0, 10),
      neverMoved: !moved,
      severity,
      suggestedAction,
    });
  }

  // Highest locked capital first; SKUs without cost sort by retail value.
  dead.sort((a, b) => (b.totalCostValue || b.totalRetailValue) - (a.totalCostValue || a.totalRetailValue));

  const margin = retailWithCost > 0 ? Math.round(((retailWithCost - totalCost) / retailWithCost) * 100) : 0;

  return {
    totalSkus: inp.products.length,
    totalUnits,
    totalCostValuation: totalCost,
    totalRetailValuation: totalRetail,
    estimatedMargin: margin,
    deadStock30DaysCount: dead.filter(d => d.daysDormant >= 30).length,
    deadStock60DaysCount: dead.filter(d => d.daysDormant >= 60).length,
    deadStock90DaysCount: dead.filter(d => d.daysDormant >= 90).length,
    deadStockLockedCapital: dead.reduce((s, d) => s + d.totalCostValue, 0),
    skusWithoutCost,
    deadStockItems: dead,
  };
}

export async function getInventoryValuation(): Promise<ValuationSummary> {
  const orgId = await getCurrentOrgId();
  const admin = getServiceSupabase();

  // cost_price / unit_cost exist once sql/20260925 has run. fetchAllRows
  // swallows errors (returns []), so probe the columns instead of catching.
  const hasCost = await hasColumn('products', 'cost_price');
  const hasTxCost = await hasColumn('stock_transactions', 'unit_cost');

  let products: any[] = await fetchAllRows((f, t) => admin.from('products')
    .select(`sku, name, category, location, stock, unit, price, created_at, status${hasCost ? ', cost_price' : ''}`)
    .eq('org_id', orgId).range(f, t));
  products = products.filter(p => String(p.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');

  // Latest movement + latest receipt cost per SKU (newest first).
  const txs: any[] = await fetchAllRows((f, t) => admin.from('stock_transactions')
    .select(`sku, type, created_at${hasTxCost ? ', unit_cost' : ''}`)
    .eq('org_id', orgId).order('created_at', { ascending: false }).range(f, t));
  const lastMoved: Record<string, string> = {};
  const receiptCost: Record<string, number> = {};
  for (const tx of txs) {
    if (!tx.sku) continue;
    if (!lastMoved[tx.sku] && tx.created_at) lastMoved[tx.sku] = tx.created_at;
    if (tx.type === 'IN' && !(tx.sku in receiptCost) && Number(tx.unit_cost) > 0) receiptCost[tx.sku] = Number(tx.unit_cost);
  }

  // Latest PO price per SKU (newest PO first).
  const poCost: Record<string, number> = {};
  const { data: pos } = await admin.from('purchase_orders').select('items_json, status')
    .eq('org_id', orgId).neq('status', 'CANCELLED').order('created_at', { ascending: false }).limit(500);
  for (const po of pos || []) {
    for (const l of (po.items_json as any[]) || []) {
      const price = Number(l.price ?? l.unitPrice ?? 0);
      if (l.sku && price > 0 && !(l.sku in poCost)) poCost[l.sku] = price;
    }
  }

  return computeValuation({
    products: products.map(p => ({
      sku: p.sku, name: p.name || p.sku, category: p.category, location: p.location,
      stock: Number(p.stock) || 0, unit: p.unit, price: Number(p.price) || 0,
      costPrice: p.cost_price == null ? null : Number(p.cost_price), createdAt: p.created_at,
    })),
    lastMoved, receiptCost, poCost,
  });
}
