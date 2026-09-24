import { describe, it, expect, vi, afterEach } from 'vitest';

const session = vi.hoisted(() => ({ user: null as any }));
vi.mock('@/lib/apiAuth', () => ({ getSessionUser: async () => session.user }));

import { parseErpKeys, matchErpKey, resolveErpOrg } from '@/lib/erpAuth';
import { isManagementOnlyApiWrite, isManagementRole, canAccessSection, sectionForPath } from '@/lib/rbac';
import { canEditPlan } from '@/lib/planAdmin';
import { getAuthSecret } from '@/lib/authSecret';
import { DEFAULT_ORG } from '@/lib/orgContext';

const KEY_A = 'a'.repeat(32);
const KEY_B = 'b'.repeat(32);

afterEach(() => {
  session.user = null;
  vi.unstubAllEnvs();
});

describe('ERP API keys', () => {
  it('parses per-tenant and single keys, ignoring short/malformed ones', () => {
    const pairs = parseErpKeys(`${KEY_A}:org-a, short:org-x, nocolon`, KEY_B);
    expect(pairs).toEqual([[KEY_A, 'org-a'], [KEY_B, DEFAULT_ORG]]);
  });

  it('matches only an exact key', () => {
    const pairs = parseErpKeys(`${KEY_A}:org-a`, undefined);
    expect(matchErpKey(KEY_A, pairs)).toBe('org-a');
    expect(matchErpKey(KEY_A.slice(1), pairs)).toBeNull();
    expect(matchErpKey('', pairs)).toBeNull();
  });

  it('rejects an anonymous request with no key (was a public data leak)', async () => {
    vi.stubEnv('ERP_API_KEYS', `${KEY_A}:org-a`);
    const res = await resolveErpOrg(new Request('http://x/api/erp/inventory-sync'));
    expect(res.error?.status).toBe(401);
  });

  it('accepts x-api-key and Bearer, scoping to the key’s org', async () => {
    vi.stubEnv('ERP_API_KEYS', `${KEY_A}:org-a`);
    const viaHeader = await resolveErpOrg(new Request('http://x', { headers: { 'x-api-key': KEY_A } }));
    expect(viaHeader.orgId).toBe('org-a');
    const viaBearer = await resolveErpOrg(new Request('http://x', { headers: { authorization: `Bearer ${KEY_A}` } }));
    expect(viaBearer.orgId).toBe('org-a');
  });

  it('uses the session org for signed-in users', async () => {
    session.user = { role: 'Staff', orgId: 'org-s' };
    const res = await resolveErpOrg(new Request('http://x'));
    expect(res).toMatchObject({ orgId: 'org-s', via: 'session' });
  });
});

describe('management-only API writes', () => {
  it('guards writes to tenant settings but not reads', () => {
    expect(isManagementOnlyApiWrite('/api/org', 'PATCH')).toBe(true);
    expect(isManagementOnlyApiWrite('/api/branches', 'DELETE')).toBe(true);
    expect(isManagementOnlyApiWrite('/api/carriers/', 'POST')).toBe(true);
    expect(isManagementOnlyApiWrite('/api/org', 'GET')).toBe(false);
    // floor screens still write these
    expect(isManagementOnlyApiWrite('/api/carriers/rates', 'POST')).toBe(false);
    expect(isManagementOnlyApiWrite('/api/pickup-locations', 'POST')).toBe(false);
  });

  it('role helpers', () => {
    expect(isManagementRole('Manager')).toBe(true);
    expect(isManagementRole('Staff')).toBe(false);
    expect(sectionForPath('/mobile/receiving')).toBe('inbound');
    expect(canAccessSection('Admin', 'inventory-admin')).toBe(true);
  });
});

describe('plan changes', () => {
  it('only the platform operator can change a plan', () => {
    expect(canEditPlan({ role: 'Super Admin', orgId: DEFAULT_ORG }, '')).toBe(true);
    // a tenant's own Super Admin (created by onboarding) cannot self-upgrade
    expect(canEditPlan({ role: 'Super Admin', orgId: 'tenant-2' }, '')).toBe(false);
    expect(canEditPlan({ role: 'Admin', orgId: DEFAULT_ORG }, '')).toBe(false);
    expect(canEditPlan(null, '')).toBe(false);
  });
  it('honours PLATFORM_ADMIN_USERNAMES when set', () => {
    expect(canEditPlan({ username: 'Owner', role: 'Staff' }, 'owner, ops')).toBe(true);
    expect(canEditPlan({ username: 'x', role: 'Super Admin', orgId: DEFAULT_ORG }, 'owner')).toBe(false);
  });
});

describe('auth secret', () => {
  it('uses NEXTAUTH_SECRET when set', () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'real-secret');
    expect(getAuthSecret()).toBe('real-secret');
  });
  it('never falls back to a known string in a production runtime', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', '');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getAuthSecret()).toBeUndefined();
    err.mockRestore();
  });
  it('keeps a dev fallback outside production', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(getAuthSecret()).toBeTruthy();
  });
});
