// Multi-org membership (server only).
//
// A user's HOME org is app_users.org_id (with app_users.role). They can also be
// a member of other orgs through org_memberships (sql/20260925), each with its
// own role. The session's orgId/role are always one of these — switching is
// validated here, never trusted from the client.
import { getServiceSupabase } from './supabase';
import { DEFAULT_ORG } from './orgContext';

export interface OrgAccess {
  orgId: string;
  orgName: string;
  role: string;
  allowedBranches: string[];
  home: boolean;
}

function branches(v: unknown): string[] {
  return Array.isArray(v) && v.length ? (v as string[]) : ['*'];
}

/** Every org the user can work in (home first). Empty for bootstrap accounts. */
export async function listUserOrgs(userId: string): Promise<OrgAccess[]> {
  const admin = getServiceSupabase();
  // org-scope-ok: the signed-in user's own row
  const { data: me } = await admin.from('app_users')
    .select('org_id, role, allowed_branches, status').eq('id', userId).maybeSingle();
  if (!me || me.status !== 'Active') return [];

  const out: OrgAccess[] = [{
    orgId: me.org_id || DEFAULT_ORG, orgName: '', role: me.role || 'Staff',
    allowedBranches: branches(me.allowed_branches), home: true,
  }];
  // org-scope-ok: the user's memberships across orgs (the point of this table)
  const { data: rows, error } = await admin.from('org_memberships')
    .select('org_id, role, allowed_branches').eq('user_id', userId);
  if (!error) {
    for (const r of rows || []) {
      if (r.org_id === out[0].orgId) continue;
      out.push({ orgId: r.org_id, orgName: '', role: r.role || 'Staff', allowedBranches: branches(r.allowed_branches), home: false });
    }
  }

  const { data: orgs } = await admin.from('organizations').select('id, name, status')
    .in('id', out.map(o => o.orgId));
  const byId = new Map((orgs || []).map(o => [o.id, o]));
  return out
    .filter(o => (byId.get(o.orgId)?.status || 'ACTIVE') !== 'SUSPENDED')
    .map(o => ({ ...o, orgName: byId.get(o.orgId)?.name || o.orgId }));
}

/** The user's access in one org, or null if they have none. */
export async function getOrgAccess(userId: string, orgId: string): Promise<OrgAccess | null> {
  const all = await listUserOrgs(userId);
  return all.find(o => o.orgId === orgId) || null;
}
