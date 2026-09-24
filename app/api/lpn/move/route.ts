import { NextResponse } from 'next/server';
import { moveLPN } from '@/lib/lpnEngine';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lpnNumber, newLocation, operator } = body;

    if (!lpnNumber || !newLocation) {
      return NextResponse.json({ error: 'กรุณาระบุหมายเลข LPN และพิกัดปลายทาง' }, { status: 400 });
    }

    const result = await moveLPN(lpnNumber, newLocation, operator);
    return NextResponse.json({
      success: true,
      message: `ย้ายพาเลท ${lpnNumber} ไปยัง ${newLocation} สำเร็จ`,
      data: result.lpn
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}