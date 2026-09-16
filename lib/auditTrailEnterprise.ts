/**
 * Enterprise Immutable Audit Trail (21 CFR Part 11 / ISO Compliance)
 * WMS Smart Enterprise
 */

import { supabase } from '@/lib/supabase';

export interface EnterpriseAuditEntry {
  orgId: string;
  entityName: string;
  entityId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'ADJUST' | 'ALLOCATE' | 'RELEASE' | 'RECEIVE' | 'SHIP';
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  reason?: string;
  performedBy: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordEnterpriseAudit(entry: EnterpriseAuditEntry): Promise<void> {
  try {
    await supabase.from('audit_trail_enterprise').insert({
      org_id: entry.orgId,
      entity_name: entry.entityName,
      entity_id: String(entry.entityId),
      action: entry.action,
      before_state: entry.beforeState || {},
      after_state: entry.afterState || {},
      reason: entry.reason || '',
      performed_by: entry.performedBy || 'system',
      user_email: entry.userEmail || '',
      ip_address: entry.ipAddress || '',
      user_agent: entry.userAgent || '',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Non-blocking logger
    console.error('Audit trail logging error:', err);
  }
}