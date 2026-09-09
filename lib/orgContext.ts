// Server-side helper: which organization is the current request scoped to?
// Tenancy is enforced in the app layer (the server uses the service-role key,
// which bypasses RLS), so every tenant query filters by this org id.

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

export async function getCurrentOrgId(): Promise<string> {
  try {
    // @ts-ignore - custom fields added in auth callbacks
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as any)?.orgId;
    return orgId || DEFAULT_ORG;
  } catch {
    return DEFAULT_ORG;
  }
}
