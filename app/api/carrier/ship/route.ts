import { NextResponse } from 'next/server';
import { dispatchCarrierShipment, CarrierCode } from '@/lib/carrier/carrierGateway';
import { getCurrentOrgId } from '@/lib/orgContext';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const {
      orderId,
      orderNo,
      carrierCode = 'FLASH_EXPRESS',
      recipientName,
      recipientPhone,
      recipientAddress,
      packageWeightKg = 1.5,
      itemCount = 1,
      codAmount = 0
    } = body;

    const shipment = await dispatchCarrierShipment({
      orderId: orderId || orderNo || 'ORD-001',
      orderNo: orderNo || 'SO-2026-001',
      carrierCode: carrierCode as CarrierCode,
      recipientName: recipientName || 'คุณลูกค้า',
      recipientPhone: recipientPhone || '081-234-5678',
      recipientAddress: recipientAddress || 'กรุงเทพมหานคร',
      packageWeightKg,
      itemCount,
      codAmount
    });

    await recordEnterpriseAudit({
      orgId,
      action: 'UPDATE',
      entityName: 'carrier_shipments',
      entityId: shipment.trackingNumber,
      afterState: shipment as any,
      performedBy: 'TMS Gateway',
      reason: `Generated carrier AWB ${shipment.trackingNumber} via ${shipment.carrierName}`
    });

    return NextResponse.json({ success: true, data: shipment });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}