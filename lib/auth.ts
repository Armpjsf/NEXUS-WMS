import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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
            } as any;
          }
        } catch (e) {
          console.warn('[auth] Supabase verify failed, falling back to bootstrap accounts:', e);
        }

        // 2) Bootstrap fallback accounts (so you can never lock yourself out
        //    before any app_users rows exist).
        if ((u === "admin" || u === "admin@wms360.pro") && (p === "admin1234" || p === "admin" || p === "123456")) {
          return { id: "1", name: "Warehouse Admin", email: "admin@wms360.pro", role: "Admin", allowedBranches: ["*"], allowedOwners: ["*"] } as any;
        }
        if ((u === "staff" || u === "user") && (p === "123456" || p === "staff" || p === "user")) {
          return { id: "2", name: "Warehouse Staff", email: "staff@wms360.pro", role: "Staff", allowedBranches: ["*"], allowedOwners: ["*"] } as any;
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.orgId = (user as any).orgId || '00000000-0000-0000-0000-000000000001';
        token.allowedBranches = (user as any).allowedBranches;
        token.allowedOwners = (user as any).allowedOwners;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).orgId = token.orgId;
        (session.user as any).allowedBranches = token.allowedBranches;
        (session.user as any).allowedOwners = token.allowedOwners;
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
  secret: process.env.NEXTAUTH_SECRET || "wms360_secret_key_2026",
};