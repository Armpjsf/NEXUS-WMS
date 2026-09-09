import { NextResponse } from 'next/server';
import { getTransactionsUncached } from '@/lib/data/wms';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // Fetch Both IN and OUT from Supabase
        const [inbound, outbound] = await Promise.all([
            getTransactionsUncached('IN'),
            getTransactionsUncached('OUT')
        ]);

        // Tag them
        const taggedIn = inbound.map(t => ({ ...t, type: 'IN' }));
        const taggedOut = outbound.map(t => ({ ...t, type: 'OUT' }));

        // Combine & Sort
        const all = [...taggedIn, ...taggedOut].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Generate CSV
        const BOM = "\uFEFF";
        const header = "Date,Type,Product,Quantity\n";
        const rows = all.map(t => 
            `"${t.date}","${t.type}","${(t.product || '').replace(/"/g, '""')}",${t.qty}`
        ).join("\n");

        const csv = BOM + header + rows;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="stock_movement_report_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });

    } catch (error) {
        console.error("Report generation error:", error);
        return new NextResponse("Failed to generate report", { status: 500 });
    }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
