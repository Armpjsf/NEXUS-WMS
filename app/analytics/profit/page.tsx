'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Activity,
  PieChart as PieIcon,
  Calendar,
  Download,
  ArrowLeft,
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
        
        <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-sm font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-[#57ec7f]/40 hover:bg-[#57ec7f]/10 hover:text-[#57ec7f]">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
            {t('back_to_analytics')}
        </Link>
        
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-black/20 backdrop-blur-xl flex flex-col gap-5 md:flex-row md:justify-between md:items-end">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#57ec7f] via-[#4cd7f6] to-[#facc15]" />
            <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#57ec7f]">Margin Control</p>
                <h1 className="text-3xl md:text-4xl font-black text-[#dee2ec] tracking-tight flex items-center gap-3">
                    <div className="p-3 bg-[#57ec7f]/15 border border-[#57ec7f]/30 rounded-xl">
                        <DollarSign className="w-8 h-8 text-[#57ec7f]" />
                    </div>
                    {t('profit_title')}
                </h1>
                <p className="text-[#8a92a6] font-medium mt-2 text-lg pl-1">
                    {t('profit_subtitle')}
                </p>
            </div>
            <div className="flex gap-2">
                <button className="bg-[#1b2027] hover:bg-[#252a32] text-[#d1c6ab] font-mono font-bold py-3 px-6 rounded-xl shadow-sm border border-[#30353d] flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4 text-[#facc15]" /> {t('profit_export')}
                </button>
            </div>
        </div>

        {loading ? (
            <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#57ec7f]"></div>
            </div>
        ) : (
            <>
                {(!data || !data.summary || data.summary.revenue === 0) ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-[#171c23] backdrop-blur-xl rounded-xl border border-[#30353d] shadow-sm text-center">
                        <div className="w-20 h-20 bg-[#252a32] rounded-full flex items-center justify-center mb-6">
                            <Activity className="w-10 h-10 text-[#8a92a6]" />
                        </div>
                        <h3 className="text-xl font-bold text-[#d1c6ab] mb-2">{t('no_profit_data')}</h3>
                        <p className="text-[#8a92a6] max-w-md mb-6">
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
                            color="bg-[#4cd7f6]"
                            iconColor="text-[#090f15]"
                        />
                        <KpiCard 
                            title={t('profit_cogs')} 
                            value={data.summary.cogs} 
                            icon={Activity}
                            color="bg-[#ff5449]"
                            iconColor="text-white"
                        />
                        <KpiCard 
                            title={t('profit_net')} 
                            value={data.summary.profit} 
                            icon={TrendingUp}
                            color="bg-[#57ec7f]"
                            iconColor="text-[#090f15]"
                        />
                        <KpiCard 
                            title={t('profit_margin')} 
                            value={data.summary.margin} 
                            icon={PieIcon}
                            color="bg-[#facc15]"
                            iconColor="text-[#1b1600]"
                            isPercent
                        />
                    </div>

                    {/* Main Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[400px]">
                        <div className="lg:col-span-2 bg-[#171c23] backdrop-blur-xl border border-[#30353d] p-6 rounded-xl shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-[#dee2ec] flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-[#57ec7f]" /> {t('profit_trend')}
                                </h3>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                    <span className="flex items-center gap-1.5 text-[#4cd7f6]">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-[#4cd7f6]" /> {t('profit_revenue')}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[#57ec7f]">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-[#57ec7f]" /> {t('profit_net')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4cd7f6" stopOpacity={0.25}/>
                                                <stop offset="95%" stopColor="#4cd7f6" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#57ec7f" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#57ec7f" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.07)" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#8a92a6', fontSize: 12}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#8a92a6', fontSize: 12}} tickFormatter={(val) => `฿${val/1000}k`} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#090f15', 
                                                border: '1px solid #30353d', 
                                                borderRadius: '10px', 
                                                color: '#dee2ec', 
                                                fontFamily: 'monospace' 
                                            }}
                                        />
                                        <Area type="monotone" dataKey="revenue" stroke="#4cd7f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                        <Area type="monotone" dataKey="profit" stroke="#57ec7f" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" name="Profit" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="bg-[#171c23] backdrop-blur-xl border border-[#30353d] p-6 rounded-xl shadow-sm overflow-hidden flex flex-col">
                             <h3 className="font-bold text-[#dee2ec] mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-[#facc15]" /> {t('profit_top_products')}
                            </h3>
                            <div className="flex-1 overflow-auto space-y-4 pr-2">
                                {data?.topProducts.map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-[#1b2027] border border-[#30353d]/50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#57ec7f]/15 border border-[#57ec7f]/30 text-[#57ec7f] flex items-center justify-center font-mono font-bold text-sm">
                                                {i+1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#dee2ec] text-sm">{p.sku}</p>
                                                <p className="text-xs text-[#8a92a6]">{t('profit_contribution')}</p>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-[#57ec7f]">
                                            {formatCurrency(p.profit)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent Transaction Table */}
                    <div className="bg-[#171c23] backdrop-blur-xl border border-[#30353d] rounded-xl shadow-sm overflow-hidden">
                         <div className="p-6 border-b border-[#30353d]">
                            <h3 className="font-bold text-[#dee2ec] flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-[#8a92a6]" /> {t('profit_analysis_table')}
                            </h3>
                         </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#1b2027] text-[#8a92a6] uppercase font-mono font-bold text-xs border-b border-[#30353d]">
                                    <tr>
                                        <th className="p-4">{t('date')}</th>
                                        <th className="p-4">{t('col_product_name')}</th>
                                        <th className="p-4 text-right">{t('col_unit_price')}</th>
                                        <th className="p-4 text-right">{t('col_fifo_cost')}</th>
                                        <th className="p-4 text-right">{t('col_profit')}</th>
                                        <th className="p-4 text-right">{t('col_margin')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#30353d]">
                                    {data?.history.slice(0, 20).map((h: any, i: number) => (
                                        <tr key={i} className="hover:bg-[#1b2027]/60 transition-colors">
                                            <td className="p-4 font-mono text-sm text-[#d1c6ab]">{h.transaction.date}</td>
                                            <td className="p-4 font-bold text-[#dee2ec]">{h.transaction.sku}</td>
                                            <td className="p-4 text-right font-mono text-[#d1c6ab]">{formatCurrency(h.transaction.price)}</td>
                                            <td className="p-4 text-right text-[#8a92a6] font-mono">
                                                {(h.cogs / h.transaction.qty).toFixed(2)}
                                            </td>
                                            <td className={`p-4 text-right font-mono font-bold ${h.profit > 0 ? 'text-[#57ec7f]' : 'text-[#ff5449]'}`}>
                                                {formatCurrency(h.profit)}
                                            </td>
                                            <td className="p-4 text-right font-mono">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                                    h.margin > 20 ? 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30' : 
                                                    h.margin > 0 ? 'bg-[#facc15]/15 text-[#facc15] border-[#facc15]/30' : 'bg-[#ff5449]/15 text-[#ffb4ab] border-[#ff5449]/30'
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

function KpiCard({ title, value, icon: Icon, color, iconColor = "text-white", isPercent = false }: any) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#171c23] backdrop-blur-xl border border-[#30353d] p-6 rounded-xl shadow-sm relative overflow-hidden group"
        >
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color.replace('bg-', 'text-')}`}>
                <Icon className="w-24 h-24" />
            </div>
            
            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 shadow-md`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <p className="text-[#8a92a6] font-bold text-xs uppercase tracking-wider">{title}</p>
                <div className="text-3xl font-mono font-black text-[#dee2ec] mt-1">
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
