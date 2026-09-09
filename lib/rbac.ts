// Central RBAC helpers — the single source of truth for "who can access what".
// Used by middleware (page-route guard), API route guards, and the nav
// components so the rules never drift apart.

import { ROLE_DEFINITIONS } from './users';

export const MANAGEMENT_ROLES = ['Super Admin', 'Admin', 'Manager'] as const;

export function isManagementRole(role?: string | null): boolean {
  return !!role && (MANAGEMENT_ROLES as readonly string[]).includes(role);
}

// Routes that must be restricted to management roles. Everything under /admin
// is management-only EXCEPT /admin/customers (a sales screen surfaced in the
// "การขาย & ออเดอร์" menu for all staff). /ai-reorder is admin-only too.
export function isManagementOnlyPath(pathname: string): boolean {
  if (pathname === '/admin/customers' || pathname.startsWith('/admin/customers/')) {
    return false;
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  if (pathname === '/ai-reorder' || pathname.startsWith('/ai-reorder/')) return true;
  return false;
}

// Map a URL path to a logical "section" used by ROLE_DEFINITIONS.allowedSections.
export function sectionForPath(pathname: string): string | null {
  const p = pathname.replace(/^\/mobile/, '') || '/';
  if (p === '/' || p === '/mobile' || p === '/dashboard' || p === '/home') return 'home';
  if (p.startsWith('/receiving') || p.startsWith('/ops/receiving') || p.startsWith('/ops/inbound')) return 'inbound';
  if (p.startsWith('/picking') || p.startsWith('/ops/wave-picking')) return 'picking';
  if (p.startsWith('/ops/orders') || p.startsWith('/orders')) return 'orders';
  if (p.startsWith('/ops/dispatch') || p.startsWith('/jobs')) return 'dispatch';
  if (p.startsWith('/cycle-count') || p.startsWith('/ops/cycle-count')) return 'cycle-count';
  if (p.startsWith('/inventory') || p.startsWith('/stock-card')) return 'inventory';
  if (p.startsWith('/analytics') || p.startsWith('/hq')) return 'analytics';
  return null;
}

// Does this role have access to a given logical section? '*' means all.
export function canAccessSection(role: string | undefined | null, section: string | null): boolean {
  if (!role) return false;
  if (isManagementRole(role)) return true;
  const meta = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS['Staff'];
  const allowed = meta.allowedSections || [];
  if (allowed.includes('*')) return true;
  if (!section) return true; // unknown/neutral section — don't block
  return allowed.includes(section);
}
