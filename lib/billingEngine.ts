/**
 * 3PL Multi-Tenant Client & Automated Billing Engine
 * Calculates Storage Fee (CBM/Pallet days) and Fulfillment / Handling Fees.
 */

export interface ThirdPartyClient {
  id: string;
  clientCode: string;
  clientName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  storageRatePerCbmDay: number;
  storageRatePerPalletDay: number;
  pickFeeBase: number;
  pickFeePerItem: number;
  packMaterialFee: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface BillingPeriodCalculation {
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  // Storage Metrics
  occupiedCbm: number;
  totalCbmDays: number;
  storageAmount: number;
  // Fulfillment Metrics
  totalOrdersFulfilled: number;
  totalItemsPicked: number;
  baseOrderFee: number;
  itemPickFee: number;
  packingMaterialsAmount: number;
  fulfillmentTotal: number;
  // Summary
  subtotal: number;
  taxAmount: number; // 7% VAT
  grandTotal: number;
}

// In-memory fallback clients for demonstration & immediate testing
export const initial3PlClients: ThirdPartyClient[] = [];

export function calculateClientBilling(
  client: ThirdPartyClient,
  params: {
    periodStart: string;
    periodEnd: string;
    daysCount?: number;
    avgOccupiedCbm?: number;
    ordersCount?: number;
    itemsCount?: number;
  }
): BillingPeriodCalculation {
  const days = params.daysCount || 30;
  const cbm = params.avgOccupiedCbm || 45.5; // 45.5 ลูกบาศก์เมตร
  const orders = params.ordersCount || 320;
  const items = params.itemsCount || 980;

  const totalCbmDays = cbm * days;
  const storageAmount = Math.round(totalCbmDays * client.storageRatePerCbmDay * 100) / 100;

  const baseOrderFee = Math.round(orders * client.pickFeeBase * 100) / 100;
  const itemPickFee = Math.round(items * client.pickFeePerItem * 100) / 100;
  const packingMaterialsAmount = Math.round(orders * client.packMaterialFee * 100) / 100;
  const fulfillmentTotal = Math.round((baseOrderFee + itemPickFee + packingMaterialsAmount) * 100) / 100;

  const subtotal = Math.round((storageAmount + fulfillmentTotal) * 100) / 100;
  const taxAmount = Math.round(subtotal * 0.07 * 100) / 100; // VAT 7%
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  return {
    clientId: client.id,
    clientName: client.clientName,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    totalDays: days,
    occupiedCbm: cbm,
    totalCbmDays,
    storageAmount,
    totalOrdersFulfilled: orders,
    totalItemsPicked: items,
    baseOrderFee,
    itemPickFee,
    packingMaterialsAmount,
    fulfillmentTotal,
    subtotal,
    taxAmount,
    grandTotal
  };
}
