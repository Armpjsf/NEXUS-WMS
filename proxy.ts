import { withAuth } from "next-auth/middleware"
import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MANAGEMENT_ROLES, isManagementOnlyPath } from "./lib/rbac"

// Must match the secret used in authOptions (same fallback) so getToken can
// decode the session cookie even when NEXTAUTH_SECRET is unset — otherwise
// every logged-in request looks unauthenticated (pages loop to /login, APIs 401).
const AUTH_SECRET = process.env.NEXTAUTH_SECRET || "wms360_secret_key_2026"

// Page guard (redirects to /login).
const pageAuth = withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function proxy(req) {
    // Custom Logic if needed
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // 1. Require Token for protected routes
        if (!token) return false;

        const path = req.nextUrl.pathname;
        const role = token.role as string;

        // 2. Role-based Access Control (RBAC)
        if (role === 'Viewer') {
           // Read-only: can only view dashboard, inventory, and reports
           if (path.startsWith('/ops') ||
               path.startsWith('/admin') ||
               path.startsWith('/ai-reorder') ||
               path.startsWith('/barcode')) {
               return false;
           }
        }

        // 3. Management-only areas (all of /admin/** except /admin/customers,
        //    plus /ai-reorder) are restricted to Super Admin / Admin / Manager.
        //    This closes the gap where non-management staff could open
        //    /admin/organization, /admin/branches, /admin/rules, etc. directly.
        if (isManagementOnlyPath(path) &&
            !(MANAGEMENT_ROLES as readonly string[]).includes(role)) {
            return false;
        }

        // 4. Even within management, only Super Admin / Admin manage user
        //    credentials and billing (Manager is excluded).
        if (role === 'Manager') {
            if (path.startsWith('/admin/users') ||
                path.startsWith('/admin/billing')) {
                return false;
            }
        }

        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
    secret: AUTH_SECRET,
  }
)

// API guard (returns 401 JSON instead of redirecting). Closes the gap where
// 57 of 66 /api routes were callable without a session.
// Public exceptions:
//  - /api/auth/* — NextAuth's own endpoints (login must work logged-out)
//  - /api/cron/* — protected by their own CRON_SECRET bearer check
export default async function proxy(req: NextRequest, event: any) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    // Public: NextAuth, cron (own secret), and self-service onboarding (signup).
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/cron') || pathname.startsWith('/api/onboarding')) {
      return NextResponse.next();
    }
    // Let CORS preflights through; the actual request still gets checked.
    if (req.method === 'OPTIONS') {
      return NextResponse.next();
    }
    const token = await getToken({ req, secret: AUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return (pageAuth as any)(req, event);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/inventory/:path*",
    "/ops/:path*",
    "/stock-card/:path*",
    "/po-log/:path*",
    "/orders/:path*",
    "/mobile/:path*",
    "/admin/:path*",
    "/ai-reorder/:path*",
    "/hq/:path*",
    "/integrations/:path*",
    "/barcode/:path*",
    "/damage/:path*",
    "/analytics/:path*",
    "/api/:path*",
  ],
}
