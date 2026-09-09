// Audit Trail Utility for WMS 360
// Logs user actions for tracking changes (Persistent via Supabase)

import { getServiceSupabase } from './supabase';

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT';
  module: string; 
  recordId?: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
}

// Log an action (Async)
export async function logAction(params: {
  userId: string;
  userName: string;
  action: AuditLog['action'];
  module: string;
  recordId?: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}) {
  const timestamp = new Date().toISOString();

  const entry = {
    ts: timestamp,
    user_id: params.userId,
    user_name: params.userName,
    action: params.action,
    module: params.module,
    record_id: params.recordId || '',
    description: params.description,
    old_values: params.oldValues || null,
    new_values: params.newValues || null,
    ip_address: '',
  };

  try {
    const { error } = await getServiceSupabase().from('audit_log').insert(entry);
    if (error) console.warn('[Audit] insert failed:', error.message);
  } catch (e) {
    console.warn('[Audit] insert exception:', e);
  }

  console.log('[Audit]', params.action, params.module, params.description);
  return entry;
}

// Get audit logs (Async)
export async function getAuditLogs(params?: {
  module?: string;
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  let query = getServiceSupabase()
    .from('audit_log')
    .select('*')
    .order('ts', { ascending: false })
    .limit(params?.limit || 100);

  if (params?.module) query = query.eq('module', params.module);
  if (params?.action) query = query.eq('action', params.action);
  if (params?.userId) query = query.eq('user_id', params.userId);

  const { data, error } = await query;
  if (error) {
    console.warn('[Audit] fetch failed:', error.message);
    return [];
  }

  // Map back to the camelCase shape the UI expects
  return (data || []).map((r: any) => ({
    id: r.id,
    timestamp: r.ts,
    userId: r.user_id,
    userName: r.user_name,
    action: r.action,
    module: r.module,
    recordId: r.record_id,
    description: r.description,
    oldValues: r.old_values,
    newValues: r.new_values,
    ipAddress: r.ip_address,
  }));
}

// Clear all logs (Not implemented for Sheets yet)
export function clearAuditLogs() {
  // no-op
}

// Get action color
export function getActionColor(action: AuditLog['action']): string {
  switch (action) {
    case 'CREATE': return 'bg-emerald-100 text-emerald-700';
    case 'UPDATE': return 'bg-blue-100 text-blue-700';
    case 'DELETE': return 'bg-rose-100 text-rose-700';
    case 'VIEW': return 'bg-slate-100 text-slate-700';
    case 'EXPORT': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

// Format timestamp
export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
