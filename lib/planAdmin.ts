// Who may change an organization's subscription plan. The plan gates SKU /
// user / branch limits (lib/planLimits.ts), so a tenant must not be able to
// upgrade itself. Only platform operators may:
//  - usernames listed in PLATFORM_ADMIN_USERNAMES (comma-separated), or
//  - when that env is unset, a Super Admin of the platform's own default org.
import { DEFAULT_ORG } from './orgContext';

export interface PlanActor {
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  orgId?: string;
}

export function canEditPlan(user: PlanActor | null | undefined, allowList = process.env.PLATFORM_ADMIN_USERNAMES): boolean {
  if (!user) return false;
  const allow = (allowList || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length) {
    const who = String(user.username || user.name || user.email || '').toLowerCase();
    return allow.includes(who);
  }
  return user.role === 'Super Admin' && (user.orgId || DEFAULT_ORG) === DEFAULT_ORG;
}
