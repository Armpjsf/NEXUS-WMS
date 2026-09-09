// Per-plan resource limits (SaaS packaging). Enforced on create.

import { getServiceSupabase } from '@/lib/supabase';

export type PlanLimits = { products: number; users: number; branches: number };

// -1 = unlimited
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE: { products: 50, users: 2, branches: 1 },
  PRO: { products: 1000, users: 10, branches: 5 },
  ENTERPRISE: { products: -1, users: -1, branches: -1 },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan || 'FREE').toUpperCase()] || PLAN_LIMITS.FREE;
}

async function orgPlan(orgId: string): Promise<string> {
  const { data } = await getServiceSupabase().from('organizations').select('plan').eq('id', orgId).maybeSingle();
  return data?.plan || 'FREE';
}

/**
 * Returns an error message if creating another `resource` would exceed the org's
 * plan limit, or null if it's allowed. `table` is the Supabase table to count.
 */
export async function checkPlanLimit(
  orgId: string,
  resource: keyof PlanLimits,
  table: string,
): Promise<string | null> {
  const limits = getPlanLimits(await orgPlan(orgId));
  const limit = limits[resource];
  if (limit < 0) return null; // unlimited

  const { count } = await getServiceSupabase()
    .from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId);

  if ((count || 0) >= limit) {
    const labels: Record<string, string> = { products: 'สินค้า (SKU)', users: 'ผู้ใช้', branches: 'สาขา' };
    return `แพ็กเกจปัจจุบันจำกัด ${labels[resource]} ได้ ${limit} รายการ — อัปเกรดแพ็กเกจเพื่อเพิ่ม`;
  }
  return null;
}
