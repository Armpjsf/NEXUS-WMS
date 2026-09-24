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

// Master-data / tenant-settings APIs whose WRITES are management-only (reads stay
// open to staff: e.g. mobile dispatch lists carriers & fleet). Pages for these
// live under /admin, but the page guard alone left the API writable by any
// signed-in staff. /api/admin/** is guarded separately (all methods).
const MANAGEMENT_WRITE_APIS = ['/api/org', '/api/branches', '/api/carriers', '/api/fleet-vehicles', '/api/suppliers'];

export function isManagementOnlyApiWrite(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  const p = pathname.replace(/\/+$/, '');
  return MANAGEMENT_WRITE_APIS.includes(p);
}

// Map a URL path to a logical "section" used by ROLE_DEFINITIONS.allowedSections.
export function sectionForPath(pathname: string): string | null {
  const p = pathname.replace(/^\/mobile/, '') || '/';
  if (p === '/' || p === '/mobile' || p === '/dashboard' || p === '/home' || p.startsWith('/tasks')) return 'home';
  // รับเข้า/จัดการภายในคลัง: รับ PO, จัดเก็บขึ้นชั้น, รับคืน RMA, จัดการพาเลท LPN (ขนย้ายภายใน)
  if (p.startsWith('/receiving') || p.startsWith('/putaway') || p.startsWith('/returns') || p.startsWith('/lpn') || p.startsWith('/ops/receiving') || p.startsWith('/ops/inbound')) return 'inbound';
  // หยิบสินค้า: wave picking, voice picking, รวมชุด (kitting เป็นงานเตรียมของขาออก)
  if (p.startsWith('/picking') || p.startsWith('/wave-picking') || p.startsWith('/voice-picking') || p.startsWith('/kitting') || p.startsWith('/ops/wave-picking')) return 'picking';
  if (p.startsWith('/ops/orders') || p.startsWith('/orders')) return 'orders';
  // จัดส่ง/ขนส่ง: cross-dock (/mobile/dispatch), งานคนขับ /jobs, เบิกจ่ายออก, คิวเทียบท่า
  if (p.startsWith('/dispatch') || p.startsWith('/ops/dispatch') || p.startsWith('/jobs') || p.startsWith('/outbound') || p.startsWith('/dock')) return 'dispatch';
  // ตรวจนับ: cycle count + อนุมัติปรับยอด (checker)
  if (p.startsWith('/cycle-count') || p.startsWith('/adjustments') || p.startsWith('/ops/cycle-count')) return 'cycle-count';
  // งานสต็อกที่ sensitive — ทำบนคอมโดยแอดมินเท่านั้น: ปรับสต็อกด่วน, โอนข้ามสาขา
  // map เป็น section ที่ไม่มี role staff ใดถือ → เห็นเฉพาะ management (canAccessSection short-circuit)
  if (p.startsWith('/adjust') || p.startsWith('/transfers')) return 'inventory-admin';
  // สต็อกทั่วไปที่ staff ใช้ได้: ดูสต็อก + แจ้งชำรุด
  if (p.startsWith('/inventory') || p.startsWith('/stock-card') || p.startsWith('/damage')) return 'inventory';
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
