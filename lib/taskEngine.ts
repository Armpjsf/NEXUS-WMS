/**
 * Smart Task Queue, Interleaving & Auto-Replenishment Engine
 * WMS Smart Enterprise
 */

import { supabase } from '@/lib/supabase';
import { nextDocNumber } from './docNumber';

export interface WarehouseTask {
  id: string;
  taskNumber: string;
  taskType: 'PUTAWAY' | 'PICKING' | 'REPLENISHMENT' | 'CYCLE_COUNT' | 'TRANSFER';
  priority: number;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedUserId?: string;
  assignedUserName?: string;
  assignedEquipment?: string;
  sourceLocation: string;
  targetLocation: string;
  sku: string;
  productName: string;
  lotNumber?: string;
  requestedQty: number;
  completedQty: number;
  interleavingGroup?: string;
  createdAt: string;
}

/**
 * Generate a new warehouse task
 */
export async function createWarehouseTask(
  orgId: string,
  task: Omit<WarehouseTask, 'id' | 'taskNumber' | 'createdAt'>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const taskNumber = await nextDocNumber('TSK', { date: 'yyyymmdd', pad: 4, existing: { table: 'warehouse_tasks', column: 'task_number' } });

    const { data, error } = await supabase
      .from('warehouse_tasks')
      .insert({
        org_id: orgId,
        task_number: taskNumber,
        task_type: task.taskType,
        priority: task.priority || 3,
        status: task.status || 'PENDING',
        assigned_user_id: task.assignedUserId || null,
        assigned_user_name: task.assignedUserName || '',
        assigned_equipment: task.assignedEquipment || 'FORKLIFT',
        source_location: task.sourceLocation || '',
        target_location: task.targetLocation || '',
        sku: task.sku,
        product_name: task.productName || '',
        lot_number: task.lotNumber || '',
        requested_qty: task.requestedQty,
        completed_qty: task.completedQty || 0,
        interleaving_group: task.interleavingGroup || task.sourceLocation?.split('-')[0] || 'A',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Find interleaving task to prevent empty runs (reduce deadhead travel)
 */
export async function findInterleavingTask(
  orgId: string,
  currentAisle: string
): Promise<WarehouseTask | null> {
  try {
    const { data } = await supabase
      .from('warehouse_tasks')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'PENDING')
      .ilike('source_location', `${currentAisle}%`)
      .order('priority', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      taskNumber: data.task_number,
      taskType: data.task_type,
      priority: data.priority,
      status: data.status,
      sourceLocation: data.source_location,
      targetLocation: data.target_location,
      sku: data.sku,
      productName: data.product_name,
      lotNumber: data.lot_number,
      requestedQty: Number(data.requested_qty || 0),
      completedQty: Number(data.completed_qty || 0),
      createdAt: data.created_at
    };
  } catch (err) {
    return null;
  }
}