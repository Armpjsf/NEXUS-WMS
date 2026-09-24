import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getAuthSecret } from "./authSecret";

// Built-in bootstrap/dev accounts (see authorize below) have no app_users row,
// so a missing row must not revoke them.
const BOOTSTRAP_IDS = new Set(['1', '2', 'admin']);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const u = credentials.username.trim().toLowerCase();
        const p = credentials.password;

        // 1) Real users from Supabase (app_users)
        try {
          const { verifyUser } = await import('./users');
          const dbUser = await verifyUser(u, p);
          if (dbUser) {
            return {
              id: dbUser.id,
              name: dbUser.username,
              email: `${dbUser.username}@wms360.pro`,
              role: dbUser.role,
              orgId: dbUser.orgId || '00000000-0000-0000-0000-000000000001',
              allowedBranches: dbUser.allowedBranches || ['*'],
              allowedOwners: dbUser.allowedOwners || ['*'],
            };
          }
        } catch (e) {
          console.warn('[auth] Supabase verify failed, falling back to bootstrap accounts:', e);
        }

        // 2) Bootstrap fallback accounts (so you can never lock yourself out
        //    before any app_users rows exist).
        // B3: these are well-known default credentials — a security hole if left
        //     live in production. Enabled outside production, or in production
        //     ONLY when ENABLE_BOOTSTRAP_ADMIN=true. Once a real admin exists in
        //     app_users, leave the flag unset so these creds are rejected.
        const bootstrapAllowed =
          process.env.NODE_ENV !== 'production' || process.env.ENABLE_BOOTSTRAP_ADMIN === 'true';
        if (bootstrapAllowed) {
          if ((u === "admin" || u === "admin@wms360.pro") && (p === "admin1234" || p === "admin" || p === "123456")) {
            console.warn('[auth] bootstrap admin login used — create a real app_users admin and unset ENABLE_BOOTSTRAP_ADMIN');
            return { id: "1", name: "Warehouse Admin", email: "admin@wms360.pro", role: "Admin", allowedBranches: ["*"], allowedOwners: ["*"] };
          }
          if ((u === "staff" || u === "user") && (p === "123456" || p === "staff" || p === "user")) {
            return { id: "2", name: "Warehouse Staff", email: "staff@wms360.pro", role: "Staff", allowedBranches: ["*"], allowedOwners: ["*"] };
          }
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.orgId = user.orgId || '00000000-0000-0000-0000-000000000001';
        token.homeOrgId = token.orgId;
        token.allowedBranches = user.allowedBranches;
        token.allowedOwners = user.allowedOwners;
        token.roleSyncedAt = Date.now();
      } else if (trigger === 'update' && token.uid && session?.switchOrgId) {
        // Org switch (useSession().update({ switchOrgId })). Only to an org the
        // user really belongs to; role/branches come from that membership.
        const { getOrgAccess } = await import('./memberships');
        const access = await getOrgAccess(token.uid, String(session.switchOrgId)).catch(() => null);
        if (access) {
          token.orgId = access.orgId;
          token.role = access.role;
          token.allowedBranches = access.allowedBranches;
          token.roleSyncedAt = Date.now();
        }
      } else if (token.uid) {
        // Re-sync role/permissions from DB so an admin's change in user
        // settings takes effect without forcing the user to re-login.
        // Throttled to at most once every 30s to avoid a DB hit per request.
        const last = token.roleSyncedAt || 0;
        if (Date.now() - last > 30_000) {
          try {
            const { getUserById } = await import('./users');
            const fresh = await getUserById(token.uid);
            const home = fresh?.orgId || token.homeOrgId;
            if (fresh && token.orgId && token.orgId !== home) {
              // Working in another org: re-check that membership (it may have
              // been removed or its role changed); fall back to the home org.
              const { getOrgAccess } = await import('./memberships');
              const access = await getOrgAccess(token.uid, token.orgId);
              if (access) {
                token.role = access.role;
                token.allowedBranches = access.allowedBranches;
              } else {
                token.orgId = home;
                token.role = fresh.role;
                token.allowedBranches = fresh.allowedBranches || ['*'];
              }
              token.allowedOwners = fresh.allowedOwners || ['*'];
              token.revoked = fresh.status !== 'Active';
            } else if (fresh) {
              token.role = fresh.role;
              token.allowedBranches = fresh.allowedBranches || ['*'];
              token.allowedOwners = fresh.allowedOwners || ['*'];
              // A deactivated account loses access on its next request
              // instead of keeping a valid session until the JWT expires.
              token.revoked = fresh.status !== 'Active';
            } else if (!BOOTSTRAP_IDS.has(token.uid)) {
              token.revoked = true; // deleted from app_users
            }
          } catch (e) {
            // DB unreachable: keep the current token (don't lock everyone out).
            console.warn('[auth] role re-sync failed:', e);
          }
          token.roleSyncedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.uid;
        session.user.username = session.user.name || undefined;
        session.user.role = token.role;
        session.user.orgId = token.orgId;
        session.user.allowedBranches = token.allowedBranches;
        session.user.allowedOwners = token.allowedOwners;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
  },
  secret: getAuthSecret(),
};