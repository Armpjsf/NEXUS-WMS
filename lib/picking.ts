/**
 * Smart Picking & S-Shape Warehouse Routing Logic (WMS 360 PRO)
 * Zero-Cost algorithmic optimization for picker traveling distance reduction.
 */

import { planFefoAllocations, getExpiryRisk } from './fefo';

export interface ParsedLocation {
  zone: string;
  aisle: number;
  rack: number;
  shelf: number;
  bin: string;
  raw: string;
  isUnassigned: boolean;
}

export interface PickWaveItem {
  id: string;
  orderId?: string;
  orderDocNum?: string;
  customerName?: string;
  sku: string;
  productName: string;
  barcode?: string;
  requestedQty: number;
  pickedQty: number;
  location: string;
  parsedLocation: ParsedLocation;
  pickSequence: number;
  status: 'PENDING' | 'PICKED' | 'SHORTAGE';
  category?: string;
  unit?: string;
  notes?: string;
  // --- Strict FEFO Attributes ---
  lotNumber?: string;
  lotId?: string;
  expDate?: string;
  daysToExpiry?: number;
  expiryRisk?: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY';
  scannedLot?: string;
  isFefoLocked?: boolean;
}

export interface PickingWave {
  id: string;
  waveNumber: string;
  createdAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  pickerName?: string;
  items: PickWaveItem[];
  totalOrders: number;
  totalItems: number;
  totalQty: number;
  pickedQty: number;
  progressPercent: number;
}

/**
 * Parse location string formats such as:
 * - "A-01-02-1" (Zone A, Aisle 1, Rack 2, Shelf 1)
 * - "A-01-02"   (Zone A, Aisle 1, Rack 2)
 * - "A01-02"    (Zone A, Aisle 1, Rack 2)
 * - "Zone B-3"  (Zone B, Aisle 3)
 * - "RACK-12"
 */
export function parseLocation(locStr?: string | null): ParsedLocation {
  if (!locStr || typeof locStr !== 'string' || locStr.trim() === '' || locStr.toLowerCase() === 'unassigned') {
    return {
      zone: 'Z_OTHER',
      aisle: 999,
      rack: 999,
      shelf: 999,
      bin: '',
      raw: locStr || 'Unassigned',
      isUnassigned: true,
    };
  }

  const raw = locStr.trim().toUpperCase();

  // Pattern 1: Zone-Aisle-Rack-Shelf (e.g., A-01-02-B or A-1-2-1)
  const p1 = raw.match(/^([A-Z0-9]+)[-_/\s]+(\d+)[-_/\s]+(\d+)(?:[-_/\s]+([A-Z0-9]+))?/);
  if (p1) {
    return {
      zone: p1[1],
      aisle: parseInt(p1[2], 10) || 1,
      rack: parseInt(p1[3], 10) || 1,
      shelf: parseInt(p1[4], 10) || 1,
      bin: p1[4] || '',
      raw,
      isUnassigned: false,
    };
  }

  // Pattern 2: A01-02 or A01 (Letter + Numbers)
  const p2 = raw.match(/^([A-Z])(\d{1,2})(?:[-_/\s]+(\d+))?/);
  if (p2) {
    return {
      zone: p2[1],
      aisle: parseInt(p2[2], 10) || 1,
      rack: p2[3] ? parseInt(p2[3], 10) : 1,
      shelf: 1,
      bin: '',
      raw,
      isUnassigned: false,
    };
  }

  // Fallback: Extract first letter as Zone and any numbers
  const firstLetter = raw.match(/[A-Z]/)?.[0] || 'A';
  const numbers = raw.match(/\d+/g)?.map(n => parseInt(n, 10)) || [];

  return {
    zone: firstLetter,
    aisle: numbers[0] ?? 1,
    rack: numbers[1] ?? 1,
    shelf: numbers[2] ?? 1,
    bin: '',
    raw,
    isUnassigned: false,
  };
}

/**
 * S-Shape (Snake) Picking Route Optimizer
 *
 * Traversal Strategy:
 * 1. Sort by Zone (A -> B -> C ...)
 * 2. Group by Aisle within Zone
 * 3. If Aisle is ODD (1, 3, 5...), walk UP (Rack 1 -> Max)
 * 4. If Aisle is EVEN (2, 4, 6...), walk DOWN (Rack Max -> 1)
 * 5. This eliminates backtracking and gives the fastest warehouse pick time.
 */
export function calculateSShapePickPath<T extends { location?: string }>(
  items: T[]
): Array<T & { pickSequence: number; parsedLocation: ParsedLocation }> {
  if (!items || items.length === 0) return [];

  // Parse all locations
  const itemsWithLoc = items.map(item => ({
    item,
    parsed: parseLocation(item.location),
  }));

  // Separate assigned vs unassigned
  const assigned = itemsWithLoc.filter(x => !x.parsed.isUnassigned);
  const unassigned = itemsWithLoc.filter(x => x.parsed.isUnassigned);

  // Group assigned by Zone
  const zoneGroups = new Map<string, typeof assigned>();
  assigned.forEach(x => {
    const z = x.parsed.zone;
    if (!zoneGroups.has(z)) zoneGroups.set(z, []);
    zoneGroups.get(z)!.push(x);
  });

  const sortedResult: Array<T & { pickSequence: number; parsedLocation: ParsedLocation }> = [];
  let currentSeq = 1;

  // Sort zones alphabetically
  const sortedZones = Array.from(zoneGroups.keys()).sort((a, b) => a.localeCompare(b));

  for (const zone of sortedZones) {
    const zoneItems = zoneGroups.get(zone)!;

    // Group by Aisle
    const aisleGroups = new Map<number, typeof zoneItems>();
    zoneItems.forEach(x => {
      const a = x.parsed.aisle;
      if (!aisleGroups.has(a)) aisleGroups.set(a, []);
      aisleGroups.get(a)!.push(x);
    });

    const sortedAisles = Array.from(aisleGroups.keys()).sort((a, b) => a - b);

    for (const aisle of sortedAisles) {
      const aisleItems = aisleGroups.get(aisle)!;
      const isOddAisle = aisle % 2 !== 0;

      // S-Shape sorting:
      // Odd Aisle: Ascending Rack & Shelf (Walking Up)
      // Even Aisle: Descending Rack & Shelf (Walking Down)
      aisleItems.sort((a, b) => {
        if (isOddAisle) {
          if (a.parsed.rack !== b.parsed.rack) return a.parsed.rack - b.parsed.rack;
          return a.parsed.shelf - b.parsed.shelf;
        } else {
          if (a.parsed.rack !== b.parsed.rack) return b.parsed.rack - a.parsed.rack;
          return b.parsed.shelf - a.parsed.shelf;
        }
      });

      aisleItems.forEach(x => {
        sortedResult.push({
          ...x.item,
          pickSequence: currentSeq++,
          parsedLocation: x.parsed,
        });
      });
    }
  }

  // Append unassigned items at the end
  unassigned.forEach(x => {
    sortedResult.push({
      ...x.item,
      pickSequence: currentSeq++,
      parsedLocation: x.parsed,
    });
  });

  return sortedResult;
}

/**
 * Wave label for the current picking session (e.g. WAVE-20260820-143015).
 * Client-side and display-only (not persisted), so a Bangkok timestamp is
 * enough — unlike the old 3-digit random suffix it can't repeat within a day.
 */
export function generateWaveNumber(now: Date = new Date()): string {
  const bkk = new Date(now.getTime() + 7 * 3600_000).toISOString(); // UTC+7
  return `WAVE-${bkk.slice(0, 10).replace(/-/g, '')}-${bkk.slice(11, 19).replace(/:/g, '')}`;
}

/**
 * Calculate statistical progress for a wave
 */
export function calculateWaveStats(items: PickWaveItem[]) {
  const totalItems = items.length;
  const totalQty = items.reduce((sum, item) => sum + item.requestedQty, 0);
  const pickedQty = items.reduce((sum, item) => sum + (item.status === 'PICKED' ? item.pickedQty : 0), 0);
  const pickedItemsCount = items.filter(item => item.status === 'PICKED').length;
  const shortageCount = items.filter(item => item.status === 'SHORTAGE').length;
  const progressPercent = totalItems > 0 ? Math.round((pickedItemsCount / totalItems) * 100) : 0;

  return {
    totalItems,
    totalQty,
    pickedQty,
    pickedItemsCount,
    shortageCount,
    progressPercent,
    isCompleted: pickedItemsCount === totalItems && totalItems > 0,
  };
}

/**
 * Build strict FEFO Wave Items from raw order lines and available lot bins.
 * Items are split per lot according to expiration date (earliest first),
 * preventing picking of expired or newer lots.
 */

/**
 * Build strict FEFO Wave Items from raw order lines and available lot bins.
 * Items are split per lot according to expiration date (earliest first),
 * preventing picking of expired or newer lots.
 */
export function buildFefoPickWaveItems(
  rawLines: Array<{
    id: string;
    sku: string;
    productName: string;
    requestedQty: number;
    location?: string;
    barcode?: string;
    orderDocNum?: string;
    orderId?: string;
    customerName?: string;
    category?: string;
    unit?: string;
  }>,
  fefoBinsBySku: Record<string, Array<{
    lotId: string;
    lotNumber: string;
    expDate?: string;
    locationCode: string;
    qtyAvailable: number;
    status: string;
  }>>
): PickWaveItem[] {
  const expandedItems: any[] = [];

  for (const line of rawLines) {
    const availableLots = fefoBinsBySku[line.sku] || [];

    if (availableLots.length > 0) {
      const plan = planFefoAllocations(line.sku, line.requestedQty, availableLots);
      let subIdx = 1;

      for (const alloc of plan.allocations) {
        const { days, risk } = getExpiryRisk(alloc.expDate);
        expandedItems.push({
          id: `${line.id}-lot${subIdx++}`,
          sku: line.sku,
          productName: line.productName,
          barcode: line.barcode,
          requestedQty: alloc.allocatedQty,
          pickedQty: 0,
          location: alloc.locationCode || line.location || 'Unassigned',
          status: risk === 'EXPIRED' ? 'SHORTAGE' : 'PENDING',
          orderDocNum: line.orderDocNum,
          orderId: line.orderId,
          customerName: line.customerName,
          category: line.category,
          unit: line.unit,
          lotNumber: alloc.lotNumber,
          lotId: alloc.lotId,
          expDate: alloc.expDate,
          daysToExpiry: days,
          expiryRisk: risk,
          isFefoLocked: true,
        });
      }

      if (plan.shortageQty > 0) {
        expandedItems.push({
          id: `${line.id}-shortage`,
          sku: line.sku,
          productName: line.productName,
          barcode: line.barcode,
          requestedQty: plan.shortageQty,
          pickedQty: 0,
          location: line.location || 'Unassigned',
          status: 'SHORTAGE',
          orderDocNum: line.orderDocNum,
          orderId: line.orderId,
          customerName: line.customerName,
          category: line.category,
          unit: line.unit,
          notes: 'FEFO Shortage: ไม่พบล็อตที่ใช้งานได้เพียงพอ',
          isFefoLocked: true,
        });
      }
    } else {
      // No lots tracked for this SKU -> normal unlotted pick
      expandedItems.push({
        ...line,
        pickedQty: 0,
        location: line.location || 'Unassigned',
        status: 'PENDING',
        expiryRisk: 'HEALTHY',
        isFefoLocked: false,
      });
    }
  }

  // Run S-Shape warehouse routing on all items
  return calculateSShapePickPath(expandedItems) as PickWaveItem[];
}
