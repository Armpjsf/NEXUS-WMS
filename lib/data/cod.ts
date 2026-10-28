import { listOrders, getOrder, updateOrder, OutboundOrder } from './orders';

export interface CodSettlement {
  settled: boolean;
  receiptNo?: string;
  expectedAmount: number;
  settledAmount: number;
  shortageAmount: number;
  shortageReason?: string;
  paymentChannel: 'CASH' | 'TRANSFER';
  transferRef?: string;
  settledAt?: string;
  settledBy?: string;
  notes?: string;
}

export interface CodOrderRecord {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  shipAddress: string;
  status: string;
  totalAmount: number;
  freightCost: number;
  expectedCod: number;
  driverName: string;
  vehiclePlate: string;
  vehicleType: string;
  dockBay: string;
  carrier: string;
  trackingNo: string;
  tripId: string;
  dropSeq: string;
  tmsJobId?: string;
  tmsStatus?: string;
  deliveredAt: string | null;
  shippedAt: string | null;
  podPhoto?: string;
  podSignature?: string;
  podNote?: string;
  settlement: CodSettlement;
}

export interface CodKpiSummary {
  pendingCount: number;
  pendingAmount: number;
  remittedTodayCount: number;
  remittedTodayAmount: number;
  totalShortageAmount: number;
  cashRemittedAmount: number;
  transferRemittedAmount: number;
}

export function extractTripMeta(notes: string): { tripId: string; dropSeq: string } {
  if (!notes) return { tripId: '', dropSeq: '' };
  const tm = notes.match(/\[Trip:\s*([^\]]+)\]/i);
  const dm = notes.match(/\[Drop:\s*([^\]]+)\]/i);
  return {
    tripId: tm ? tm[1].trim() : '',
    dropSeq: dm ? dm[1].trim() : '',
  };
}

export function parseCodSettlement(notes: string, totalAmount: number, freightCost: number): CodSettlement {
  const expected = (Number(totalAmount) || 0) + (Number(freightCost) || 0);
  if (!notes) {
    return {
      settled: false,
      expectedAmount: expected,
      settledAmount: 0,
      shortageAmount: 0,
      paymentChannel: 'CASH',
    };
  }

  // 1. Try structured comment <!--COD_SETTLED:{...}-->
  const m = notes.match(/<!--COD_SETTLED:([\s\S]*?)-->/);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      return {
        settled: true,
        receiptNo: data.receiptNo || '',
        expectedAmount: Number(data.expectedAmount ?? expected),
        settledAmount: Number(data.settledAmount ?? 0),
        shortageAmount: Number(data.shortageAmount ?? 0),
        shortageReason: data.shortageReason || '',
        paymentChannel: data.paymentChannel === 'TRANSFER' ? 'TRANSFER' : 'CASH',
        transferRef: data.transferRef || '',
        settledAt: data.settledAt || '',
        settledBy: data.settledBy || '',
        notes: data.notes || '',
      };
    } catch {}
  }

  // 2. Fallback to bracket tag [COD_SETTLED: ฿1,500.00 via CASH on 2026-10-28 by Name (REC-...)]
  const tagM = notes.match(/\[COD_SETTLED:\s*฿?([\d,.]+)\s*via\s*([A-Z]+)(?:.*?\(REC-([^)]+)\))?/i);
  if (tagM) {
    const amt = parseFloat(tagM[1].replace(/,/g, '')) || 0;
    const channel = tagM[2].toUpperCase() === 'TRANSFER' ? 'TRANSFER' : 'CASH';
    const rec = tagM[3] ? `REC-${tagM[3]}` : '';
    return {
      settled: true,
      receiptNo: rec,
      expectedAmount: expected,
      settledAmount: amt,
      shortageAmount: Math.max(0, expected - amt),
      paymentChannel: channel,
    };
  }

  return {
    settled: false,
    expectedAmount: expected,
    settledAmount: 0,
    shortageAmount: 0,
    paymentChannel: 'CASH',
  };
}

export function toCodOrderRecord(order: OutboundOrder): CodOrderRecord {
  const tripMeta = extractTripMeta(order.notes);
  const settlement = parseCodSettlement(order.notes, order.totalAmount, order.freightCost);
  const expectedCod = (Number(order.totalAmount) || 0) + (Number(order.freightCost) || 0);

  return {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    phone: order.phone,
    shipAddress: order.shipAddress,
    status: order.status,
    totalAmount: Number(order.totalAmount) || 0,
    freightCost: Number(order.freightCost) || 0,
    expectedCod,
    driverName: order.driverName || '',
    vehiclePlate: order.vehiclePlate || '',
    vehicleType: order.vehicleType || '',
    dockBay: order.dockBay || '',
    carrier: order.carrier || '',
    trackingNo: order.trackingNo || '',
    tripId: tripMeta.tripId,
    dropSeq: tripMeta.dropSeq,
    tmsJobId: order.tmsJobId,
    tmsStatus: order.tmsStatus,
    deliveredAt: order.deliveredAt,
    shippedAt: order.shippedAt,
    podPhoto: order.podPhoto,
    podSignature: order.podSignature,
    podNote: order.podNote,
    settlement,
  };
}

export async function listCodRecords(filters?: {
  status?: 'PENDING' | 'REMITTED' | 'ALL';
  driver?: string;
  tripId?: string;
  search?: string;
}): Promise<{ records: CodOrderRecord[]; kpi: CodKpiSummary }> {
  const allOrders = await listOrders();

  // Filter orders that require financial collection (totalAmount > 0 or freightCost > 0 or already has COD notes)
  const codEligible = allOrders.filter(o => {
    const hasValue = (Number(o.totalAmount) || 0) > 0 || (Number(o.freightCost) || 0) > 0;
    const hasCodNote = o.notes && /COD/i.test(o.notes);
    return hasValue || hasCodNote;
  });

  const records = codEligible.map(toCodOrderRecord);

  // Compute KPI across all records
  const todayStr = new Date().toISOString().slice(0, 10);
  let pendingCount = 0;
  let pendingAmount = 0;
  let remittedTodayCount = 0;
  let remittedTodayAmount = 0;
  let totalShortageAmount = 0;
  let cashRemittedAmount = 0;
  let transferRemittedAmount = 0;

  for (const r of records) {
    if (!r.settlement.settled) {
      pendingCount++;
      pendingAmount += r.expectedCod;
    } else {
      const settledDate = (r.settlement.settledAt || '').slice(0, 10);
      if (settledDate === todayStr || !settledDate) {
        remittedTodayCount++;
        remittedTodayAmount += r.settlement.settledAmount;
        totalShortageAmount += r.settlement.shortageAmount;
      }
      if (r.settlement.paymentChannel === 'CASH') {
        cashRemittedAmount += r.settlement.settledAmount;
      } else {
        transferRemittedAmount += r.settlement.settledAmount;
      }
    }
  }

  const kpi: CodKpiSummary = {
    pendingCount,
    pendingAmount,
    remittedTodayCount,
    remittedTodayAmount,
    totalShortageAmount,
    cashRemittedAmount,
    transferRemittedAmount,
  };

  // Apply filters
  let filtered = records;

  if (filters?.status === 'PENDING') {
    filtered = filtered.filter(r => !r.settlement.settled);
  } else if (filters?.status === 'REMITTED') {
    filtered = filtered.filter(r => r.settlement.settled);
  }

  if (filters?.driver) {
    const dLower = filters.driver.toLowerCase();
    filtered = filtered.filter(r => r.driverName.toLowerCase().includes(dLower));
  }

  if (filters?.tripId) {
    const tLower = filters.tripId.toLowerCase();
    filtered = filtered.filter(r => r.tripId.toLowerCase().includes(tLower));
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      r =>
        r.orderNo.toLowerCase().includes(s) ||
        r.customerName.toLowerCase().includes(s) ||
        r.vehiclePlate.toLowerCase().includes(s) ||
        r.driverName.toLowerCase().includes(s) ||
        r.tripId.toLowerCase().includes(s) ||
        (r.settlement.receiptNo && r.settlement.receiptNo.toLowerCase().includes(s))
    );
  }

  return { records: filtered, kpi };
}

export async function settleCodOrders(input: {
  orderIds: string[];
  settledAmount?: number;
  paymentChannel: 'CASH' | 'TRANSFER';
  transferRef?: string;
  shortageReason?: string;
  settledBy: string;
  markDelivered?: boolean;
}): Promise<{ receiptNo: string; settledCount: number; totalSettled: number }> {
  if (!input.orderIds || input.orderIds.length === 0) {
    throw new Error('กรุณาเลือกอย่างน้อย 1 ออเดอร์เพื่อรับเงินนำส่ง');
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const receiptNo = `REC-${dateStr}-${randomSuffix}`;
  const settledAt = new Date().toISOString();

  // Load orders
  const orders: OutboundOrder[] = [];
  for (const id of input.orderIds) {
    const o = await getOrder(id);
    if (o) orders.push(o);
  }

  if (orders.length === 0) {
    throw new Error('ไม่พบข้อมูลออเดอร์ที่เลือก');
  }

  const totalExpected = orders.reduce(
    (sum, o) => sum + ((Number(o.totalAmount) || 0) + (Number(o.freightCost) || 0)),
    0
  );

  const actualTotalSettled = input.settledAmount !== undefined ? Number(input.settledAmount) : totalExpected;
  const totalShortage = Math.max(0, totalExpected - actualTotalSettled);

  // Distribute settlement across orders
  let remainingSettled = actualTotalSettled;

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const orderExpected = (Number(o.totalAmount) || 0) + (Number(o.freightCost) || 0);

    let orderSettledAmt = orderExpected;
    if (i === orders.length - 1) {
      orderSettledAmt = remainingSettled;
    } else {
      orderSettledAmt = Math.min(orderExpected, remainingSettled);
      remainingSettled -= orderSettledAmt;
    }
    const orderShortage = Math.max(0, orderExpected - orderSettledAmt);

    const settlementPayload = {
      receiptNo,
      expectedAmount: orderExpected,
      settledAmount: orderSettledAmt,
      shortageAmount: orderShortage,
      shortageReason: input.shortageReason || '',
      paymentChannel: input.paymentChannel,
      transferRef: input.transferRef || '',
      settledAt,
      settledBy: input.settledBy,
    };

    // Clean previous settlement notes
    let notes = o.notes || '';
    notes = notes.replace(/<!--COD_SETTLED:[\s\S]*?-->/g, '').trim();
    notes = notes.replace(/\[COD_SETTLED:[^\]]+\]/g, '').trim();

    // Append new structured settlement metadata & human-readable note
    const channelLabel = input.paymentChannel === 'TRANSFER' ? 'TRANSFER (โอน/สแกน)' : 'CASH (เงินสด)';
    const refText = input.transferRef ? ` Ref:${input.transferRef}` : '';
    const shortageText = orderShortage > 0 ? ` [ค้างชำระ: ฿${orderShortage.toLocaleString()}]` : '';

    notes = `${notes} <!--COD_SETTLED:${JSON.stringify(settlementPayload)}-->\n[COD_SETTLED: ฿${orderSettledAmt.toLocaleString(
      undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )} via ${channelLabel}${refText} on ${settledAt.slice(0, 16).replace('T', ' ')} by ${input.settledBy} (${receiptNo})${shortageText}]`.trim();

    const patch: any = { notes };
    if (input.markDelivered && o.status === 'SHIPPED') {
      patch.status = 'DELIVERED';
    }

    await updateOrder(o.id, patch);
  }

  return {
    receiptNo,
    settledCount: orders.length,
    totalSettled: actualTotalSettled,
  };
}
