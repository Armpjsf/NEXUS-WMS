/**
 * Warehouse map data (2D plan + 3D twin).
 *
 * The map is drawn from the branch's saved LAYOUT (lib/warehouseLayout.ts):
 * every rack expands into its real bay × level bins, then per-bin stock from
 * stock_locations is laid on top. Nothing is invented — stock sitting in a
 * bin code that the layout doesn't contain is reported in `orphans`, and
 * stock with no bin in `unassigned`, so the gap between the map and the real
 * warehouse is visible instead of hidden.
 */

import { performABCAnalysis } from './slotting';
import { RackConfig, LayoutBin, listRackBins, normalizeBinCode } from './warehouseLayout';

export type VelocityClass = 'A' | 'B' | 'C' | 'D';
export type BinStatus = 'NORMAL' | 'LOW_STOCK' | 'EMPTY';

/** One stock row: qty of one SKU in one bin (lots summed). */
export interface BinStockRow {
  sku: string;
  binCode: string;
  quantity: number;
}

export interface BinProduct {
  id: string;          // SKU
  name: string;
  category: string;
  stock: number;       // qty in THIS bin
  totalStock: number;  // qty of the SKU across all bins
  minStock: number;
  unit: string;
  velocityClass: VelocityClass;
}

export interface MapBin extends LayoutBin {
  products: BinProduct[];
  totalStock: number;
  status: BinStatus;
  velocityClass: VelocityClass;
}

export interface MapRack {
  rack: RackConfig;
  bins: MapBin[];
  totalStock: number;
  occupiedBins: number;
}

export interface MapZone {
  zoneCode: string;
  racks: MapRack[];
  totalStock: number;
  totalBins: number;
  occupiedBins: number;
}

export interface LooseStock {
  binCode: string;
  products: BinProduct[];
  totalStock: number;
}

export interface WarehouseMapStats {
  totalZones: number;
  totalRacks: number;
  totalBins: number;
  occupiedBins: number;
  occupancyRate: number;
  lowStockBins: number;
  mappedStock: number;
  orphanStock: number;
  unassignedStock: number;
  totalWarehouseStock: number;
  totalProductsCount: number;
}

export interface WarehouseMapData {
  zones: MapZone[];
  binIndex: Map<string, MapBin>;
  orphans: LooseStock[];
  unassigned: LooseStock | null;
  stats: WarehouseMapStats;
}

const UNASSIGNED_CODES = new Set(['', 'UNASSIGNED', '-', 'NONE']);

const CLASS_RANK: Record<VelocityClass, number> = { A: 0, B: 1, C: 2, D: 3 };

function dominantClass(products: BinProduct[]): VelocityClass {
  if (products.length === 0) return 'D';
  return products.reduce<VelocityClass>((best, p) => (CLASS_RANK[p.velocityClass] < CLASS_RANK[best] ? p.velocityClass : best), 'D');
}

function binStatus(products: BinProduct[], total: number): BinStatus {
  if (total <= 0) return 'EMPTY';
  return products.some(p => p.totalStock <= p.minStock) ? 'LOW_STOCK' : 'NORMAL';
}

/** Fallback when stock_locations isn't available: one row per product at products.location. */
export function stockRowsFromProducts(products: any[] = []): BinStockRow[] {
  return products
    .filter(p => Number(p.stock || 0) > 0)
    .map(p => ({ sku: String(p.sku || p.id || p.name), binCode: normalizeBinCode(p.location), quantity: Number(p.stock || 0) }));
}

export function buildWarehouseMap(
  racks: RackConfig[] = [],
  stockRows: BinStockRow[] = [],
  products: any[] = [],
  transactions: any[] = [],
): WarehouseMapData {
  // Product master + ABC class, keyed by SKU.
  const abc = performABCAnalysis(products, transactions);
  const classBySku = new Map<string, VelocityClass>();
  abc.all.forEach(i => classBySku.set(String(i.sku || i.productId), i.class as VelocityClass));
  const productBySku = new Map<string, any>();
  products.forEach(p => productBySku.set(String(p.sku || p.id || p.name), p));

  const totalBySku = new Map<string, number>();
  stockRows.forEach(r => totalBySku.set(r.sku, (totalBySku.get(r.sku) || 0) + Number(r.quantity || 0)));

  // Stock grouped by bin code.
  const stockByBin = new Map<string, BinProduct[]>();
  stockRows.forEach(r => {
    const qty = Number(r.quantity || 0);
    if (qty <= 0) return;
    const code = normalizeBinCode(r.binCode);
    const p = productBySku.get(r.sku);
    const list = stockByBin.get(code) || [];
    const existing = list.find(x => x.id === r.sku);
    if (existing) { existing.stock += qty; }
    else {
      list.push({
        id: r.sku,
        name: p?.name || r.sku,
        category: p?.category || 'General',
        stock: qty,
        totalStock: totalBySku.get(r.sku) || qty,
        minStock: Number(p?.minStock ?? p?.min_stock ?? 0),
        unit: p?.unit || 'pcs',
        velocityClass: classBySku.get(r.sku) || 'D',
      });
    }
    stockByBin.set(code, list);
  });

  // Expand the layout into bins and attach stock.
  const binIndex = new Map<string, MapBin>();
  const zoneMap = new Map<string, MapZone>();
  racks.forEach(rack => {
    const bins: MapBin[] = listRackBins(rack).map(b => {
      const prods = stockByBin.get(b.binCode) || [];
      const total = prods.reduce((s, p) => s + p.stock, 0);
      const bin: MapBin = { ...b, products: prods, totalStock: total, status: binStatus(prods, total), velocityClass: dominantClass(prods) };
      if (!binIndex.has(b.binCode)) binIndex.set(b.binCode, bin);
      return bin;
    });
    const mapRack: MapRack = {
      rack,
      bins,
      totalStock: bins.reduce((s, b) => s + b.totalStock, 0),
      occupiedBins: bins.filter(b => b.totalStock > 0).length,
    };
    const zoneCode = rack.zoneCode || '-';
    const zone = zoneMap.get(zoneCode) || { zoneCode, racks: [], totalStock: 0, totalBins: 0, occupiedBins: 0 };
    zone.racks.push(mapRack);
    zone.totalStock += mapRack.totalStock;
    zone.totalBins += bins.length;
    zone.occupiedBins += mapRack.occupiedBins;
    zoneMap.set(zoneCode, zone);
  });

  // Stock the layout doesn't cover.
  const orphans: LooseStock[] = [];
  let unassigned: LooseStock | null = null;
  stockByBin.forEach((prods, code) => {
    if (binIndex.has(code)) return;
    const loose = { binCode: code || 'UNASSIGNED', products: prods, totalStock: prods.reduce((s, p) => s + p.stock, 0) };
    if (UNASSIGNED_CODES.has(code)) {
      unassigned = unassigned
        ? { ...unassigned, products: [...unassigned.products, ...prods], totalStock: unassigned.totalStock + loose.totalStock }
        : { ...loose, binCode: 'UNASSIGNED' };
    } else {
      orphans.push(loose);
    }
  });
  orphans.sort((a, b) => a.binCode.localeCompare(b.binCode, undefined, { numeric: true }));

  const zones = Array.from(zoneMap.values()).sort((a, b) => a.zoneCode.localeCompare(b.zoneCode, undefined, { numeric: true }));
  const allBins = zones.flatMap(z => z.racks.flatMap(r => r.bins));
  const occupiedBins = allBins.filter(b => b.totalStock > 0).length;
  const mappedStock = allBins.reduce((s, b) => s + b.totalStock, 0);
  const orphanStock = orphans.reduce((s, o) => s + o.totalStock, 0);
  const unassignedStock = (unassigned as LooseStock | null)?.totalStock || 0;

  return {
    zones,
    binIndex,
    orphans,
    unassigned,
    stats: {
      totalZones: zones.length,
      totalRacks: racks.length,
      totalBins: allBins.length,
      occupiedBins,
      occupancyRate: allBins.length > 0 ? Math.round((occupiedBins / allBins.length) * 100) : 0,
      lowStockBins: allBins.filter(b => b.status === 'LOW_STOCK').length,
      mappedStock,
      orphanStock,
      unassignedStock,
      totalWarehouseStock: mappedStock + orphanStock + unassignedStock,
      totalProductsCount: products.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Legacy zone/aisle/rack shapes — still referenced by lib/putaway.ts.
// ---------------------------------------------------------------------------
export interface WarehouseBin {
  binCode: string;
  zone: string;
  aisle: number;
  rack: number;
  shelf: number;
  totalStock: number;
}
export interface WarehouseRack {
  rackNumber: number;
  zone: string;
  aisle: number;
  bins: WarehouseBin[];
  totalStock: number;
  status: 'NORMAL' | 'LOW_STOCK' | 'EMPTY_CRITICAL' | 'AVAILABLE_EMPTY';
}
export interface WarehouseAisle {
  aisleNumber: number;
  zone: string;
  racks: WarehouseRack[];
  totalStock: number;
}
export interface WarehouseZone {
  zoneId: string;
  name: string;
  aisles: WarehouseAisle[];
  totalStock: number;
}
