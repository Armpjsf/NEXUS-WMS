import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { fetchAllRows } from '@/lib/data/fetchAll';
import { getProducts, type Product, type Transaction } from '@/lib/data/wms';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const allowedOwners = session?.user?.allowedOwners;

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const type = searchParams.get('type'); // 'IN', 'OUT', or 'ALL'
        const owner = searchParams.get('owner');
        const search = searchParams.get('search')?.toLowerCase();

        const orgId = await getCurrentOrgId();

        // Pre-parse date boundaries once and push down .gte / .lte to Supabase
        const startIso = startDate ? new Date(startDate).toISOString() : null;
        const endIso = endDate
            ? new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`).toISOString()
            : null;
        const startMs = startDate ? new Date(startDate).getTime() : null;
        const endMs = endDate
            ? new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`).getTime()
            : null;

        // Fetch products and filtered transactions in parallel
        const [products, rawRows] = await Promise.all([
            getProducts(undefined, allowedOwners),
            fetchAllRows((f, t) => {
                let q = supabase
                    .from('stock_transactions')
                    .select('*')
                    .eq('org_id', orgId)
                    .order('created_at', { ascending: false })
                    .range(f, t);

                if (type && type !== 'ALL') {
                    q = q.eq('type', type);
                } else {
                    q = q.in('type', ['IN', 'OUT']);
                }
                if (startIso) q = q.gte('created_at', startIso);
                if (endIso) q = q.lte('created_at', endIso);
                return q;
            }),
        ]);

        // Pre-index products in a Map by lowercase SKU and product name (O(P) instead of O(P*T) .find())
        const productMap = new Map<string, Product>();
        for (const p of products) {
            if (p.id) productMap.set(String(p.id).trim().toLowerCase(), p);
            if (p.name) productMap.set(p.name.trim().toLowerCase(), p);
        }

        const allowSet =
            allowedOwners && allowedOwners.length > 0 && !allowedOwners.includes('*')
                ? new Set(allowedOwners.map((o: string) => o.toLowerCase().trim()))
                : null;
        const ownerFilter = owner && owner !== 'ALL' ? owner.toLowerCase().trim() : null;

        const filtered: Transaction[] = [];

        for (const r of rawRows || []) {
            if (!r.created_at) continue;
            const ts = new Date(r.created_at).getTime();
            if (startMs !== null && ts < startMs) continue;
            if (endMs !== null && ts > endMs) continue;

            const skuStr = String(r.sku || '').trim();
            const prodNameStr = String(r.product_name || skuStr).trim();
            const matchedProduct =
                productMap.get(skuStr.toLowerCase()) || productMap.get(prodNameStr.toLowerCase());

            const txOwner = String(r.owner || matchedProduct?.owner || '').trim();
            if (allowSet && !allowSet.has(txOwner.toLowerCase())) continue;
            if (ownerFilter && txOwner.toLowerCase() !== ownerFilter) continue;

            if (search) {
                const searchContent = `${prodNameStr} ${skuStr} ${r.doc_ref || ''}`.toLowerCase();
                if (!searchContent.includes(search)) continue;
            }

            filtered.push({
                date: r.created_at,
                type: r.type,
                sku: skuStr,
                product: prodNameStr,
                qty: Number(r.qty ?? 0),
                price: Number(r.unit_price ?? matchedProduct?.price ?? 0),
                docRef: r.doc_ref || '',
                timestamp: ts,
                batch: r.batch_no || '',
                expiryDate: r.expiry_date || '',
                owner: txOwner,
            });
        }

        // Sort newest first using precomputed numeric timestamp
        filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Pagination
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
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
                totalPages,
            },
        });
    } catch (error) {
        console.error('Report API Error:', error);
        return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
    }
}

export const maxDuration = 60;
