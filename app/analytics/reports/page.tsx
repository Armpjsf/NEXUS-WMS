'use client';

import { useState } from 'react';
import { FileText, Calendar, ArrowRight, BarChart, Table, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  endpoint: string;
  accent: string;
  iconColor: string;
  bgIcon: string;
}

const reports = (t: any): ReportConfig[] => [
  {
    id: 'inventory_summary',
    name: t('inventory_summary_report'),
    description: t('inventory_summary_desc'),
    icon: PackageIcon,
    endpoint: '/api/reports/inventory',
    accent: '#4cd7f6',
    iconColor: 'text-[#4cd7f6]',
    bgIcon: 'bg-[#4cd7f6]/15'
  },
  {
    id: 'stock_movement',
    name: t('stock_movement_report'),
    description: t('stock_movement_desc'),
    icon: ArrowRight,
    endpoint: '/api/reports/movement',
    accent: '#57ec7f',
    iconColor: 'text-[#57ec7f]',
    bgIcon: 'bg-[#57ec7f]/15'
  },
  {
    id: 'low_stock',
    name: t('low_stock_report'),
    description: t('low_stock_desc'),
    icon: Table,
    endpoint: '/api/reports/low-stock',
    accent: '#ff5449',
    iconColor: 'text-[#ff5449]',
    bgIcon: 'bg-[#ff5449]/15'
  },
  {
    id: 'damage_report',
    name: t('damage_report_name'),
    description: t('damage_report_desc'),
    icon: FileText,
    endpoint: '/api/reports/damage',
    accent: '#facc15',
    iconColor: 'text-[#facc15]',
    bgIcon: 'bg-[#facc15]/15'
  }
];

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const availableReports = reports(t);

  const handleGenerate = async (report: ReportConfig) => {
    if (report.id === 'inventory_summary') {
        router.push('/analytics/summary');
        return;
    }
    if (report.id === 'low_stock') {
        router.push('/inventory?status=LOW');
        return;
    }
    if (report.id === 'stock_movement') {
        const branchId = new URLSearchParams(window.location.search).get('branchId') || '';
        window.open(getApiUrl(`/api/reports/movement?branchId=${branchId}`), '_blank');
        return;
    }
    if (report.id === 'damage_report') {
        router.push('/ops/damage');
        return;
    }
    router.push('/inventory');
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8">
      <AmbientBackground />

      <div className="max-w-[1500px] mx-auto space-y-7 relative z-10">
        <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-sm font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-[#4cd7f6]/30 hover:bg-[#4cd7f6]/10 hover:text-[#4cd7f6] print:hidden">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
          {t('back_to_analytics')}
        </Link>
        <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#4cd7f6]">Report Center</p>
          <h1 className="text-3xl font-black text-[#dee2ec] flex items-center gap-3">
            <span className="p-2.5 bg-[#4cd7f6]/15 border border-[#4cd7f6]/30 rounded-xl text-[#4cd7f6]">
              <BarChart className="w-6 h-6" />
            </span>
            {t('report_center_title')}
          </h1>
          <p className="text-[#8a92a6] mt-2 font-semibold">{t('report_center_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {availableReports.map((report) => (
            <motion.div
              key={report.id}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="h-full"
            >
              <div 
                className="group relative rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-sm hover:border-[#facc15]/60 transition-all duration-300 overflow-hidden h-full cursor-pointer flex flex-col justify-between"
                onClick={() => handleGenerate(report)}
              >
                <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: report.accent }} />

                <div>
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-5 border border-[#30353d]/50", report.bgIcon)}>
                    <report.icon className={cn("w-6 h-6", report.iconColor)} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-[#dee2ec] mb-2 tracking-tight group-hover:text-[#facc15] transition-colors">{report.name}</h3>
                  <p className="text-[#8a92a6] text-sm leading-relaxed font-medium mb-6">{report.description}</p>
                </div>
                
                <div className="pt-4 border-t border-[#30353d] flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-[#d1c6ab] tracking-wider uppercase">CSV / PDF</span>
                  <div className="w-8 h-8 rounded-lg bg-[#1b2027] border border-[#30353d] flex items-center justify-center text-[#d1c6ab] group-hover:bg-[#facc15] group-hover:text-[#1b1600] group-hover:border-[#facc15] transition-all">
                      <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Configuration Panel */}
        <div className="bg-[#171c23] rounded-xl p-6 border border-[#30353d] shadow-sm">
          <h3 className="font-bold text-[#dee2ec] mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#8a92a6]" />
            {t('scheduled_reports')}
          </h3>
          <div className="p-8 bg-[#1b2027] rounded-xl text-center border border-dashed border-[#30353d]">
             <p className="text-[#8a92a6] font-medium">{t('scheduled_reports_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
