import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTransactions, type Transaction } from '@/lib/data/wms';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const allowedOwners = (session?.user as any)?.allowedOwners;

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const type = searchParams.get('type'); // 'IN', 'OUT', or 'ALL'
        const owner = searchParams.get('owner');
        const search = searchParams.get('search')?.toLowerCase();

        // 1. Fetch ALL transactions (Parallel) - Filtered by User's Allowed Owners
        const [inbound, outbound] = await Promise.all([
            getTransactions('IN', undefined, allowedOwners),
            getTransactions('OUT', undefined, allowedOwners)
        ]);

        // 2. Normalize and Combine
        // Add a 'type' field to identify source
        const allTransactions = [
            ...inbound.map(t => ({ ...t, type: 'IN' })),
            ...outbound.map(t => ({ ...t, type: 'OUT' }))
        ];

        // 3. Filter
        let filtered = allTransactions.filter(t => {
            // valid date check
            if (!t.date) return false;

            // Date Range Filter (Simple String Comparison YYYY-MM-DD or parse)
            // Assuming dates are YYYY-MM-DD or standard enough. 
            // If Google Sheets returns DD/MM/YYYY, we might need parsing. 
            // Let's assume standard format for now or just simple includes for partial matches if needed.
            // Better: Parse to timestamp for accurate comparison
            try {
                const tDate = new Date(t.date).getTime();
                if (startDate && tDate < new Date(startDate).getTime()) return false;
                if (endDate && tDate > new Date(endDate).getTime()) return false;
            } catch (e) {
                // Invalid date in row, maybe skip or include?
                // console.warn("Invalid date:", t.date);
            }

            // Type Filter
            if (type && type !== 'ALL' && t.type !== type) return false;

            // Search (Product Name, ID)
            if (search) {
                const searchContent = `${t.product || ''} ${t.sku || ''} ${t.docRef || ''}`.toLowerCase();
                if (!searchContent.includes(search)) return false;
            }

            return true;
        });

        // 4. Sort (Newest First)
        filtered.sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        // 5. Pagination (Optional, but good for large datasets)
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        
        const paginatedData = filtered.slice(offset, offset + limit);

        return NextResponse.json({
            data: paginatedData,
            meta: {
                total,
                page,
                limit,
                totalPages
            }
        });

    } catch (error: any) {
        console.error("Report API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Vercel: allow up to 60s (Hobby max) — this route does Sheets-heavy work.
export const maxDuration = 60;
