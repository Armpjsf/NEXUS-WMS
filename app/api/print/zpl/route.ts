import { NextResponse } from 'next/server';
import { generatePalletZpl, generateProductZpl } from '@/lib/hardware/zplGenerator';
import { errorMessage } from '@/lib/errors';

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
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}