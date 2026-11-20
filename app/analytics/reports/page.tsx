'use client';

import { FileText, Calendar, ArrowRight, BarChart, Table, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
  iconTone: string;
}

const reports = (t: any): ReportConfig[] => [
  {
    id: 'inventory_summary',
    name: t('inventory_summary_report'),
    description: t('inventory_summary_desc'),
    icon: PackageIcon,
    endpoint: '/api/reports/inventory',
    iconTone: 'bg-sky-500/12 border-sky-500/20 text-sky-700',
  },
  {
    id: 'stock_movement',
    name: t('stock_movement_report'),
    description: t('stock_movement_desc'),
    icon: ArrowRight,
    endpoint: '/api/reports/movement',
    iconTone: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700',
  },
  {
    id: 'low_stock',
    name: t('low_stock_report'),
    description: t('low_stock_desc'),
    icon: Table,
    endpoint: '/api/reports/low-stock',
    iconTone: 'bg-rose-500/12 border-rose-500/20 text-rose-600',
  },
  {
    id: 'damage_report',
    name: t('damage_report_name'),
    description: t('damage_report_desc'),
    icon: FileText,
    endpoint: '/api/reports/damage',
    iconTone: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
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
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all print:hidden w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('back_to_analytics')}
        </Link>

        {/* Open Page Header */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Report Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart className="w-7 h-7 text-sky-600 shrink-0" />
            <span>{t('report_center_title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('report_center_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {availableReports.map((report) => (
            <motion.div
              key={report.id}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="h-full"
            >
              <div
                className="nx-glass-card group p-6 transition-all duration-300 h-full cursor-pointer flex flex-col justify-between"
                onClick={() => handleGenerate(report)}
              >
                <div>
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border", report.iconTone)}>
                    <report.icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2 tracking-tight group-hover:text-emerald-700 transition-colors">{report.name}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">{report.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase">CSV / PDF</span>
                  <div className="w-8 h-8 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all">
                      <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Configuration Panel */}
        <div className="nx-glass-card p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-slate-500" />
            {t('scheduled_reports')}
          </h3>
          <div className="p-8 bg-slate-50/80 rounded-2xl text-center border border-dashed border-slate-300">
             <p className="text-slate-600 text-sm font-medium">{t('scheduled_reports_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
