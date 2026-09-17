
import { NextResponse } from 'next/server';
import { getProductsUncached, getTransactionsUncached } from '@/lib/data/wms';
import { performABCAnalysis } from '@/lib/slotting';
import { getCurrentOrgId } from '@/lib/orgContext';
import { createWarehouseTask } from '@/lib/taskEngine';
import { binMove } from '@/lib/stockLocations';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [products, outbound] = await Promise.all([
        getProductsUncached(),
        getTransactionsUncached('OUT')
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
      // 2. Direct relocate approved by supervisor
      await binMove(orgId, sku, sourceLocation || 'Unassigned', targetLocation, Number(qty || 1)).catch(() => null);
      
      await getServiceSupabase()
        .from('products')
        .update({ location: targetLocation })
        .eq('org_id', orgId)
        .eq('sku', sku);

      return NextResponse.json({
        success: true,
        mode: 'DIRECT',
        message: `อนุมัติและปรับพิกัดสินค้า ${sku} เป็น ${targetLocation} ในระบบเรียบร้อยแล้ว`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error executing slotting action:', error);
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}

export const maxDuration = 60;

