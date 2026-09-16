import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initial3PlClients, calculateClientBilling } from '@/lib/billingEngine';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const clientId = body.clientId;
    const client = initial3PlClients.find(c => c.id === clientId) || {
      id: clientId || 'cli-custom',
      clientCode: 'CLI-CUSTOM',
      clientName: body.clientName || 'ผู้ว่าจ้างทั่วไป',
      storageRatePerCbmDay: Number(body.storageRatePerCbmDay) || 15,
      storageRatePerPalletDay: Number(body.storageRatePerPalletDay) || 25,
      pickFeeBase: Number(body.pickFeeBase) || 12,
      pickFeePerItem: Number(body.pickFeePerItem) || 3.5,
      packMaterialFee: Number(body.packMaterialFee) || 10,
      status: 'ACTIVE' as const
    };

    const calculation = calculateClientBilling(client, {
      periodStart: body.periodStart || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      periodEnd: body.periodEnd || new Date().toISOString().slice(0, 10),
      daysCount: body.daysCount || 30,
      avgOccupiedCbm: body.avgOccupiedCbm || 42.0,
      ordersCount: body.ordersCount || 280,
      itemsCount: body.itemsCount || 850
    });

    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    return NextResponse.json({
      success: true,
      invoiceNumber,
      calculation
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
