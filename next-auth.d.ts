// Custom fields NextAuth carries for NEXUS (set in lib/auth.ts callbacks), so
// callers can read session.user.role / orgId without `as any`.
import type { DefaultSession } from 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id?: string;
      username?: string;
      role?: string;
      orgId?: string;
      allowedBranches?: string[];
      allowedOwners?: string[];
    };
  }
  interface User {
    role?: string;
    orgId?: string;
    allowedBranches?: string[];
    allowedOwners?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: string;
    orgId?: string;
    allowedBranches?: string[];
    allowedOwners?: string[];
    roleSyncedAt?: number;
    /** app_users.org_id — the org the user signs in to (see lib/memberships). */
    homeOrgId?: string;
    /** Set when the user was deleted/disabled after login — proxy rejects it. */
    revoked?: boolean;
  }
}
