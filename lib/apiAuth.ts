// Server-side guards for API route handlers. Pages are covered by middleware,
// but API routes each enforce their own access here so a known endpoint can't
// be called directly by an under-privileged (or unauthenticated) client.
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from './auth';
import { isManagementRole } from './rbac';

export interface SessionUser {
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  orgId?: string;
  allowedBranches?: string[];
  allowedOwners?: string[];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser) || null;
}

type Guard = { user: SessionUser; error: null } | { user: null; error: NextResponse };

// Require any authenticated user.
export async function requireAuth(): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}

// Require a management role (Super Admin / Admin / Manager).
export async function requireManagement(): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isManagementRole(user.role)) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, error: null };
}
