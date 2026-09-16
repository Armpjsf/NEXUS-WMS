/**
 * FEFO (First-Expired, First-Out) Engine & Lot Traceability
 * WMS Smart Enterprise Core Engine
 */

export interface ProductLot {
  id: string;
  sku: string;
  lotNumber: string;
  batchNumber?: string;
  mfgDate?: string;
  expDate?: string;
  status: 'ACTIVE' | 'QUARANTINE' | 'HOLD' | 'EXPIRED';
  receivedQty: number;
  currentQty: number;
  unitCost?: number;
  notes?: string;
  daysToExpiry?: number;
  expiryRisk?: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY';
}

export interface FefoAllocationItem {
  lotId: string;
  lotNumber: string;
  expDate?: string;
  locationCode: string;
  allocatedQty: number;
  availableQty: number;
}

export interface FefoPlan {
  sku: string;
  requestedQty: number;
  fulfilledQty: number;
  shortageQty: number;
  allocations: FefoAllocationItem[];
  isFullyFulfilled: boolean;
}

/**
 * Categorize lot expiration risk
 */
export function getExpiryRisk(expDateStr?: string | null): {
  days: number;
  risk: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'HEALTHY';
} {
  if (!expDateStr) return { days: 9999, risk: 'HEALTHY' };
  const exp = new Date(expDateStr);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days <= 0) return { days, risk: 'EXPIRED' };
  if (days <= 30) return { days, risk: 'CRITICAL' };
  if (days <= 90) return { days, risk: 'WARNING' };
  return { days, risk: 'HEALTHY' };
}

/**
 * Plan picking allocations adhering strictly to FEFO.
 * Lots expiring earliest are consumed first.
 */
export function planFefoAllocations(
  sku: string,
  requestedQty: number,
  availableLotsWithBins: Array<{
    lotId: string;
    lotNumber: string;
    expDate?: string;
    locationCode: string;
    qtyAvailable: number;
    status: string;
  }>
): FefoPlan {
  // 1. Filter out quarantined, hold, or already expired lots
  const viable = availableLotsWithBins.filter(item => {
    if (item.status && item.status !== 'ACTIVE') return false;
    if (item.qtyAvailable <= 0) return false;
    if (item.expDate) {
      const { risk } = getExpiryRisk(item.expDate);
      if (risk === 'EXPIRED') return false;
    }
    return true;
  });

  // 2. Sort by ExpDate ASC (closest to expiry first). If no expDate, sort by lotNumber
  viable.sort((a, b) => {
    if (!a.expDate && !b.expDate) return 0;
    if (!a.expDate) return 1;
    if (!b.expDate) return -1;
    return new Date(a.expDate).getTime() - new Date(b.expDate).getTime();
  });

  let remaining = requestedQty;
  const allocations: FefoAllocationItem[] = [];

  for (const item of viable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, item.qtyAvailable);
    allocations.push({
      lotId: item.lotId,
      lotNumber: item.lotNumber,
      expDate: item.expDate,
      locationCode: item.locationCode,
      allocatedQty: take,
      availableQty: item.qtyAvailable
    });
    remaining -= take;
  }

  const fulfilledQty = requestedQty - remaining;
  return {
    sku,
    requestedQty,
    fulfilledQty,
    shortageQty: remaining,
    allocations,
    isFullyFulfilled: remaining === 0
  };
}