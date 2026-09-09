
import { NextResponse } from 'next/server';
import { getTransactions, getProducts } from '@/lib/data/wms';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(now);
        const thaiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

        const inTxs = await getTransactions('IN');
        const outTxs = await getTransactions('OUT');
        
        const todayIn = inTxs.filter(tx => tx.date === todayStr);
        const todayOut = outTxs.filter(tx => tx.date === todayStr);

        // Check raw samples
        const sampleIn = inTxs.slice(-5);
        const sampleOut = outTxs.slice(-5);

        return NextResponse.json({
            today: todayStr,
            serverTime: now.toISOString(),
            thaiTime: thaiTime.toISOString(),
            stats: {
                totalIn: inTxs.length,
                totalOut: outTxs.length,
                todayInCount: todayIn.length,
                todayOutCount: todayOut.length
            },
            samples: {
                in: sampleIn,
                out: sampleOut
            },
            todayTransactions: {
                in: todayIn,
                out: todayOut
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
