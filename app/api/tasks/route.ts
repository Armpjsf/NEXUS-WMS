import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';
import { createWarehouseTask } from '@/lib/taskEngine';
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

    // Handle Complete Task
    if (action === 'COMPLETE' && taskId) {
      const { data, error } = await supabase
        .from('warehouse_tasks')
        .update({
          status: 'COMPLETED',
          completed_qty: Number(completedQty || 0),
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('org_id', orgId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, data });
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