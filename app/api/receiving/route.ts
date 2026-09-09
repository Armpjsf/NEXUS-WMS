import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listReceipts, getReceipt, createReceipt, commitReceipt, cancelReceipt } from '@/lib/data/receipts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const receipt = await getReceipt(id);
      if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(receipt);
    }
    const status = searchParams.get('status') || undefined;
    const receipts = await listReceipts({ status });
    return NextResponse.json({ receipts });
  } catch (error: any) {
    console.error('API receiving GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400 });
    }
    // @ts-ignore
    const session = await getServerSession(authOptions);
    const receipt = await createReceipt({ ...body, createdBy: session?.user?.name || session?.user?.email || 'System' });
    if (!receipt) return NextResponse.json({ error: 'สร้างใบรับเข้าไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, receipt });
  } catch (error: any) {
    console.error('API receiving POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Commit received qty + putaway (increments stock + logs IN).
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, lines } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (action === 'cancel') {
      const ok = await cancelReceipt(id);
      return ok ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'ยกเลิกไม่สำเร็จ' }, { status: 500 });
    }

    if (!Array.isArray(lines)) return NextResponse.json({ error: 'Missing lines' }, { status: 400 });
    const receipt = await commitReceipt(id, lines);
    if (!receipt) return NextResponse.json({ error: 'ยืนยันรับเข้าไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, receipt });
  } catch (error: any) {
    console.error('API receiving PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
