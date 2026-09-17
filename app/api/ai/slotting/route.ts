
import { NextResponse } from 'next/server';
import { getProductsUncached } from '@/lib/data/wms';
import { performABCAnalysis } from '@/lib/slotting';
import { getCurrentOrgId } from '@/lib/orgContext';
import { createWarehouseTask } from '@/lib/taskEngine';
import { binMove, binMoveAll } from '@/lib/stockLocations';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Velocity must reflect RECENT pick activity, not the oldest 1000 rows.
// getTransactions() orders created_at ASC with no range (Supabase caps at 1000),
// so ABC velocity would analyse ancient history once the ledger grows past 1k.
// Fetch OUT movements from the last 90 days, newest-first, in pages.
const SLOTTING_WINDOW_DAYS = 90;
const PAGE = 1000;

async function getRecentOutbound(orgId: string): Promise<any[]> {
  const admin = getServiceSupabase();
  const since = new Date(Date.now() - SLOTTING_WINDOW_DAYS * 864e5).toISOString();
  const rows: any[] = [];
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await admin
      .from('stock_transactions')
      .select('sku, product_name, qty, type, created_at')
      .eq('org_id', orgId).eq('type', 'OUT').gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) break;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function GET() {
  try {
    const orgId = await getCurrentOrgId();
    const [products, outbound] = await Promise.all([
        getProductsUncached(),
        getRecentOutbound(orgId)
    ]);

    const summary = performABCAnalysis(products, outbound);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error in Slotting Analysis:', error);
    return NextResponse.json({ error: 'Failed to analyze slotting' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { action, sku, productName, sourceLocation, targetLocation, qty } = body;

    if (!sku || !targetLocation) {
      return NextResponse.json({ error: 'Missing required parameters (sku, targetLocation)' }, { status: 400 });
    }

    if (action === 'DISPATCH_TASK') {
      // 1. Create task for floor operator on mobile PDA
      const taskResult = await createWarehouseTask(orgId, {
        taskType: 'TRANSFER',
        priority: 2,
        status: 'PENDING',
        sourceLocation: sourceLocation || 'Unassigned',
        targetLocation,
        sku,
        productName: productName || sku,
        requestedQty: Number(qty || 1),
        completedQty: 0,
      });

      if (!taskResult.success) {
        return NextResponse.json({ error: taskResult.error || 'Failed to create task' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        mode: 'TASK',
        message: `สร้างใบงานย้ายพิกัด ${sku} ไปยัง ${targetLocation} ส่งเข้าเครื่อง PDA พนักงานเรียบร้อยแล้ว`,
        task: taskResult.data,
      });
    }

    if (action === 'DIRECT_APPLY') {
      // 2. Direct relocate approved by supervisor.
      // Move the WHOLE quantity in the source bin by default (slotting relocates
      // the product, not one unit). binMove reconciles products.stock AND
      // products.location itself, so we must NOT override location afterwards —
      // that previously left location pointing at the target while most stock
      // stayed in the source bin.
      const from = sourceLocation || 'Unassigned';
      const moveQty = qty != null ? Number(qty) : null;
      const result = moveQty != null
        ? await binMove(orgId, sku, from, targetLocation, moveQty).catch(() => null)
        : await binMoveAll(orgId, sku, from, targetLocation).catch(() => null);
      const moved = result?.moved ?? 0;

      return NextResponse.json({
        success: true,
        mode: 'DIRECT',
        moved,
        message: moved > 0
          ? `อนุมัติและย้ายสินค้า ${sku} จำนวน ${moved} จาก ${from} → ${targetLocation} เรียบร้อยแล้ว`
          : `ไม่พบสต็อกของ ${sku} ที่พิกัด ${from} จึงไม่มีการย้าย (ตรวจสอบพิกัดต้นทาง)`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error executing slotting action:', error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}

export const maxDuration = 60;

