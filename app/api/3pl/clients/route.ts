import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initial3PlClients, ThirdPartyClient } from '@/lib/billingEngine';

let memoryClients = [...initial3PlClients];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, clients: memoryClients });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const newClient: ThirdPartyClient = {
      id: `cli-${Date.now()}`,
      clientCode: body.clientCode || `CLI-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: body.clientName,
      contactPerson: body.contactPerson || '',
      email: body.email || '',
      phone: body.phone || '',
      storageRatePerCbmDay: Number(body.storageRatePerCbmDay) || 15,
      storageRatePerPalletDay: Number(body.storageRatePerPalletDay) || 25,
      pickFeeBase: Number(body.pickFeeBase) || 12,
      pickFeePerItem: Number(body.pickFeePerItem) || 3.5,
      packMaterialFee: Number(body.packMaterialFee) || 10,
      status: 'ACTIVE'
    };
    memoryClients.push(newClient);
    return NextResponse.json({ success: true, client: newClient });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
