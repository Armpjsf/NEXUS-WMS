'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Calendar, ArrowDownLeft, ArrowUpRight, ClipboardList, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useLanguage } from '@/components/providers/LanguageProvider';

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
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:p-8">
       <AmbientBackground />
       <div className="relative z-10 mx-auto max-w-[1500px] space-y-7">
       <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-sm font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-[#57ec7f]/30 hover:bg-[#57ec7f]/10 hover:text-[#57ec7f] print:hidden">
           <ArrowLeft className="w-4 h-4" /> {t('back_to_analytics')}
       </Link>
       <header className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-black/20 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#57ec7f] via-[#4cd7f6] to-[#facc15]" />
          <div>
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#57ec7f]">Movement Summary</p>
              <h1 className="text-3xl font-black text-[#dee2ec] flex items-center gap-3">
                 <div className="p-2.5 bg-[#57ec7f]/15 border border-[#57ec7f]/30 rounded-xl">
                    <BarChart3 className="w-8 h-8 text-[#57ec7f]" />
                 </div>
                 {t('transaction_summary_title')}
              </h1>
              <p className="text-[#8a92a6] mt-2 font-semibold">{t('transaction_summary_subtitle')}</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
              {/* Date Filter */}
              <div className="flex items-center gap-2 bg-[#1b2027] p-1.5 rounded-xl border border-[#30353d]">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-[#d1c6ab] text-sm px-2 py-1 focus:outline-none" 
                  />
                  <span className="text-[#8a92a6]">-</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-[#d1c6ab] text-sm px-2 py-1 focus:outline-none"
                  />
              </div>

              {/* Granularity Toggle */}
              <div className="bg-[#1b2027] p-1 rounded-xl flex border border-[#30353d]">
                  <button 
                     onClick={() => setGranularity('day')}
                     className={`px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all ${granularity === 'day' ? 'bg-[#57ec7f] text-[#090f15]' : 'text-[#d1c6ab] hover:text-[#57ec7f] hover:bg-[#57ec7f]/10'}`}
                  >
                      {t('daily')}
                  </button>
                  <button 
                     onClick={() => setGranularity('month')}
                     className={`px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all ${granularity === 'month' ? 'bg-[#57ec7f] text-[#090f15]' : 'text-[#d1c6ab] hover:text-[#57ec7f] hover:bg-[#57ec7f]/10'}`}
                  >
                      {t('monthly')}
                  </button>
              </div>
              
              <button
                onClick={handlePrint}
                className="bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] px-4 py-2.5 rounded-xl flex items-center gap-2 font-mono font-bold transition-colors print:hidden shadow-sm"
              >
                <Printer className="w-4 h-4 text-[#1b1600]" />
                <span className="hidden md:inline text-sm">{t('print')}</span>
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
            body, .bg-slate-900, .bg-slate-950 {
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
            .bg-slate-900 {
              border: 1px solid #ccc !important;
              background: white !important;
            }
            .text-white, .text-slate-300, .text-[#8a92a6] {
              color: black !important;
            }
            .recharts-responsive-container {
               height: 300px !important;
            }
          }
       `}</style>

       {/* Comparison Chart */}
       <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl h-[450px] shadow-sm">
           <h3 className="text-[#dee2ec] font-bold mb-6">{t('inbound_vs_outbound')} ({granularity === 'day' ? t('daily') : t('monthly')})</h3>
           {loading || !data || !mounted ? (
               <div className="h-full flex items-center justify-center text-[#8a92a6] font-mono">{t('loading')}</div>
           ) : (
               <ResponsiveContainer width="100%" height="85%">
                   <BarChart data={data.chartData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" opacity={0.5} />
                       <XAxis dataKey="name" stroke="#8a92a6" />
                       <YAxis stroke="#8a92a6" />
                       <Tooltip 
                           contentStyle={{ 
                               backgroundColor: '#090f15', 
                               border: '1px solid #30353d', 
                               borderRadius: '10px', 
                               color: '#dee2ec', 
                               fontFamily: 'monospace' 
                           }}
                           itemStyle={{ color: '#dee2ec' }}
                       />
                       <Legend />
                       <Bar dataKey="in" name={t('legend_inbound')} fill="#57ec7f" radius={[4, 4, 0, 0]} />
                       <Bar dataKey="out" name={t('legend_outbound')} fill="#4cd7f6" radius={[4, 4, 0, 0]} />
                   </BarChart>
               </ResponsiveContainer>
           )}
       </div>

       {/* Weekday Analysis */}
       <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl shadow-sm">
           <h3 className="text-[#dee2ec] font-bold mb-6 flex items-center gap-2">
               <Calendar className="w-5 h-5 text-[#facc15]" />
               {t('weekday_analysis')}
           </h3>
           <div className="h-[300px]">
               {loading || !data ? (
                   <div className="h-full flex items-center justify-center text-[#8a92a6] font-mono">{t('loading')}</div>
               ) : (
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.weekdayAnalysis} layout="vertical">
                             <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" horizontal={false} opacity={0.5} />
                             <XAxis type="number" stroke="#8a92a6" />
                             <YAxis dataKey="day" type="category" stroke="#8a92a6" width={100} />
                             <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#090f15', 
                                    border: '1px solid #30353d', 
                                    borderRadius: '10px', 
                                    color: '#dee2ec', 
                                    fontFamily: 'monospace' 
                                }}
                                itemStyle={{ color: '#dee2ec' }}
                             />
                             <Bar dataKey="qty" name={t('total_out')} fill="#facc15" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                   </ResponsiveContainer>
               )}
           </div>
           <p className="text-xs text-[#8a92a6] mt-4 text-center">
               {t('weekday_analysis_desc')}
           </p>
       </div>

       {/* Transaction Table */}
       <div className="bg-[#171c23] border border-[#30353d] rounded-xl overflow-hidden col-span-1 md:col-span-2 shadow-sm">
           <div className="p-6 border-b border-[#30353d]">
               <h3 className="text-[#dee2ec] font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[#8a92a6]" />
                  {t('recent_transactions_logger')} <span className="text-xs text-[#8a92a6] font-normal">{t('last_100_items')}</span>
               </h3>
           </div>
           <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-[#d1c6ab]">
                   <thead className="bg-[#1b2027] text-[#8a92a6] text-xs font-mono font-bold uppercase border-b border-[#30353d]">
                       <tr>
                           <th className="px-6 py-4">{t('col_date')}</th>
                           <th className="px-6 py-4">{t('col_type')}</th>
                           <th className="px-6 py-4">{t('product')}</th>
                           <th className="px-6 py-4 text-right">{t('col_qty')}</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-[#30353d]">
                       {loading || !data?.recentTransactions ? (
                           <tr><td colSpan={4} className="p-8 text-center text-[#8a92a6] font-mono">{t('loading')}</td></tr>
                       ) : data.recentTransactions.map((t: any, i: number) => (
                           <tr key={i} className="hover:bg-[#1b2027]/60 transition-colors">
                               <td className="px-6 py-4 font-mono text-xs text-[#d1c6ab]">{t.date ? new Date(t.date).toLocaleDateString('th-TH') : '-'}</td>
                               <td className="px-6 py-4">
                                   <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${
                                       t.type === 'IN' ? 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30' : 'bg-[#4cd7f6]/15 text-[#4cd7f6] border-[#4cd7f6]/30'
                                   }`}>
                                       {t.type === 'IN' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                       {t.type}
                                   </span>
                               </td>
                               <td className="px-6 py-4 font-medium text-[#dee2ec]">{t.product}</td>
                               <td className="px-6 py-4 text-right font-mono font-bold text-[#dee2ec]">{t.qty}</td>
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
