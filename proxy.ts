import { withAuth } from "next-auth/middleware"
import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { MANAGEMENT_ROLES, isManagementOnlyPath, isManagementRole, canAccessSection, sectionForPath, isManagementOnlyApiWrite } from "./lib/rbac"
import { rateLimitShared, clientIp } from "./lib/rateLimit"

import { getAuthSecret } from "./lib/authSecret"

// Must match the secret used in authOptions so getToken can decode the session
// cookie. undefined = production without NEXTAUTH_SECRET → proxy fails closed.
const AUTH_SECRET = getAuthSecret()

// Page guard (redirects to /login).
const pageAuth = withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function proxy(req) {
    // Custom Logic if needed
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // 1. Require Token for protected routes (and not revoked: the user was
        //    deleted/disabled after signing in)
        if (!token || token.revoked) return false;

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

  if (!AUTH_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: NEXTAUTH_SECRET is not set' },
      { status: 503 },
    );
  }

  if (pathname.startsWith('/api/')) {
    // B3: brute-force guard on the credentials login — 10 attempts / minute / IP.
    if (pathname.startsWith('/api/auth/callback/credentials') && req.method === 'POST') {
      const r = await rateLimitShared(`login:${clientIp(req)}`, 10, 60_000);
      if (!r.ok) {
        return NextResponse.json(
          { error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
          { status: 429, headers: { 'retry-after': String(Math.ceil(r.retryAfterMs / 1000)) } },
        );
      }
    }
    // Public self-signup creates an org + admin + seed data — cap it per IP.
    if (pathname.startsWith('/api/onboarding') && req.method === 'POST') {
      const r = await rateLimitShared(`onboarding:${clientIp(req)}`, 5, 60 * 60_000);
      if (!r.ok) {
        return NextResponse.json(
          { error: 'สมัครใช้งานบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
          { status: 429, headers: { 'retry-after': String(Math.ceil(r.retryAfterMs / 1000)) } },
        );
      }
    }
    // Public: NextAuth, cron (own secret), self-service onboarding (signup), and ERP
    // endpoints (each /api/erp route authenticates via lib/erpAuth: session or x-api-key).
    // /api/wcs/callback is an external robotics webhook — it authenticates with
    // its own WCS_WEBHOOK_SECRET (no session), so it must bypass the session gate.
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/cron') || pathname.startsWith('/api/onboarding') || pathname.startsWith('/api/public') || pathname.startsWith('/api/erp') || pathname.startsWith('/api/wcs/callback') || pathname === '/api/health') {
      return NextResponse.next();
    }
    // Let CORS preflights through; the actual request still gets checked.
    if (req.method === 'OPTIONS') {
      return NextResponse.next();
    }
    const token = await getToken({ req, secret: AUTH_SECRET });
    if (!token || token.revoked) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // B3: management-only API surface (admin data-quality/rules/users) — a valid
    // session is not enough; the role must be management. Closes the gap where
    // any signed-in staff could call admin APIs directly.
    if (pathname.startsWith('/api/admin/') && !isManagementRole(token.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Writes to tenant settings / master data (org, branches, carriers, fleet,
    // suppliers) are management-only; reads stay open for floor screens.
    if (isManagementOnlyApiWrite(pathname, req.method) && !isManagementRole(token.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Section-based access for floor staff roles (Staff - Inbound/Outbound/Dispatch/…).
  // Management sees everything; Viewer is handled in pageAuth. A staff role that
  // opens a page outside its allowed sections (e.g. Staff - Inbound tapping the
  // cross-dock/dispatch tile) is sent back to the mobile home instead of the page.
  const token = await getToken({ req, secret: AUTH_SECRET });
  if (token) {
    const role = token.role as string;
    if (role && role !== 'Viewer' && !isManagementRole(role)) {
      const section = sectionForPath(pathname);
      if (!canAccessSection(role, section)) {
        return NextResponse.redirect(new URL('/mobile', req.url));
      }
    }
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
