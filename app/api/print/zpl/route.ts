import { NextResponse } from 'next/server';
import { generatePalletZpl, generateProductZpl } from '@/lib/hardware/zplGenerator';
import { errorMessage } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type;
    const rawOpts = body?.options && typeof body.options === 'object' ? body.options : body;

    let zplCode = '';
    if (type === 'PALLET') {
      zplCode = generatePalletZpl({
        sscc: rawOpts?.sscc || '000000000000000000',
        sku: rawOpts?.sku || 'UNKNOWN-SKU',
        productName: rawOpts?.productName || rawOpts?.name || rawOpts?.sku || 'PRODUCT',
        lotNumber: rawOpts?.lotNumber || rawOpts?.lotNo || 'N/A',
        qty: Number(rawOpts?.qty ?? 1) || 0,
        uom: rawOpts?.uom || rawOpts?.unit || 'PCS',
        mfgDate: rawOpts?.mfgDate,
        expDate: rawOpts?.expDate,
        destinationDock: rawOpts?.destinationDock || 'BAY-01',
      });
    } else {
      zplCode = generateProductZpl({
        sku: rawOpts?.sku || 'UNKNOWN-SKU',
        productName: rawOpts?.productName || rawOpts?.name || rawOpts?.sku || 'PRODUCT',
        barcode: rawOpts?.barcode || rawOpts?.sku || 'UNKNOWN-SKU',
        price: rawOpts?.price != null ? Number(rawOpts.price) : undefined,
        lotNumber: rawOpts?.lotNumber || rawOpts?.lotNo,
        expDate: rawOpts?.expDate,
      });
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
