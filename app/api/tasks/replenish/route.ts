import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { createWarehouseTask } from '@/lib/taskEngine';
import { errorMessage } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();

    // 1. Scan products where stock is below or near min_stock
    const { data: lowStockProducts, error } = await supabase
      .from('products')
      .select('*')
      .eq('org_id', orgId)
      .filter('stock', 'lte', 10)
      .limit(10);

    if (error || !lowStockProducts || lowStockProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No replenishment required. All active picking faces are adequately stocked.',
        createdTasksCount: 0
      });
    }

    let createdCount = 0;
    for (const prod of lowStockProducts) {
      const replenishmentQty = Math.max(20, Number(prod.min_stock || 10) * 2);
      await createWarehouseTask(orgId, {
        taskType: 'REPLENISHMENT',
        priority: 2, // High priority
        status: 'PENDING',
        sourceLocation: 'RESERVE-Z-01',
        targetLocation: prod.location || 'A-01-01',
        sku: prod.sku,
        productName: prod.name,
        requestedQty: replenishmentQty,
        completedQty: 0,
        assignedEquipment: 'FORKLIFT',
        interleavingGroup: (prod.location || 'A').split('-')[0]
      });
      createdCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${createdCount} automated replenishment tasks for active pick faces`,
      createdTasksCount: createdCount
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}