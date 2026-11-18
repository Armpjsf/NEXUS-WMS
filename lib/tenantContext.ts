import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getOrgAccess } from '@/lib/memberships';

export class TenantContextError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403 = 401) {
    super(message);
    this.name = 'TenantContextError';
    this.status = status;
  }
}

export interface TrustedTenantContext {
  readonly tenantId: string;
  readonly orgId: string;
  readonly userId: string;
  readonly role: string;
  readonly allowedBranches: readonly string[];
  readonly allowedOwners: readonly string[];
  readonly isPlatformAdmin?: boolean;
}

const BOOTSTRAP_IDS = new Set(['1', '2', 'admin']);

export async function requireTenantContext(): Promise<TrustedTenantContext> {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | {
        id?: string;
        role?: string;
        orgId?: string;
        allowedBranches?: string[];
        allowedOwners?: string[];
        revoked?: boolean;
        isPlatformAdmin?: boolean;
      }
    | undefined;

  if (!user || !user.id) {
    throw new TenantContextError('Unauthorized: Authentication required', 401);
  }

  if (user.revoked) {
    throw new TenantContextError('Forbidden: User access has been revoked', 403);
  }

  const orgId = typeof user.orgId === 'string' ? user.orgId.trim() : '';
  if (!orgId) {
    throw new TenantContextError('Forbidden: Organization context is missing', 403);
  }

  let role = user.role || 'Staff';
  let allowedBranches = Array.isArray(user.allowedBranches) && user.allowedBranches.length > 0
    ? user.allowedBranches
    : ['*'];

  // Verify active org membership for real DB users
  if (!BOOTSTRAP_IDS.has(String(user.id))) {
    const access = await getOrgAccess(String(user.id), orgId);
    if (!access) {
      throw new TenantContextError('Forbidden: Active organization membership required', 403);
    }
    role = access.role || role;
    allowedBranches = access.allowedBranches?.length ? access.allowedBranches : allowedBranches;
  }

  const allowedOwners = Array.isArray(user.allowedOwners) && user.allowedOwners.length > 0
    ? user.allowedOwners
    : ['*'];

  return Object.freeze({
    tenantId: orgId,
    orgId,
    userId: String(user.id),
    role,
    allowedBranches: Object.freeze([...allowedBranches]),
    allowedOwners: Object.freeze([...allowedOwners]),
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
  });
}
