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

  const count = await countResource(orgId, resource, table);

  if (count >= limit) {
    const labels: Record<string, string> = { products: 'สินค้า (SKU)', users: 'ผู้ใช้', branches: 'สาขา' };
    return `แพ็กเกจปัจจุบันจำกัด ${labels[resource]} ได้ ${limit} รายการ — อัปเกรดแพ็กเกจเพื่อเพิ่ม`;
  }
  return null;
}

/**
 * How many of a resource an org uses:
 *  - users    = home users (app_users) + members added from other orgs
 *  - branches = active branches only (DELETE soft-deactivates; those used to
 *               keep counting against the limit)
 */
async function countResource(orgId: string, resource: keyof PlanLimits, table: string): Promise<number> {
  const admin = getServiceSupabase();
  let q = admin.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId);
  if (resource === 'branches') q = q.neq('status', 'INACTIVE');
  const { count } = await q;
  let total = count || 0;
  if (resource === 'users') {
    const { count: members, error } = await admin.from('org_memberships')
      .select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    if (!error) total += members || 0; // table exists once sql/20260925 has run
  }
  return total;
}

export interface PlanUsage {
  plan: string;
  limits: PlanLimits;
  usage: PlanLimits;
}

/** Current usage vs limits, for the org settings page. */
export async function getPlanUsage(orgId: string): Promise<PlanUsage> {
  const plan = await orgPlan(orgId);
  const [products, users, branches] = await Promise.all([
    countResource(orgId, 'products', 'products'),
    countResource(orgId, 'users', 'app_users'),
    countResource(orgId, 'branches', 'branches'),
  ]);
  return { plan, limits: getPlanLimits(plan), usage: { products, users, branches } };
}
