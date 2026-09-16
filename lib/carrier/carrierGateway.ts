/**
 * Carrier & TMS Shipping Gateway (Thailand Logistics)
 * WMS Smart Enterprise - Phase 2
 */

export type CarrierCode = 'FLASH_EXPRESS' | 'KERRY_EXPRESS' | 'JT_EXPRESS' | 'THAILAND_POST_EMS';

export interface CarrierShipmentRequest {
  orderId: string;
  orderNo: string;
  carrierCode: CarrierCode;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  packageWeightKg?: number;
  itemCount: number;
  codAmount?: number;
}

export interface CarrierShipmentResult {
  trackingNumber: string;
  carrierCode: CarrierCode;
  carrierName: string;
  awbUrl: string;
  shippingFee: number;
  serviceType: string;
  estimatedDeliveryDays: string;
  awbLabelPayload: {
    orderNo: string;
    trackingNumber: string;
    barcodeData: string;
    carrierName: string;
    sender: { name: string; phone: string; address: string };
    recipient: { name: string; phone: string; address: string };
    cod: number;
    weightKg: number;
  };
}

export function generateTrackingNumber(carrier: CarrierCode): string {
  const randDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

  switch (carrier) {
    case 'FLASH_EXPRESS':
      return `TH${randDigits(10)}F`;
    case 'KERRY_EXPRESS':
      return `KER${randDigits(9)}`;
    case 'JT_EXPRESS':
      return `888${randDigits(9)}`;
    case 'THAILAND_POST_EMS':
      return `ED${randDigits(8)}TH`;
    default:
      return `TRK-${randDigits(10)}`;
  }
}

export async function dispatchCarrierShipment(req: CarrierShipmentRequest): Promise<CarrierShipmentResult> {
  const trackingNumber = generateTrackingNumber(req.carrierCode);
  const weight = req.packageWeightKg || 1.5;

  let carrierName = 'Flash Express';
  let baseRate = 35;
  let deliveryDays = '1-2 วันทำการ';

  if (req.carrierCode === 'KERRY_EXPRESS') {
    carrierName = 'Kerry Express (KEX)';
    baseRate = 45;
    deliveryDays = '1 วันทำการ';
  } else if (req.carrierCode === 'JT_EXPRESS') {
    carrierName = 'J&T Express';
    baseRate = 32;
    deliveryDays = '1-2 วันทำการ';
  } else if (req.carrierCode === 'THAILAND_POST_EMS') {
    carrierName = 'ไปรษณีย์ไทย (EMS Express)';
    baseRate = 40;
    deliveryDays = '1-2 วันทำการ';
  }

  const shippingFee = baseRate + Math.max(0, Math.ceil(weight - 1) * 15);

  return {
    trackingNumber,
    carrierCode: req.carrierCode,
    carrierName,
    awbUrl: `/api/carrier/label?trk=${trackingNumber}`,
    shippingFee,
    serviceType: 'Next Day Express Standard',
    estimatedDeliveryDays: deliveryDays,
    awbLabelPayload: {
      orderNo: req.orderNo,
      trackingNumber,
      barcodeData: trackingNumber,
      carrierName,
      sender: {
        name: 'NEXUS WMS Central Logistics Fulfillment',
        phone: '02-888-9999',
        address: '888 ศูนย์กระจายสินค้าภาคใต้ ถ.สุราษฎร์-พุนพิน สุราษฎร์ธานี 84130'
      },
      recipient: {
        name: req.recipientName,
        phone: req.recipientPhone,
        address: req.recipientAddress
      },
      cod: req.codAmount || 0,
      weightKg: weight
    }
  };
}
