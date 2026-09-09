'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  PieChart as PieIcon,
  Calendar,
  Download,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import CountUp from 'react-countup';
import { getApiUrl } from '@/lib/config';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function ProfitAnalyticsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
     fetch(getApiUrl('/api/analytics/profit'))
        .then(res => res.json())
        .then(json => {
            setData(json);
            
            // Process Chart Data (Group by Date)
            const grouped = new Map();
            if (json.history) {
              json.history.forEach((h: any) => {
                  const date = h.transaction.date;
                  if (!grouped.has(date)) grouped.set(date, { date, profit: 0, revenue: 0 });
                  const d = grouped.get(date);
                  d.profit += h.profit;
                  d.revenue += (h.transaction.qty * h.transaction.price);
              });
              
              setChartData(Array.from(grouped.values()).sort((a: any, b: any) => 
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              ));
            }

            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);

  return (
    <div className="min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[1500px] mx-auto space-y-7">
        
        <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
            {t('back_to_analytics')}
        </Link>
        
        {/* Header */}
        <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-white/85 p-6 shadow-xl shadow-emerald-900/10 backdrop-blur-xl flex flex-col gap-5 md:flex-row md:justify-between md:items-end">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-blue-600 to-amber-500" />
            <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Margin Control</p>
                <h1 className="text-3xl md:text-4xl font-black text-slate-950 tracking-tight flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 rounded-2xl ring-1 ring-emerald-200">
                        <DollarSign className="w-8 h-8 text-emerald-600" />
                    </div>
                    {t('profit_title')}
                </h1>
                <p className="text-slate-500 font-medium mt-2 text-lg pl-1">
                    {t('profit_subtitle')}
                </p>
            </div>
            <div className="flex gap-2">
                <button className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" /> {t('profit_export')}
                </button>
            </div>
        </div>

        {loading ? (
            <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        ) : (
            <>
                {(!data || !data.summary || data.summary.revenue === 0) ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/40 shadow-sm text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Activity className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">{t('no_profit_data')}</h3>
                        <p className="text-slate-500 max-w-md mb-6">
                           Start recording sales (Outbound Transactions) to see your real-time profit analysis here.
                        </p>
                    </div>
                ) : (
                  <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <KpiCard 
                            title={t('profit_revenue')} 
                            value={data.summary.revenue} 
                            icon={DollarSign}
                            color="bg-blue-500"
                        />
                        <KpiCard 
                            title={t('profit_cogs')} 
                            value={data.summary.cogs} 
                            icon={Activity}
                            color="bg-rose-500"
                        />
                        <KpiCard 
                            title={t('profit_net')} 
                            value={data.summary.profit} 
                            icon={TrendingUp}
                            color="bg-emerald-500"
                        />
                        <KpiCard 
                            title={t('profit_margin')} 
                            value={data.summary.margin} 
                            icon={PieIcon}
                            color="bg-purple-500"
                            isPercent
                        />
                    </div>

                    {/* Main Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[400px]">
                        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-sm flex flex-col">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-emerald-500" /> {t('profit_trend')}
                            </h3>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `฿${val/1000}k`} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
                             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" /> {t('profit_top_products')}
                            </h3>
                            <div className="flex-1 overflow-auto space-y-4 pr-2">
                                {data?.topProducts.map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                                                {i+1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{p.sku}</p>
                                                <p className="text-xs text-slate-500">{t('profit_contribution')}</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-emerald-600">
                                            {formatCurrency(p.profit)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent Transaction Table */}
                    <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-sm overflow-hidden">
                         <div className="p-6 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-slate-500" /> {t('profit_analysis_table')}
                            </h3>
                         </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4">{t('date')}</th>
                                        <th className="p-4">{t('col_product_name')}</th>
                                        <th className="p-4 text-right">{t('col_unit_price')}</th>
                                        <th className="p-4 text-right">{t('col_fifo_cost')}</th>
                                        <th className="p-4 text-right">{t('col_profit')}</th>
                                        <th className="p-4 text-right">{t('col_margin')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data?.history.slice(0, 20).map((h: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-medium text-slate-700">{h.transaction.date}</td>
                                            <td className="p-4 font-bold text-slate-800">{h.transaction.sku}</td>
                                            <td className="p-4 text-right text-slate-600">{formatCurrency(h.transaction.price)}</td>
                                            <td className="p-4 text-right text-slate-500 font-mono">
                                                {(h.cogs / h.transaction.qty).toFixed(2)}
                                            </td>
                                            <td className={`p-4 text-right font-bold ${h.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {formatCurrency(h.profit)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    h.margin > 20 ? 'bg-emerald-100 text-emerald-700' : 
                                                    h.margin > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {h.margin.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>
                  </>
                )}
            </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, isPercent = false }: any) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border border-white/50 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group"
        >
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color.replace('bg-', 'text-')}`}>
                <Icon className="w-24 h-24" />
            </div>
            
            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mb-4 shadow-lg shadow-gray-200`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-slate-500 font-bold text-sm uppercase tracking-wider">{title}</p>
                <div className="text-3xl font-black text-slate-800 mt-1">
                    {isPercent ? (
                        <CountUp end={value} decimals={1} suffix="%" duration={2} />
                    ) : (
                        <CountUp end={value} prefix="฿" separator="," duration={2} />
                    )}
                </div>
            </div>
        </motion.div>
    )
}
