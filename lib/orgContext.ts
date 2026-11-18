// Server-side helper: which organization is the current request scoped to?
// Tenancy is enforced in the app layer (the server uses the service-role key,
// which bypasses RLS), so every tenant query filters by this org id.

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

/**
 * Strictly resolves the authenticated organization ID from the session.
 * Rejects unauthenticated, revoked, or org-less sessions instead of falling back to DEFAULT_ORG.
 */
export async function requireCurrentOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { orgId?: string; revoked?: boolean } | undefined;
  if (!user || user.revoked || !user.orgId) {
    throw new Error('Unauthorized: Authenticated organization context is required');
  }
  return user.orgId;
}

export async function getCurrentOrgId(options?: { allowDefaultInDev?: boolean }): Promise<string> {
  const strict =
    process.env.STRICT_TENANT_CONTEXT === 'true' ||
    options?.allowDefaultInDev === false;

  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { orgId?: string; revoked?: boolean } | undefined;
    if (user?.revoked) {
      if (strict) throw new Error('Forbidden: Session has been revoked');
      throw new Error('Forbidden: Session has been revoked');
    }
    const orgId = user?.orgId;
    if (orgId) return orgId;
  } catch (err) {
    if (strict) throw err;
  }

  if (strict) {
    throw new Error('Unauthorized: Organization context is required');
  }
  return DEFAULT_ORG;
}
