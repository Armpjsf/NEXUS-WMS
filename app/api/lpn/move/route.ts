import { NextResponse } from 'next/server';
import { moveLPN } from '@/lib/lpnEngine';

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}