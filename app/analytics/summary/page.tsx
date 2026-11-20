'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Calendar, ArrowDownLeft, ArrowUpRight, ClipboardList, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { HYBRID_TOOLTIP_STYLE } from '@/lib/chartTheme';

export default function SummaryPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        try {
            const query = new URLSearchParams({ granularity });
            if (startDate) query.append('startDate', startDate);
            if (endDate) query.append('endDate', endDate);

            const res = await fetch(`/api/analytics/summary?${query.toString()}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Failed to fetch summary", error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, [granularity, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
       <div className="mx-auto max-w-[1500px] space-y-6">
       <Link
         href="/analytics"
         className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all print:hidden w-fit"
       >
           <ArrowLeft className="w-3.5 h-3.5" /> {t('back_to_analytics')}
       </Link>

       {/* Open Page Header */}
       <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1">
          <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Movement Summary
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                 <BarChart3 className="w-7 h-7 text-emerald-600 shrink-0" />
                 <span>{t('transaction_summary_title')}</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('transaction_summary_subtitle')}</p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center print:hidden">
              {/* Date Filter Pill */}
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/90 shadow-xs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-slate-700 text-xs font-semibold px-1 py-0.5 focus:outline-none"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-slate-700 text-xs font-semibold px-1 py-0.5 focus:outline-none"
                  />
              </div>

              {/* Granularity Toggle Pill */}
              <div className="bg-white/65 backdrop-blur-md p-1 rounded-full flex border border-white/85 shadow-xs">
                  <button
                     onClick={() => setGranularity('day')}
                     className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${granularity === 'day' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                      {t('daily')}
                  </button>
                  <button
                     onClick={() => setGranularity('month')}
                     className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${granularity === 'month' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                      {t('monthly')}
                  </button>
              </div>

              <button
                onClick={handlePrint}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full flex items-center gap-2 font-semibold transition-colors shadow-sm text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t('print')}</span>
              </button>
          </div>
       </header>

       <style jsx global>{`
          @media print {
            nav, aside, .fixed, .sticky {
              display: none !important;
            }
            button, .no-print {
              display: none !important;
            }
            body {
              background-color: white !important;
              color: black !important;
            }
            .grid {
              display: block !important;
            }
            .grid > * {
              margin-bottom: 2rem;
              page-break-inside: avoid;
            }
            .recharts-responsive-container {
               height: 300px !important;
            }
          }
       `}</style>

       {/* Comparison Chart */}
       <div className="nx-glass-card p-6 h-[440px]">
           <h3 className="text-slate-900 font-bold text-base mb-5">{t('inbound_vs_outbound')} ({granularity === 'day' ? t('daily') : t('monthly')})</h3>
           {loading || !data || !mounted ? (
               <div className="h-[85%] flex items-center justify-center text-slate-500 text-sm">{t('loading')}</div>
           ) : (
               <ResponsiveContainer width="100%" height="85%">
                   <BarChart data={data.chartData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                       <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                       <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                       <Tooltip contentStyle={HYBRID_TOOLTIP_STYLE} />
                       <Legend />
                       <Bar dataKey="in" name={t('legend_inbound')} fill="#10b981" radius={[6, 6, 0, 0]} />
                       <Bar dataKey="out" name={t('legend_outbound')} fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                   </BarChart>
               </ResponsiveContainer>
           )}
       </div>

       {/* Weekday Analysis */}
       <div className="nx-glass-card p-6">
           <h3 className="text-slate-900 font-bold text-base mb-5 flex items-center gap-2">
               <Calendar className="w-4 h-4 text-amber-600" />
               {t('weekday_analysis')}
           </h3>
           <div className="h-[300px]">
               {loading || !data || !mounted ? (
                   <div className="h-full flex items-center justify-center text-slate-500 text-sm">{t('loading')}</div>
               ) : (
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.weekdayAnalysis} layout="vertical">
                             <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                             <XAxis type="number" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                             <YAxis dataKey="day" type="category" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} width={100} axisLine={false} tickLine={false} />
                             <Tooltip contentStyle={HYBRID_TOOLTIP_STYLE} />
                             <Bar dataKey="qty" name={t('total_out')} fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
                        </BarChart>
                   </ResponsiveContainer>
               )}
           </div>
           <p className="text-xs text-slate-500 mt-4 text-center">
               {t('weekday_analysis_desc')}
           </p>
       </div>

       {/* Transaction Table */}
       <div className="nx-glass-card overflow-hidden">
           <div className="p-5 border-b border-slate-200/70">
               <h3 className="text-slate-900 font-bold text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  {t('recent_transactions_logger')} <span className="text-xs text-slate-500 font-normal">{t('last_100_items')}</span>
               </h3>
           </div>
           <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-slate-700">
                   <thead className="bg-slate-50/80 sticky top-0 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
                       <tr>
                           <th className="px-6 py-3.5">{t('col_date')}</th>
                           <th className="px-6 py-3.5">{t('col_type')}</th>
                           <th className="px-6 py-3.5">{t('product')}</th>
                           <th className="px-6 py-3.5 text-right">{t('col_qty')}</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                       {loading || !data?.recentTransactions ? (
                           <tr><td colSpan={4} className="p-8 text-center text-slate-500">{t('loading')}</td></tr>
                       ) : data.recentTransactions.map((tx: any, i: number) => (
                           <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                               <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{tx.date ? new Date(tx.date).toLocaleDateString('th-TH') : '-'}</td>
                               <td className="px-6 py-3.5">
                                   <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                       tx.type === 'IN'
                                           ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                                           : 'bg-sky-500/12 text-sky-700 border-sky-500/20'
                                   }`}>
                                       {tx.type === 'IN' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                       {tx.type}
                                   </span>
                               </td>
                               <td className="px-6 py-3.5 font-semibold text-slate-900">{tx.product}</td>
                               <td className="px-6 py-3.5 text-right font-bold text-slate-900 tabular-nums">{tx.qty}</td>
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>
       </div>
       </div>
    </div>
  );
}
