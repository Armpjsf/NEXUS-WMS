import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/lib/data/wms';
import { allocateFIFO, FIFOAllocation, AllocationMethod } from '@/lib/fifo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fifo/preview
 * Preview which inbound batches will be used for an outbound order.
 * 
 * Body: { sku: string, qty: number, method?: 'FIFO' | 'FEFO' }
 * Response: { allocations: FIFOAllocation[], totalInbound: number, totalOutbound: number }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sku, qty, method = 'FIFO' } = body;

        if (!sku || !qty) {
            return NextResponse.json({ error: 'Missing sku or qty' }, { status: 400 });
        }

        // Fetch all transactions for this SKU
        const [inbound, outbound] = await Promise.all([
            getTransactions('IN'),
            getTransactions('OUT')
        ]);

        // Filter by SKU
        const skuNorm = sku.toString().trim().toLowerCase();
        const skuInbound = inbound.filter(t => 
            (t.product || t.sku)?.toString().trim().toLowerCase() === skuNorm
        );
        const skuOutbound = outbound.filter(t => 
            (t.product || t.sku)?.toString().trim().toLowerCase() === skuNorm
        );

        const totalInbound = skuInbound.reduce((sum, t) => sum + (t.qty || 0), 0);
        const totalOutbound = skuOutbound.reduce((sum, t) => sum + (t.qty || 0), 0);

        // Allocate using specified method
        const allocations = allocateFIFO(Number(qty), skuInbound, totalOutbound, method as AllocationMethod);

        // Generate message based on method
        const methodLabel = method === 'FEFO' ? 'วันหมดอายุ' : 'วันที่รับ';
        const message = allocations.length > 0 
            ? `${method}: จะดึงจาก ${allocations.map(a => 
                `${a.qtyFromLayer} ชิ้น (${a.expiryDate ? `หมดอายุ ${a.expiryDate}` : `รับ ${a.date}`}, ${a.daysOld} วัน)`
              ).join(', ')}`
            : 'ไม่มีสต๊อคเพียงพอ';

        return NextResponse.json({
            sku,
            requestedQty: qty,
            method,
            allocations,
            totalInbound,
            totalOutbound,
            currentStock: totalInbound - totalOutbound,
            message
        });

    } catch (error: any) {
        console.error('FIFO Preview Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

