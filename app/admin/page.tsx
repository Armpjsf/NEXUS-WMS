'use client';

import { Users, History, ShieldAlert, Settings, LayoutGrid, Printer, Building2, ArrowRight, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { motion } from 'framer-motion';

export default function AdminPage() {
  const { t } = useLanguage();

  const menuItems = [
    {
      title: t('menu_ops_user'),
      desc: t('admin_users_desc'),
      icon: Users,
      href: '/admin/users',
      iconTone: 'bg-sky-500/12 border-sky-500/20 text-sky-700',
      badge: 'RBAC',
      badgeTone: 'bg-sky-500/12 text-sky-700 border-sky-500/20',
    },
    {
      title: t('menu_audit'),
      desc: t('admin_audit_desc'),
      icon: History,
      href: '/admin/audit-trail',
      iconTone: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
      badge: 'Security',
      badgeTone: 'bg-amber-500/15 text-amber-800 border-amber-500/25',
    },
    {
      title: t('menu_quality'),
      desc: t('admin_quality_desc'),
      icon: ShieldAlert,
      href: '/admin/data-quality',
      iconTone: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700',
      badge: 'Integrity',
      badgeTone: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20',
    },
    {
      title: t('menu_slotting'),
      desc: t('admin_slotting_desc'),
      icon: LayoutGrid,
      href: '/admin/slotting',
      iconTone: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
      badge: 'AI Layout',
      badgeTone: 'bg-slate-900 text-white border-slate-900',
    },
    {
      title: t('barcode_title'),
      desc: t('admin_labels_desc'),
      icon: Printer,
      href: '/admin/labels',
      iconTone: 'bg-rose-500/12 border-rose-500/20 text-rose-700',
      badge: 'Labels',
      badgeTone: 'bg-rose-500/12 text-rose-700 border-rose-500/20',
    },
    {
      title: t('branch_management_title'),
      desc: t('admin_branches_desc'),
      icon: Building2,
      href: '/admin/branches',
      iconTone: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700',
      badge: 'Branches',
      badgeTone: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20',
    },
    {
      title: 'จุดรับสินค้า',
      desc: 'คลังจุดรับพร้อมพิกัด (ต้นทาง) ใช้ตอนสร้างงานส่งขึ้นรถ',
      icon: Warehouse,
      href: '/admin/pickup-locations',
      iconTone: 'bg-sky-500/12 border-sky-500/20 text-sky-700',
      badge: 'TMS GPS',
      badgeTone: 'bg-sky-500/12 text-sky-700 border-sky-500/20',
    },
  ];

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-1"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <Settings className="w-3 h-3 text-emerald-600" />
              System Administration
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            {t('menu_admin')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-3xl">{t('admin_subtitle')}</p>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {menuItems.map((item, idx) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Link
                href={item.href}
                className="nx-glass-card group flex h-full flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${item.iconTone}`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.badgeTone}`}>
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-slate-600 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/70 flex items-center justify-between text-slate-700 font-semibold text-xs group-hover:text-emerald-700 transition-colors">
                  <span>Manage Module</span>
                  <span className="w-8 h-8 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
