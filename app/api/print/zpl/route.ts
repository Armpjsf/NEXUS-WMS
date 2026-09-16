import { NextResponse } from 'next/server';
import { generatePalletZpl, generateProductZpl } from '@/lib/hardware/zplGenerator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, options } = body;

    let zplCode = '';
    if (type === 'PALLET') {
      zplCode = generatePalletZpl(options);
    } else {
      zplCode = generateProductZpl(options);
    }

    return NextResponse.json({
      success: true,
      zpl: zplCode,
      instructions: 'Send this RAW payload to port 9100 of any Zebra/TSC industrial network printer.'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}