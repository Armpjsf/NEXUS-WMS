'use client';

import { Users, History, ShieldAlert, Settings, LayoutGrid, Printer, Building2, TrendingUp, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function AdminPage() {
  const { t } = useLanguage();

  const menuItems = [
    { 
      title: t('menu_ops_user'), 
      desc: t('admin_users_desc'), 
      icon: Users, 
      href: '/admin/users',
      color: 'from-blue-600 to-indigo-700'
    },
    { 
      title: t('menu_audit'), 
      desc: t('admin_audit_desc'), 
      icon: History, 
      href: '/admin/audit-trail',
      color: 'from-amber-500 to-orange-600'
    },
    { 
      title: t('menu_quality'), 
      desc: t('admin_quality_desc'), 
      icon: ShieldAlert, 
      href: '/admin/data-quality',
      color: 'from-emerald-500 to-teal-600'
    },
    { 
      title: t('menu_slotting'), 
      desc: t('admin_slotting_desc'), 
      icon: LayoutGrid, 
      href: '/admin/slotting',
      color: 'from-indigo-600 to-blue-700'
    },
    { 
      title: t('barcode_title'), 
      desc: t('admin_labels_desc'), 
      icon: Printer, 
      href: '/admin/labels',
      color: 'from-rose-600 to-pink-700'
    },
    {
      title: t('branch_management_title'),
      desc: t('admin_branches_desc'),
      icon: Building2,
      href: '/admin/branches',
      color: 'from-teal-500 to-cyan-600'
    },
    {
      title: 'จุดรับสินค้า',
      desc: 'คลังจุดรับพร้อมพิกัด (ต้นทาง) ใช้ตอนสร้างงานส่งขึ้นรถ',
      icon: Warehouse,
      href: '/admin/pickup-locations',
      color: 'from-cyan-500 to-blue-600'
    }
  ];

  return (
    <div className="p-8 pb-32 max-w-7xl mx-auto min-h-screen relative">
      <AmbientBackground />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-xl shadow-slate-900/5 relative overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-800 via-blue-700 to-teal-500" />
        <h1 className="relative z-10 text-4xl font-black text-slate-900 mb-2 flex items-center gap-4">
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg">
            <Settings className="w-8 h-8" />
          </div>
          {t('menu_admin')}
        </h1>
        <p className="relative z-10 text-slate-500 font-medium text-lg ml-2">{t('admin_subtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {menuItems.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link href={item.href}>
              <div className="group relative border border-slate-200 bg-white/90 p-8 rounded-[1.75rem] flex flex-col h-full shadow-lg shadow-slate-900/5 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden cursor-pointer">
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.color}`} />

                <div className="relative z-10">
                  <div className={`w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                     <item.icon className={`w-8 h-8 text-white`} />
                  </div>
                  
                  <h3 className={`text-2xl font-black text-slate-950 mb-3 tracking-tight`}>
                     {item.title}
                  </h3>
                  
                  <p className="text-slate-500 leading-relaxed font-medium">
                     {item.desc}
                  </p>
                </div>

                <div className="mt-8 flex items-center gap-2 text-slate-700 font-black text-sm uppercase tracking-widest relative z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                   Manage Module
                   <TrendingUp className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
