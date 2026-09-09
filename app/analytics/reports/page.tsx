'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, Filter, ArrowRight, BarChart, Table, ArrowLeft } from 'lucide-react';
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
  color: string;
}

const reports = (t: any): ReportConfig[] => [
  {
    id: 'inventory_summary',
    name: t('inventory_summary_report'),
    description: t('inventory_summary_desc'),
    icon: PackageIcon,
    endpoint: '/api/reports/inventory',
    color: 'from-indigo-600 to-blue-700'
  },
  {
    id: 'stock_movement',
    name: t('stock_movement_report'),
    description: t('stock_movement_desc'),
    icon: ArrowRight,
    endpoint: '/api/reports/movement',
    color: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'low_stock',
    name: t('low_stock_report'),
    description: t('low_stock_desc'),
    icon: Table,
    endpoint: '/api/reports/low-stock',
    color: 'from-rose-500 to-red-600'
  },
  {
    id: 'damage_report',
    name: t('damage_report_name'),
    description: t('damage_report_desc'),
    icon: FileText,
    endpoint: '/api/reports/damage',
    color: 'from-amber-500 to-orange-600'
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
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);

  const availableReports = reports(t);

  const handleGenerate = async (report: ReportConfig) => {
    // Direct link to printable pages for supported reports
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

    setLoading(true);
    // Simulate generation for others
    setTimeout(() => {
      setLoading(false);
      alert(`Generated ${report.name} successfully! (Mock Download)`);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8">
      <AmbientBackground />

      <div className="max-w-[1500px] mx-auto space-y-7 relative z-10">
        <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 print:hidden">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
          {t('back_to_analytics')}
        </Link>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-blue-200 bg-white/85 p-6 shadow-xl shadow-blue-900/10 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-cyan-500 to-slate-700" />
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Report Center</p>
          <h1 className="text-3xl font-black text-slate-950 flex items-center gap-3">
            <span className="p-2 bg-blue-700 rounded-xl text-white">
              <BarChart className="w-6 h-6" />
            </span>
            {t('report_center_title')}
          </h1>
          <p className="text-slate-500 mt-2 font-semibold">{t('report_center_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableReports.map((report) => (
            <motion.div
              key={report.id}
              whileHover={{ y: -10 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div 
                className="group relative border-none rounded-[2.5rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden h-full cursor-pointer"
                onClick={() => handleGenerate(report)}
              >
                {/* Permanent Gradient Background */}
                <div className={cn("absolute inset-0 bg-gradient-to-br transition-transform duration-700 group-hover:scale-110", report.color)} />

                <div className="relative z-10 flex flex-col h-full">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg bg-white/20 backdrop-blur-md transition-all duration-500")}>
                    <report.icon className="w-7 h-7" />
                  </div>
                  
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tight">{report.name}</h3>
                  <p className="text-white/80 text-sm mb-8 leading-relaxed font-medium flex-1">{report.description}</p>
                  
                  <div className="pt-6 border-t border-white/20 flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">CSV / PDF</span>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white group-hover:text-indigo-600 transition-all duration-500">
                        <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Configuration Panel (Mock) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            {t('scheduled_reports')}
          </h3>
          <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-300">
             <p className="text-slate-400 font-medium">{t('scheduled_reports_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
