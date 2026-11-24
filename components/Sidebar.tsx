'use client';

import type { ElementType } from 'react';
import {
  ShoppingCart,
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Bot,
  Box,
  Boxes,
  Building2,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileBarChart,
  History,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Mic,
  Network,
  PackageCheck,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  ThermometerSnowflake,
  Truck,
  Users,
  MapPin,
} from 'lucide-react';
import { useLanguage } from './providers/LanguageProvider';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BranchSelector from './BranchSelector';
import { ExperimentalPill } from '@/components/ui/ExperimentalBanner';
import OrgSwitcher from './OrgSwitcher';

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
  tone: 'blue' | 'teal' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'steel';
  adminOnly?: boolean;
  viewerAllowed?: boolean;
  /** Simulated / not wired to real hardware or APIs yet — shows a "ทดลอง" pill. */
  experimental?: boolean;
};

type NavGroup = {
  label: string;
  accent: string;
  items: NavItem[];
};

const toneStyles = {
  blue: {
    icon: 'text-blue-700',
    soft: 'bg-blue-50 ring-blue-200',
    active: 'from-blue-700 to-cyan-600',
  },
  teal: {
    icon: 'text-teal-700',
    soft: 'bg-teal-50 ring-teal-200',
    active: 'from-teal-700 to-emerald-600',
  },
  emerald: {
    icon: 'text-emerald-700',
    soft: 'bg-emerald-50 ring-emerald-200',
    active: 'from-emerald-700 to-teal-600',
  },
  amber: {
    icon: 'text-amber-700',
    soft: 'bg-amber-50 ring-amber-200',
    active: 'from-amber-600 to-orange-600',
  },
  rose: {
    icon: 'text-rose-700',
    soft: 'bg-rose-50 ring-rose-200',
    active: 'from-rose-700 to-red-600',
  },
  violet: {
    icon: 'text-violet-700',
    soft: 'bg-violet-50 ring-violet-200',
    active: 'from-[#1b2027] to-fuchsia-600',
  },
  cyan: {
    icon: 'text-cyan-700',
    soft: 'bg-cyan-50 ring-cyan-200',
    active: 'from-cyan-700 to-blue-600',
  },
  steel: {
    icon: 'text-slate-700',
    soft: 'bg-slate-100 ring-slate-200',
    active: 'from-slate-800 to-slate-600',
  },
};

const adminRoles = ['Super Admin', 'Admin', 'Manager'];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [org, setOrg] = useState<{ name: string; brandingLogo: string; brandingColor: string }>({ name: 'NEXUS WMS', brandingLogo: '/nexus-icon.png', brandingColor: '#2563eb' });

  useEffect(() => {
    const loadOrg = () => fetch('/api/org', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setOrg({ name: d.name || 'NEXUS WMS', brandingLogo: d.brandingLogo || '/nexus-icon.png', brandingColor: d.brandingColor || '#2563eb' }))
      .catch(() => {});
    loadOrg();
    window.addEventListener('org-updated', loadOrg);
    return () => window.removeEventListener('org-updated', loadOrg);
  }, []);
  const { t, language, setLanguage } = useLanguage();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sidebar-collapsed');
      if (stored !== null) {
        setCollapsed(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error reading sidebar collapse state:', e);
    }
  }, []);

  // Sync class on document.documentElement
  useEffect(() => {
    if (collapsed) {
      document.documentElement.classList.add('sidebar-collapsed');
    } else {
      document.documentElement.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  const handleToggleCollapse = () => {
    const nextVal = !collapsed;
    setCollapsed(nextVal);
    try {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(nextVal));
    } catch (e) {
      console.error('Error saving sidebar collapse state:', e);
    }
  };

  const userRole = session?.user?.role || 'User';
  const isAdminRole = adminRoles.includes(userRole);
  const isHybrid = pathname !== '/login' && !pathname?.startsWith('/mobile');

  // P1 cleanup: ยุบเมนูซ้ำ (พิมพ์ฉลาก/สแกน/ตรวจนับ/รายงาน/AI) + ย้ายเมนูมือถือ (/mobile/*) ไปไว้ที่ MobileNav
  const navGroups = useMemo<NavGroup[]>(() => ([
    {
      label: 'ภาพรวม',
      accent: 'bg-blue-500',
      items: [
        { label: t('menu_dashboard'), href: '/dashboard', icon: Home, tone: 'blue', viewerAllowed: true },
        { label: 'Control Tower (ภาพรวมเรียลไทม์)', href: '/ops/control-tower', icon: Activity, tone: 'amber', viewerAllowed: true },
        { label: 'HQ Command Center', href: '/hq', icon: Building2, tone: 'cyan', viewerAllowed: true },
        { label: t('menu_smart_restock'), href: '/ai-reorder', icon: Sparkles, tone: 'emerald', adminOnly: true },
      ],
    },
    {
      label: 'สินค้าคงคลัง',
      accent: 'bg-teal-500',
      items: [
        { label: t('menu_inventory'), href: '/inventory', icon: Box, tone: 'teal', viewerAllowed: true },
        { label: '2D Warehouse Map', href: '/inventory/map', icon: LayoutGrid, tone: 'teal', viewerAllowed: true },
        { label: '3D Process Simulator', href: '/inventory/process-3d', icon: Boxes, tone: 'amber', viewerAllowed: true },
        { label: t('menu_stock_card'), href: '/inventory/stock-card', icon: ClipboardList, tone: 'blue', viewerAllowed: true },
        { label: t('menu_transactions'), href: '/inventory/transactions', icon: History, tone: 'cyan' },
        { label: t('print_labels'), href: '/inventory/print-labels', icon: Tags, tone: 'amber' },
      ],
    },
    {
      label: 'ปฏิบัติการ',
      accent: 'bg-emerald-500',
      items: [
        { label: 'คิวงานอัจฉริยะ (Smart Tasks)', href: '/ops/tasks', icon: Boxes, tone: 'amber' },
        { label: 'หุ่นยนต์ & WCS Gateway', href: '/ops/wcs', icon: Cpu, tone: 'cyan', adminOnly: true, experimental: true },
        { label: 'สั่งหยิบด้วยเสียง (Voice Picking)', href: '/ops/voice-picking', icon: Mic, tone: 'amber' },
        { label: 'ASN แจ้งของเข้าล่วงหน้า (EDI)', href: '/ops/asn', icon: ArrowDownToLine, tone: 'emerald' },
        { label: 'ใบสั่งซื้อ (PO)', href: '/ops/purchase-orders', icon: ShoppingCart, tone: 'blue' },
        { label: 'รับเข้า & จัดเก็บ (GRN)', href: '/ops/receiving', icon: ArrowDownToLine, tone: 'emerald' },
        { label: 'จัดคิวเทียบท่า (Dock Scheduling)', href: '/ops/dock', icon: Truck, tone: 'blue' },
        { label: 'สถานีตรวจแพ็ค (Packing QA)', href: '/ops/packing', icon: PackageCheck, tone: 'emerald' },
        { label: 'จัดการพาเลท (LPN Pallet)', href: '/ops/lpn', icon: Boxes, tone: 'teal' },
        { label: 'รวมชุดสินค้า (Kitting BOM)', href: '/ops/kitting', icon: Boxes, tone: 'emerald' },
        { label: 'Smart Wave Picking', href: '/ops/wave-picking', icon: Boxes, tone: 'amber' },
        { label: 'ขออนุมัติปรับยอด (Maker-Checker)', href: '/ops/adjustments', icon: ClipboardCheck, tone: 'rose' },
        { label: 'โอนสต็อกข้ามสาขา', href: '/ops/transfers', icon: ArrowLeftRight, tone: 'teal' },
        { label: 'เบิกจ่ายตรง / ภายใน (Issue)', href: '/ops/outbound', icon: ArrowUpFromLine, tone: 'amber' },
        { label: t('menu_cycle_count'), href: '/ops/cycle-count', icon: PackageCheck, tone: 'teal' },
        { label: t('menu_damage'), href: '/ops/damage', icon: ShieldAlert, tone: 'rose' },
        { label: 'พิมพ์บาร์โค้ด & ฉลาก', href: '/ops/labels', icon: Tags, tone: 'amber' },
        { label: t('scan_barcode'), href: '/barcode/scanner', icon: ScanLine, tone: 'cyan' },
      ],
    },
    {
      label: 'การขาย & ออเดอร์',
      accent: 'bg-rose-500',
      items: [
        { label: 'คลังรับฝาก 3PL & Billing', href: '/ops/3pl', icon: Building2, tone: 'cyan', adminOnly: true, experimental: true },
        { label: 'ออเดอร์ขาออก', href: '/ops/orders', icon: PackageCheck, tone: 'cyan' },
        { label: 'สรุปงานส่งรายจังหวัด', href: '/analytics/outbound-summary', icon: MapPin, tone: 'cyan' },
        { label: 'ลูกค้า (Customers)', href: '/admin/customers', icon: Users, tone: 'blue' },
        { label: 'คืนสินค้า (RMA)', href: '/ops/returns', icon: History, tone: 'rose' },
        { label: 'เทียบราคาขนส่ง (Rate Shopping)', href: '/ops/carrier-rates', icon: Truck, tone: 'cyan' },
        { label: 'เชื่อมต่อ ERP & Hardware', href: '/integrations/erp', icon: Network, tone: 'cyan', adminOnly: true },
        { label: 'Marketplace Hub', href: '/integrations/marketplaces', icon: ShoppingBag, tone: 'rose' },
      ],
    },
    {
      label: 'วิเคราะห์',
      accent: 'bg-violet-500',
      items: [
        { label: t('menu_analytics'), href: '/analytics', icon: BarChart3, tone: 'violet' },
        { label: 'เซนเซอร์ห้องเย็น (Cold-Chain IoT)', href: '/ops/iot/cold-chain', icon: ThermometerSnowflake, tone: 'cyan', experimental: true },
        { label: 'ประสิทธิภาพแรงงาน (Labor LMS)', href: '/ops/analytics/productivity', icon: Activity, tone: 'violet' },
        { label: 'LMS ภาระงานรายคน (Leaderboard)', href: '/ops/lms', icon: Users, tone: 'violet' },
        { label: 'รายงานเคลื่อนไหว', href: '/analytics/movements', icon: FileBarChart, tone: 'cyan', viewerAllowed: true },
        { label: t('aging_title'), href: '/analytics/aging', icon: Activity, tone: 'rose' },
        { label: t('forecast_title'), href: '/analytics/forecast', icon: Sparkles, tone: 'violet' },
        { label: 'ประสิทธิภาพพนักงาน (รายคน)', href: '/ops/analytics/staff', icon: Users, tone: 'violet' },
        { label: 'มูลค่าสต็อก & Dead Stock', href: '/ops/reports/valuation', icon: ReceiptText, tone: 'rose' },
        { label: t('profit_title'), href: '/analytics/profit', icon: ReceiptText, tone: 'emerald' },
        { label: t('menu_reports'), href: '/analytics/reports', icon: FileBarChart, tone: 'steel', viewerAllowed: true },
      ],
    },
    {
      label: 'ตั้งค่า',
      accent: 'bg-slate-500',
      items: [
        { label: t('menu_admin'), href: '/admin', icon: Settings, tone: 'steel', adminOnly: true },
        { label: 'ตั้งค่าองค์กร', href: '/admin/organization', icon: Building2, tone: 'cyan', adminOnly: true },
        { label: t('admin_users_title'), href: '/admin/users', icon: Users, tone: 'blue', adminOnly: true },
        { label: 'ผู้ให้บริการขนส่ง', href: '/admin/carriers', icon: Truck, tone: 'amber', adminOnly: true },
        { label: 'รถบริษัท (Fleet)', href: '/admin/fleet', icon: Truck, tone: 'blue', adminOnly: true },
        { label: 'ผู้จำหน่าย (Suppliers)', href: '/admin/suppliers', icon: Building2, tone: 'emerald', adminOnly: true },
        { label: t('branches_title'), href: '/admin/branches', icon: Store, tone: 'teal', adminOnly: true },
        { label: t('rules_title'), href: '/admin/rules', icon: Bot, tone: 'amber', adminOnly: true },
        { label: t('menu_slotting'), href: '/admin/slotting', icon: LayoutGrid, tone: 'violet', adminOnly: true },
        { label: t('menu_audit'), href: '/admin/audit-trail', icon: History, tone: 'steel', adminOnly: true },
      ],
    },
  ]), [t]);

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !isAdminRole) return false;
        if (userRole === 'Viewer') return Boolean(item.viewerAllowed);
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[70] -translate-y-16 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <button
        type="button"
        className={cn(
          'fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors md:hidden',
          isHybrid
            ? 'border-slate-200 bg-white text-slate-700 hover:text-emerald-600 shadow-sm'
            : 'border-edge bg-surface-card text-foreground hover:text-accent-gold shadow-lg'
        )}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-[width,transform] duration-300 select-none',
          isHybrid
            ? 'md:top-3 md:bottom-3 md:left-3 md:rounded-[24px] overflow-hidden bg-[#121817]/95 backdrop-blur-xl border border-white/10 text-slate-100 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.45)]'
            : 'border-r border-edge/60 bg-surface-lowest text-foreground shadow-2xl',
          collapsed ? 'w-20' : isHybrid ? 'w-80 md:w-[296px]' : 'w-80',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Brand & Telemetry Header */}
        <div
          className={cn(
            'border-b p-3.5',
            isHybrid ? 'border-white/10 bg-white/[0.03]' : 'border-edge/60 bg-surface-card/80'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center border',
                  isHybrid ? 'rounded-xl bg-white/10 border-white/15' : 'rounded bg-surface-panel border-edge'
                )}
              >
                <img
                  src={org.brandingLogo || '/nexus-icon.png'}
                  className="h-7 w-7 object-contain drop-shadow"
                  alt="NEXUS WMS"
                />
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'font-headline text-sm font-extrabold tracking-wider uppercase leading-none block',
                      isHybrid ? 'text-white' : 'text-accent-gold'
                    )}
                  >
                    NEXUS WMS
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[9px] tracking-tight leading-tight block mt-0.5',
                      isHybrid ? 'text-slate-400' : 'text-text-tactical'
                    )}
                  >
                    COMMAND PLATFORM v4.8
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {!collapsed && (
                <div
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold',
                    isHybrid ? 'bg-emerald-500/10 border-emerald-400/25 rounded-full px-2' : 'bg-surface-panel border-edge'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full animate-pulse', isHybrid ? 'bg-emerald-400' : 'bg-accent-emerald')}></span>
                  <span className={isHybrid ? 'text-emerald-400' : 'text-accent-emerald'}>SYNC LIVE</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleToggleCollapse}
                className={cn(
                  'hidden h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors md:inline-flex',
                  isHybrid
                    ? 'rounded-lg border-white/15 bg-white/[0.07] text-slate-300 hover:text-white hover:bg-white/15'
                    : 'border-edge bg-surface-steel text-text-tactical hover:text-foreground'
                )}
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              >
                <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} />
              </button>
            </div>
          </div>

          {!collapsed && (
            <>
              {/* Org switcher (only for users in several orgs) */}
              <div className="mt-2.5 empty:hidden">
                <OrgSwitcher />
              </div>
              {/* Branch Selector wrapper */}
              <div
                className={cn(
                  'mt-2.5 p-2 border',
                  isHybrid ? 'rounded-xl bg-white/[0.04] border-white/10' : 'rounded bg-surface-panel border-edge/80'
                )}
              >
                <BranchSelector />
              </div>
            </>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <div
                    className={cn(
                      'mb-1.5 flex items-center gap-1.5 px-2.5 text-[10px] font-mono font-bold uppercase tracking-wider',
                      isHybrid ? 'text-slate-400/90' : 'text-text-tactical/70'
                    )}
                  >
                    <span className={cn('h-1 w-1 rounded-full', isHybrid ? 'bg-emerald-400' : 'bg-accent-gold')} />
                    <span>{group.label}</span>
                  </div>
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobile}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex min-h-9 items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold transition-all duration-150',
                          isHybrid ? 'rounded-xl' : 'rounded',
                          collapsed ? 'justify-center' : 'justify-between',
                          isHybrid
                            ? isActive
                              ? 'rounded-xl bg-emerald-500/18 border border-emerald-400/25 text-white font-semibold shadow-xs'
                              : 'border border-transparent text-slate-300 hover:bg-white/[0.07] hover:text-white'
                            : isActive
                              ? 'bg-surface-steel text-accent-gold font-bold border-l-2 border-accent-gold'
                              : 'text-text-tactical hover:bg-surface-card hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isHybrid
                                ? isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                                : isActive ? 'text-accent-gold' : 'text-text-tactical group-hover:text-foreground'
                            )}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && item.experimental && <ExperimentalPill />}
                        </div>
                        {!collapsed && isActive && (
                          <span
                            className={cn(
                              'font-mono text-[9px] py-0.5 font-bold shrink-0',
                              isHybrid
                                ? 'rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2'
                                : 'rounded bg-accent-gold text-accent-gold-dark px-1'
                            )}
                          >
                            LIVE
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Bottom Operator Card & Scanner [F2] */}
        <div
          className={cn(
            'border-t p-3 flex flex-col gap-2',
            isHybrid ? 'border-white/10 bg-white/[0.03]' : 'border-edge/60 bg-surface-card/90'
          )}
        >
          {!collapsed && (
            <Link
              href="/barcode/scanner"
              className={cn(
                'w-full py-2 px-3 font-mono text-xs font-bold flex items-center justify-center gap-1.5 active:translate-y-px transition-all shadow-sm',
                isHybrid
                  ? 'rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  : 'rounded bg-accent-gold text-accent-gold-dark hover:bg-[#eec200]'
              )}
            >
              <ScanLine className="w-4 h-4" />
              <span>เปิดสแกนเนอร์บาร์โค้ด [F2]</span>
            </Link>
          )}

          <div
            className={cn(
              'flex items-center gap-2.5 pt-1 border-t',
              isHybrid ? 'border-white/10' : 'border-edge/40',
              collapsed && 'justify-center'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ring-1',
                isHybrid
                  ? 'bg-emerald-500 text-slate-950 ring-emerald-300/40'
                  : 'bg-accent-gold text-accent-gold-dark ring-[#ffe083]/40'
              )}
            >
              {session?.user?.name?.charAt(0) || 'U'}
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-xs font-bold leading-tight', isHybrid ? 'text-white' : 'text-foreground')}>
                  {session?.user?.name || 'ผู้ใช้งาน'}
                </p>
                <p className={cn('truncate font-mono text-[10px] leading-none mt-0.5', isHybrid ? 'text-slate-400' : 'text-text-tactical')}>
                  {userRole}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded border transition-colors',
                isHybrid
                  ? 'rounded-lg border-white/15 bg-white/[0.07] text-slate-300 hover:text-rose-400 hover:border-rose-500/40'
                  : 'border-edge bg-surface-steel text-text-tactical hover:text-accent-rose hover:border-accent-rose/40'
              )}
              title={t('menu_signout')}
              aria-label={t('menu_signout')}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
