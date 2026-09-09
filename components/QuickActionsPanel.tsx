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
    color: 'bg-emerald-500',
    hoverColor: 'hover:bg-emerald-600',
    shadow: 'shadow-emerald-500/30'
  },
  {
    label: 'จ่ายออก',
    labelEn: 'Outbound',
    href: '/ops/outbound',
    icon: PackageMinus,
    color: 'bg-rose-500',
    hoverColor: 'hover:bg-rose-600',
    shadow: 'shadow-rose-500/30'
  },
  {
    label: 'แจ้งเสีย',
    labelEn: 'Damage',
    href: '/damage',
    icon: AlertTriangle,
    color: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
    shadow: 'shadow-amber-500/30'
  },
  {
    label: 'สแกน',
    labelEn: 'Scan',
    href: '/barcode/scanner',
    icon: QrCode,
    color: 'bg-indigo-500',
    hoverColor: 'hover:bg-indigo-600',
    shadow: 'shadow-indigo-500/30'
  }
];

export default function QuickActionsPanel() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-6"
    >
      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl
                ${action.color} ${action.hoverColor}
                text-white font-bold text-sm
                shadow-lg ${action.shadow}
                transition-all duration-200
                hover:scale-105 hover:-translate-y-0.5
                active:scale-95
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{action.label}</span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
