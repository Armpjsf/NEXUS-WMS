import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/data/wms';

export const dynamic = 'force-static';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 });
    }

    // Fetch all transactions
    // Note: getTransactions returns { date, sku, qty, docRef, ... }
    const [inbound, outbound] = await Promise.all([
        getTransactions('IN'),
        getTransactions('OUT')
    ]);

    // Filter and Standardize
    const movements = [
        ...inbound
            .filter((t: any) => t.product === sku)
            .map((t: any) => ({
                date: t.date,
                type: 'IN',
                qty: Number(t.qty) || 0,
                docRef: t.docRef,
                note: t.note || ''
            })),
        ...outbound
            .filter((t: any) => t.product === sku)
            .map((t: any) => ({
                date: t.date,
                type: 'OUT',
                qty: (Number(t.qty) || 0) * -1, // Negative for outbound
                docRef: t.docRef,
                note: t.note || ''
            }))
    ];

    // Sort by Date
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate Running Balance
    let currentBalance = 0;
    const history = movements.map(m => {
        currentBalance += m.qty;
        return {
            ...m,
            balance: currentBalance
        };
    });

    return NextResponse.json({ 
        sku, 
        currentStock: currentBalance, 
        history 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
