import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { createWarehouseTask, updateTaskStatus } from '@/lib/taskEngine';
import { errorMessage } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const taskType = searchParams.get('type') || undefined;

    let query = supabase
      .from('warehouse_tasks')
      .select('*')
      .eq('org_id', orgId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (taskType) query = query.eq('task_type', taskType);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const body = await request.json();
    const { action, taskId, completedQty, ...taskData } = body;

    // Handle Complete Task (moves bin stock for PUTAWAY / REPLENISHMENT / TRANSFER)
    if (action === 'COMPLETE' && taskId) {
      const result = await updateTaskStatus(orgId, taskId, 'COMPLETED', completedQty);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: result.data, moved: result.moved });
    }

    // Otherwise create task
    const result = await createWarehouseTask(orgId, taskData);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
