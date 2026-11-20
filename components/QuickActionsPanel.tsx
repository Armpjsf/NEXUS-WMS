'use client';

import Link from 'next/link';
import { PackagePlus, PackageMinus, AlertTriangle, QrCode } from 'lucide-react';
import { motion } from 'framer-motion';

const quickActions = [
  {
    label: 'รับเข้า',
    labelEn: 'Inbound',
    href: '/ops/receiving',
    icon: PackagePlus,
    badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    hoverBorder: 'hover:border-emerald-300'
  },
  {
    label: 'จ่ายออก',
    labelEn: 'Outbound',
    href: '/ops/outbound',
    icon: PackageMinus,
    badgeColor: 'text-sky-600 bg-sky-50 border-sky-200',
    hoverBorder: 'hover:border-sky-300'
  },
  {
    label: 'แจ้งเสีย',
    labelEn: 'Damage',
    href: '/ops/damage',
    icon: AlertTriangle,
    badgeColor: 'text-rose-600 bg-rose-50 border-rose-200',
    hoverBorder: 'hover:border-rose-300'
  },
  {
    label: 'สแกน (F2)',
    labelEn: 'Scan',
    href: '/barcode/scanner',
    icon: QrCode,
    badgeColor: 'text-amber-600 bg-amber-50 border-amber-200',
    hoverBorder: 'hover:border-amber-300'
  }
];

export default function QuickActionsPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="flex flex-wrap gap-2.5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`
                nx-glass-card flex items-center gap-2.5 px-4 py-2.5 !rounded-full
                hover:bg-white/95 ${action.hoverBorder}
                text-slate-800 font-semibold text-xs
                transition-all duration-200
                hover:-translate-y-0.5 active:scale-95
              `}
            >
              <div className={`p-1.5 rounded-lg border ${action.badgeColor}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span>{action.label}</span>
              <span className="text-[11px] text-slate-400 font-normal">[{action.labelEn}]</span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
