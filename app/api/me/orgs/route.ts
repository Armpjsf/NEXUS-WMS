import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { listUserOrgs } from '@/lib/memberships';

export const dynamic = 'force-dynamic';

// Orgs the signed-in user can switch to (home org first) + the current one.
export async function GET() {
  const guard = await requireAuth();
  if (guard.error) return guard.error;
  const orgs = guard.user.id ? await listUserOrgs(guard.user.id).catch(() => []) : [];
  return NextResponse.json({ currentOrgId: guard.user.orgId, orgs });
}
