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
    badgeColor: 'text-[#57ec7f] bg-[#57ec7f]/10 border-[#57ec7f]/30',
    hoverBorder: 'hover:border-[#57ec7f]/60'
  },
  {
    label: 'จ่ายออก',
    labelEn: 'Outbound',
    href: '/ops/outbound',
    icon: PackageMinus,
    badgeColor: 'text-[#ffb4ab] bg-[#93000a]/30 border-[#ffb4ab]/30',
    hoverBorder: 'hover:border-[#ffb4ab]/60'
  },
  {
    label: 'แจ้งเสีย',
    labelEn: 'Damage',
    href: '/ops/damage',
    icon: AlertTriangle,
    badgeColor: 'text-[#facc15] bg-[#facc15]/10 border-[#facc15]/30',
    hoverBorder: 'hover:border-[#facc15]/60'
  },
  {
    label: 'สแกน (F2)',
    labelEn: 'Scan',
    href: '/barcode/scanner',
    icon: QrCode,
    badgeColor: 'text-[#4cd7f6] bg-[#4cd7f6]/10 border-[#4cd7f6]/30',
    hoverBorder: 'hover:border-[#4cd7f6]/60'
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
      <div className="flex flex-wrap gap-2.5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`
                flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#30353d]
                bg-[#171c23] hover:bg-[#252a32] ${action.hoverBorder}
                text-[#dee2ec] font-mono font-bold text-xs
                transition-all duration-200 shadow-sm
                hover:-translate-y-0.5 active:scale-95
              `}
            >
              <div className={`p-1 rounded border ${action.badgeColor}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span>{action.label}</span>
              <span className="text-[10px] text-[#8a92a6] font-normal">[{action.labelEn}]</span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
