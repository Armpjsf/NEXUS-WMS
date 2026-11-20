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
import CountUp from 'react-countup';
import { getApiUrl } from '@/lib/config';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { HYBRID_TOOLTIP_STYLE } from '@/lib/chartTheme';

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
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            {t('back_to_analytics')}
        </Link>

        {/* Open Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end pt-1">
            <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Margin Control
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <DollarSign className="w-7 h-7 text-emerald-600 shrink-0" />
                    <span>{t('profit_title')}</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    {t('profit_subtitle')}
                </p>
            </div>
            <div className="flex gap-2">
                <button className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-full shadow-sm flex items-center gap-2 transition-all text-xs">
                    <Download className="w-3.5 h-3.5" /> {t('profit_export')}
                </button>
            </div>
        </div>

        {loading ? (
            <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
        ) : (
            <>
                {(!data || !data.summary || data.summary.revenue === 0) ? (
                    <div className="nx-glass-card flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
                            <Activity className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{t('no_profit_data')}</h3>
                        <p className="text-slate-600 text-sm max-w-md">
                           Start recording sales (Outbound Transactions) to see your real-time profit analysis here.
                        </p>
                    </div>
                ) : (
                  <>
                    {/* KPIs (3 Glass Cards + 1 Hero Dark Accent Card for Net Profit) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <KpiCard
                            title={t('profit_revenue')}
                            value={data.summary.revenue}
                            icon={DollarSign}
                            tone="sky"
                        />
                        <KpiCard
                            title={t('profit_cogs')}
                            value={data.summary.cogs}
                            icon={Activity}
                            tone="rose"
                        />
                        {/* 1 Hero Dark Accent Card for Net Profit */}
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="nx-dark-accent-card p-6 relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <p className="text-slate-300 font-semibold text-xs uppercase tracking-wider">{t('profit_net')}</p>
                                <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white tabular-nums">
                                <CountUp end={data.summary.profit} prefix="฿" separator="," duration={2} />
                            </div>
                            <p className="text-[11px] text-emerald-400 font-medium mt-1.5">Net FIFO Margin Earned</p>
                        </motion.div>

                        <KpiCard
                            title={t('profit_margin')}
                            value={data.summary.margin}
                            icon={PieIcon}
                            tone="amber"
                            isPercent
                        />
                    </div>

                    {/* Main Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[420px]">
                        <div className="lg:col-span-2 nx-glass-card p-6 flex flex-col h-[380px] lg:h-full">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                                    <Activity className="w-4 h-4 text-emerald-600" /> {t('profit_trend')}
                                </h3>
                                <div className="flex items-center gap-4 text-xs font-semibold">
                                    <span className="flex items-center gap-1.5 text-sky-700">
                                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> {t('profit_revenue')}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-emerald-700">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {t('profit_net')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.22}/>
                                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.28}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} dy={8} />
                                        <YAxis axisLine={false} tickLine={false} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `฿${val/1000}k`} />
                                        <Tooltip contentStyle={HYBRID_TOOLTIP_STYLE} />
                                        <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                        <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" name="Profit" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="nx-glass-card p-6 overflow-hidden flex flex-col max-h-[420px]">
                             <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-base">
                                <TrendingUp className="w-4 h-4 text-amber-600" /> {t('profit_top_products')}
                            </h3>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {data?.topProducts.map((p: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3.5 bg-white/75 border border-slate-200/80 rounded-2xl">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 tabular-nums">
                                                {i+1}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 text-sm truncate">{p.sku}</p>
                                                <p className="text-[11px] text-slate-500">{t('profit_contribution')}</p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-emerald-700 text-sm tabular-nums shrink-0 ml-2">
                                            {formatCurrency(p.profit)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent Transaction Table */}
                    <div className="nx-glass-card overflow-hidden">
                         <div className="p-5 border-b border-slate-200/70">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                                <Calendar className="w-4 h-4 text-slate-500" /> {t('profit_analysis_table')}
                            </h3>
                         </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-700">
                                <thead className="bg-slate-50/80 sticky top-0 text-slate-600 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200/80">
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
                                        <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                                            <td className="p-4 font-mono text-xs text-slate-500">{h.transaction.date}</td>
                                            <td className="p-4 font-semibold text-slate-900">{h.transaction.sku}</td>
                                            <td className="p-4 text-right font-medium text-slate-700 tabular-nums">{formatCurrency(h.transaction.price)}</td>
                                            <td className="p-4 text-right text-slate-500 tabular-nums">
                                                {(h.cogs / h.transaction.qty).toFixed(2)}
                                            </td>
                                            <td className={`p-4 text-right font-bold tabular-nums ${h.profit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                {formatCurrency(h.profit)}
                                            </td>
                                            <td className="p-4 text-right tabular-nums">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                                    h.margin > 20 ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' :
                                                    h.margin > 0 ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' : 'bg-rose-500/12 text-rose-700 border-rose-500/25'
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

function KpiCard({ title, value, icon: Icon, tone, isPercent = false }: { title: string; value: number; icon: any; tone: 'sky' | 'rose' | 'amber'; isPercent?: boolean }) {
    const iconTone = tone === 'sky'
        ? 'bg-sky-500/12 border-sky-500/20 text-sky-700'
        : tone === 'rose'
        ? 'bg-rose-500/12 border-rose-500/20 text-rose-600'
        : 'bg-amber-500/15 border-amber-500/25 text-amber-700';

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="nx-glass-card p-6 relative overflow-hidden"
        >
            <div className="flex items-start justify-between mb-3">
                <p className="text-slate-600 font-semibold text-xs uppercase tracking-wider">{title}</p>
                <div className={`p-2.5 rounded-2xl border ${iconTone}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums">
                {isPercent ? (
                    <CountUp end={value} decimals={1} suffix="%" duration={2} />
                ) : (
                    <CountUp end={value} prefix="฿" separator="," duration={2} />
                )}
            </div>
        </motion.div>
    );
}
