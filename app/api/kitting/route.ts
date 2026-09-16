import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initialBOMs, BillOfMaterials } from '@/lib/kittingEngine';

let memoryBoms = [...initialBOMs];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, boms: memoryBoms });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const newBom: BillOfMaterials = {
      id: `bom-${Date.now()}`,
      kitSku: body.kitSku,
      kitName: body.kitName,
      version: body.version || '1.0',
      assemblyLaborCost: Number(body.assemblyLaborCost) || 0,
      status: 'ACTIVE',
      components: body.components || []
    };
    memoryBoms.push(newBom);
    return NextResponse.json({ success: true, bom: newBom });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
