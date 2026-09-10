import { NextResponse } from 'next/server';
import { getTransfers, createTransfer, updateTransferStatus } from '@/lib/data/transfers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const transfers = await getTransfers();
    return NextResponse.json({ transfers });
  } catch (error: any) {
    console.error('API transfers GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.fromBranchId || !body.toBranchId) {
      return NextResponse.json({ error: 'กรุณาระบุสาขาต้นทางและสาขาปลายทาง' }, { status: 400 });
    }
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400 });
    }

    const transfer = await createTransfer(body);
    return NextResponse.json({ success: true, transfer });
  } catch (error: any) {
    console.error('API transfers POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing transfer id or status' }, { status: 400 });
    }

    const updated = await updateTransferStatus(id, status);
    return NextResponse.json({ success: true, transfer: updated });
  } catch (error: any) {
    console.error('API transfers PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
