/**
 * 2D Visual Warehouse Map & Real Data Integration Logic (WMS 360 PRO)
 * Automatically maps real inventory, ABC velocity, and slotting intelligence.
 */

import { parseLocation, ParsedLocation } from './picking';
import { performABCAnalysis } from './slotting';

export interface BinProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  velocityClass: 'A' | 'B' | 'C' | 'D';
  idealZone?: string;
  action?: string;
}

export interface WarehouseBin {
  binCode: string;
  zone: string;
  aisle: number;
  rack: number;
  shelf: number;
  products: BinProduct[];
  totalStock: number;
  status: 'NORMAL' | 'LOW_STOCK' | 'EMPTY_CRITICAL' | 'AVAILABLE_EMPTY';
  dominantVelocityClass: 'A' | 'B' | 'C' | 'D';
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
  color: string;
  aisles: WarehouseAisle[];
  totalStock: number;
  totalBins: number;
  occupiedBins: number;
}

export interface WarehouseMapStats {
  totalZones: number;
  totalAisles: number;
  totalRacks: number;
  totalBins: number;
  occupiedBins: number;
  emptyBins: number;
  occupancyRate: number;
  lowStockBins: number;
  outOfStockBins: number;
  unassignedProductsCount: number;
  totalWarehouseStock: number;
  totalProductsCount: number;
}

const ZONE_COLORS: Record<string, string> = {
  A: 'emerald',
  B: 'blue',
  C: 'amber',
  D: 'violet',
  E: 'rose',
  F: 'cyan',
};

/**
 * Build structured warehouse 2D map from real live Products & Transactions list
 */
export function buildWarehouseMap(
  products: any[] = [],
  transactions: any[] = []
): { zones: WarehouseZone[]; unassignedProducts: any[]; stats: WarehouseMapStats } {
  // 1. Perform ABC Analysis using real system slotting engine
  const abcInsights = performABCAnalysis(products, transactions);
  const abcMap = new Map<string, typeof abcInsights.all[0]>();
  abcInsights.all.forEach(item => {
    abcMap.set(item.productId || item.productName, item);
  });

  const binMap = new Map<string, WarehouseBin>();
  const unassignedProducts: any[] = [];
  const assignedProducts: any[] = [];

  // 2. Classify products into assigned vs unassigned
  products.forEach(p => {
    const loc = p.location?.trim();
    const isUnassigned = !loc || loc.toLowerCase() === 'unassigned' || loc === '-' || loc.toLowerCase() === 'none';

    const pKey = p.id || p.name;
    const insight = abcMap.get(pKey);
    const vClass = (insight?.class || 'C') as 'A' | 'B' | 'C' | 'D';

    const binProduct: BinProduct = {
      id: p.id || p.name,
      name: p.name || 'Unnamed Product',
      category: p.category || 'General',
      stock: Number(p.stock || 0),
      minStock: Number(p.minStock || 5),
      unit: p.unit || 'pcs',
      price: Number(p.price || 0),
      velocityClass: vClass,
      idealZone: insight?.idealZone || 'Middle / Zone B',
      action: insight?.action || 'KEEP',
    };

    if (isUnassigned) {
      unassignedProducts.push({ ...p, binProduct });
    } else {
      assignedProducts.push({ ...p, binProduct, loc });
    }
  });

  // 3. If products have explicit locations, populate their actual Bins
  assignedProducts.forEach(({ binProduct, loc }) => {
    const parsed: ParsedLocation = parseLocation(loc);
    const binCode = parsed.raw || `${parsed.zone}-${parsed.aisle.toString().padStart(2, '0')}-${parsed.rack.toString().padStart(2, '0')}`;

    if (!binMap.has(binCode)) {
      binMap.set(binCode, {
        binCode,
        zone: parsed.zone,
        aisle: parsed.aisle,
        rack: parsed.rack,
        shelf: parsed.shelf,
        products: [],
        totalStock: 0,
        status: 'NORMAL',
        dominantVelocityClass: binProduct.velocityClass,
      });
    }

    const bin = binMap.get(binCode)!;
    bin.products.push(binProduct);
    bin.totalStock += binProduct.stock;
  });

  // 4. SMART AUTO-PROJECTION FOR UNASSIGNED PRODUCTS:
  // If many products don't have location strings yet, automatically project them onto the warehouse map
  // based on their ABC Class (Zone A = Fast, Zone B = Normal, Zone C = Bulk) so the map displays full real data immediately!
  if (unassignedProducts.length > 0) {
    unassignedProducts.forEach(({ binProduct }, idx) => {
      let targetZone = 'B';
      if (binProduct.velocityClass === 'A') targetZone = 'A';
      else if (binProduct.velocityClass === 'C' || binProduct.velocityClass === 'D') targetZone = 'C';

      const aisleNum = (idx % 2) + 1; // Aisle 1 or 2
      const rackNum = Math.floor(idx / 2) % 4 + 1; // Rack 1 to 4
      const binCode = `${targetZone}-${aisleNum.toString().padStart(2, '0')}-${rackNum.toString().padStart(2, '0')}`;

      if (!binMap.has(binCode)) {
        binMap.set(binCode, {
          binCode,
          zone: targetZone,
          aisle: aisleNum,
          rack: rackNum,
          shelf: 1,
          products: [],
          totalStock: 0,
          status: 'NORMAL',
          dominantVelocityClass: binProduct.velocityClass,
        });
      }

      const bin = binMap.get(binCode)!;
      bin.products.push(binProduct);
      bin.totalStock += binProduct.stock;
    });
  }

  // 5. Update Statuses & Dominant Velocity for each Bin
  binMap.forEach(bin => {
    if (bin.totalStock <= 0) {
      bin.status = 'EMPTY_CRITICAL';
    } else if (bin.products.some(p => p.stock <= p.minStock)) {
      bin.status = 'LOW_STOCK';
    } else {
      bin.status = 'NORMAL';
    }

    if (bin.products.some(p => p.velocityClass === 'A')) bin.dominantVelocityClass = 'A';
    else if (bin.products.some(p => p.velocityClass === 'B')) bin.dominantVelocityClass = 'B';
    else if (bin.products.every(p => p.velocityClass === 'D')) bin.dominantVelocityClass = 'D';
    else bin.dominantVelocityClass = 'C';
  });

  // 6. Build Structured Zone -> Aisle -> Rack Hierarchy
  const zoneMap = new Map<string, Map<number, Map<number, WarehouseBin[]>>>();

  // Ensure default standard zones A, B, C exist
  const defaultZones = ['A', 'B', 'C'];
  defaultZones.forEach(z => {
    if (!zoneMap.has(z)) zoneMap.set(z, new Map());
  });

  binMap.forEach(bin => {
    const z = bin.zone;
    if (!zoneMap.has(z)) zoneMap.set(z, new Map());

    const aisleMap = zoneMap.get(z)!;
    if (!aisleMap.has(bin.aisle)) aisleMap.set(bin.aisle, new Map());

    const rackMap = aisleMap.get(bin.aisle)!;
    if (!rackMap.has(bin.rack)) rackMap.set(bin.rack, []);

    rackMap.get(bin.rack)!.push(bin);
  });

  const zones: WarehouseZone[] = [];
  let totalWarehouseStock = 0;

  zoneMap.forEach((aisleMap, zoneId) => {
    const aisles: WarehouseAisle[] = [];
    let zoneStock = 0;
    let zoneBinsCount = 0;
    let zoneOccupiedCount = 0;

    const aisleKeys = Array.from(aisleMap.keys()).sort((a, b) => a - b);
    if (aisleKeys.length === 0) aisleKeys.push(1, 2);

    aisleKeys.forEach(aisleNum => {
      const rackMap = aisleMap.get(aisleNum) || new Map<number, WarehouseBin[]>();
      const racks: WarehouseRack[] = [];
      let aisleStock = 0;

      const rackKeys = Array.from(rackMap.keys()).sort((a, b) => a - b);
      if (rackKeys.length === 0) rackKeys.push(1, 2, 3, 4);

      rackKeys.forEach(rackNum => {
        let bins = rackMap.get(rackNum) || [];
        if (bins.length === 0) {
          bins = [
            {
              binCode: `${zoneId}-${aisleNum.toString().padStart(2, '0')}-${rackNum.toString().padStart(2, '0')}`,
              zone: zoneId,
              aisle: aisleNum,
              rack: rackNum,
              shelf: 1,
              products: [],
              totalStock: 0,
              status: 'AVAILABLE_EMPTY',
              dominantVelocityClass: 'D',
            },
          ];
        }

        const rackStock = bins.reduce((sum, b) => sum + b.totalStock, 0);
        aisleStock += rackStock;
        zoneBinsCount += bins.length;
        if (rackStock > 0) zoneOccupiedCount += bins.length;

        let rackStatus: WarehouseRack['status'] = 'AVAILABLE_EMPTY';
        if (rackStock > 0) {
          rackStatus = bins.some(b => b.status === 'LOW_STOCK')
            ? 'LOW_STOCK'
            : bins.some(b => b.status === 'EMPTY_CRITICAL')
            ? 'EMPTY_CRITICAL'
            : 'NORMAL';
        }

        racks.push({
          rackNumber: rackNum,
          zone: zoneId,
          aisle: aisleNum,
          bins,
          totalStock: rackStock,
          status: rackStatus,
        });
      });

      zoneStock += aisleStock;
      aisles.push({
        aisleNumber: aisleNum,
        zone: zoneId,
        racks,
        totalStock: aisleStock,
      });
    });

    totalWarehouseStock += zoneStock;

    zones.push({
      zoneId,
      name: `โซน ${zoneId} (${zoneId === 'A' ? 'Fast-Moving' : zoneId === 'B' ? 'Standard' : 'Bulk / Reserve'})`,
      color: ZONE_COLORS[zoneId] || 'slate',
      aisles,
      totalStock: zoneStock,
      totalBins: zoneBinsCount,
      occupiedBins: zoneOccupiedCount,
    });
  });

  // Calculate Overall Stats
  const totalBins = Array.from(binMap.values()).length || zones.reduce((s, z) => s + z.totalBins, 0);
  const occupiedBins = Array.from(binMap.values()).filter(b => b.totalStock > 0).length;
  const lowStockBins = Array.from(binMap.values()).filter(b => b.status === 'LOW_STOCK').length;
  const outOfStockBins = Array.from(binMap.values()).filter(b => b.status === 'EMPTY_CRITICAL').length;

  const stats: WarehouseMapStats = {
    totalZones: zones.length,
    totalAisles: zones.reduce((s, z) => s + z.aisles.length, 0),
    totalRacks: zones.reduce((s, z) => s + z.aisles.reduce((as, a) => as + a.racks.length, 0), 0),
    totalBins,
    occupiedBins,
    emptyBins: totalBins - occupiedBins,
    occupancyRate: totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0,
    lowStockBins,
    outOfStockBins,
    unassignedProductsCount: unassignedProducts.length,
    totalWarehouseStock,
    totalProductsCount: products.length,
  };

  return { zones, unassignedProducts, stats };
}
