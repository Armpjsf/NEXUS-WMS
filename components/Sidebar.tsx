'use client';

import type { ElementType } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bot,
  Box,
  Boxes,
  Briefcase,
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  DatabaseZap,
  FileBarChart,
  FileText,
  Globe,
  History,
  Home,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  PackageCheck,
  Printer,
  QrCode,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tags,
  Truck,
  Users,
} from 'lucide-react';
import { useLanguage } from './providers/LanguageProvider';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import BranchSelector from './BranchSelector';

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
  tone: 'blue' | 'teal' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'steel';
  adminOnly?: boolean;
  viewerAllowed?: boolean;
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
    active: 'from-violet-700 to-fuchsia-600',
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
  const [org, setOrg] = useState<{ name: string; brandingLogo: string; brandingColor: string }>({ name: 'NEXUS WMS', brandingLogo: '/nexus-icon.png', brandingColor: '#06b6d4' });

  useEffect(() => {
    const loadOrg = () => fetch('/api/org', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setOrg({ name: d.name || 'NEXUS WMS', brandingLogo: d.brandingLogo || '/nexus-icon.png', brandingColor: d.brandingColor || '#06b6d4' }))
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

  const userRole = (session?.user as any)?.role || 'User';
  const isAdminRole = adminRoles.includes(userRole);

  // P1 cleanup: ยุบเมนูซ้ำ (พิมพ์ฉลาก/สแกน/ตรวจนับ/รายงาน/AI) + ย้ายเมนูมือถือ (/mobile/*) ไปไว้ที่ MobileNav
  const navGroups = useMemo<NavGroup[]>(() => ([
    {
      label: 'ภาพรวม',
      accent: 'bg-blue-500',
      items: [
        { label: t('menu_dashboard'), href: '/dashboard', icon: Home, tone: 'blue', viewerAllowed: true },
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
        { label: t('menu_stock_card'), href: '/inventory/stock-card', icon: ClipboardList, tone: 'blue', viewerAllowed: true },
        { label: t('menu_transactions'), href: '/inventory/transactions', icon: History, tone: 'cyan' },
        { label: t('print_labels'), href: '/inventory/print-labels', icon: Tags, tone: 'amber' },
      ],
    },
    {
      label: 'ปฏิบัติการ',
      accent: 'bg-emerald-500',
      items: [
        { label: 'รับเข้า & จัดเก็บ (GRN)', href: '/ops/receiving', icon: ArrowDownToLine, tone: 'emerald' },
        { label: 'Smart Wave Picking', href: '/ops/wave-picking', icon: Boxes, tone: 'amber' },
        { label: 'เบิกจ่ายตรง / ภายใน (Issue)', href: '/ops/outbound', icon: ArrowUpFromLine, tone: 'amber' },
        { label: t('menu_cycle_count'), href: '/ops/cycle-count', icon: PackageCheck, tone: 'teal' },
        { label: t('menu_damage'), href: '/ops/damage', icon: ShieldAlert, tone: 'rose' },
        { label: t('scan_barcode'), href: '/barcode/scanner', icon: ScanLine, tone: 'cyan' },
      ],
    },
    {
      label: 'การขาย & ออเดอร์',
      accent: 'bg-rose-500',
      items: [
        { label: 'ออเดอร์ขาออก', href: '/ops/orders', icon: PackageCheck, tone: 'cyan' },
        { label: 'ลูกค้า (Customers)', href: '/admin/customers', icon: Users, tone: 'blue' },
        { label: 'คืนสินค้า (RMA)', href: '/ops/returns', icon: History, tone: 'rose' },
        { label: 'Marketplace Hub', href: '/integrations/marketplaces', icon: ShoppingBag, tone: 'rose' },
      ],
    },
    {
      label: 'วิเคราะห์',
      accent: 'bg-violet-500',
      items: [
        { label: t('menu_analytics'), href: '/analytics', icon: BarChart3, tone: 'violet' },
        { label: 'รายงานเคลื่อนไหว', href: '/analytics/movements', icon: FileBarChart, tone: 'cyan', viewerAllowed: true },
        { label: t('aging_title'), href: '/analytics/aging', icon: Activity, tone: 'rose' },
        { label: t('forecast_title'), href: '/analytics/forecast', icon: Sparkles, tone: 'violet' },
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
        className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition-colors hover:bg-slate-50 md:hidden"
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
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_48%,#eef6f4_100%)] shadow-2xl shadow-slate-950/5 backdrop-blur-xl transition-[width,transform] duration-300',
          collapsed ? 'w-20' : 'w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-md p-1">
            <img src={org.brandingLogo || '/nexus-icon.png'} className="h-full w-full object-contain" alt={`${org.name} logo`} />
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black tracking-tight text-slate-950">{org.name}</h1>
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: org.brandingColor }}>Warehouse Command</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleCollapse}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 md:inline-flex"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {!collapsed && (
          <div className="border-b border-slate-100 p-3">
            <BranchSelector />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <div className="mb-2 flex items-center gap-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <span className={cn('h-1.5 w-1.5 rounded-full', group.accent)} />
                    <span>{group.label}</span>
                  </div>
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                    const tone = toneStyles[item.tone];

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobile}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
                          collapsed ? 'justify-center' : 'justify-start',
                          isActive
                            ? cn('bg-gradient-to-r text-white shadow-lg shadow-slate-950/10', tone.active)
                            : 'text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                            isActive ? 'bg-white/18 text-white ring-1 ring-white/20' : cn('ring-1', tone.soft, tone.icon)
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200 bg-slate-50/80 p-3">
          {!collapsed && (
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
              className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <Globe className="h-4 w-4 text-slate-400" />
                Language
              </span>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">
                {language.toUpperCase()}
              </span>
            </button>
          )}

          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white shadow-sm">
              {session?.user?.name?.charAt(0) || 'U'}
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-950">{session?.user?.name || 'Guest'}</p>
                <p className="truncate text-[11px] font-semibold text-slate-500">{userRole}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title={t('menu_signout')}
              aria-label={t('menu_signout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
