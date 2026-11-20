'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, ShoppingCart, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function ForecastPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
     async function load() {
         try {
             const res = await fetch('/api/analytics/forecast/advanced');
             const json = await res.json();
             if(Array.isArray(json)) setData(json);
         } catch (e) {
             console.error(e);
         } finally {
             setLoading(false);
         }
     }
     load();
  }, []);

  void mounted;

  const highRisk = data.filter(i => i.riskLevel === 'Very High' || i.riskLevel === 'High');
  const reorderNeeded = data.filter(i => i.reorderAction === 'Reorder Now');

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            {t('back_to_analytics')}
        </Link>

        {/* Open Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1">
          <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                  Demand Signal
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t('forecast_title')}</h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('forecast_subtitle')}</p>
          </div>
        </div>

        {/* KPI Cards (1 Dark Hero Alert Card + 2 Glass Cards) */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Hero Dark Accent Card for High Risk */}
            <div className="nx-dark-accent-card p-6 flex items-center justify-between">
                 <div>
                     <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                         Risk Alert
                     </div>
                     <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1">{t('high_risk_items')}</div>
                     <div className="text-3xl font-bold text-white tabular-nums">{highRisk.length.toLocaleString()}</div>
                     <div className="text-xs text-rose-300 mt-1.5">{t('label_stock')} {"<"} 15-30 {t('ai_unit')}</div>
                 </div>
                 <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                     <AlertTriangle className="w-6 h-6" />
                 </div>
            </div>

            <div className="nx-glass-card p-6 flex items-center justify-between">
                 <div>
                     <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">{t('reorder_suggestions')}</div>
                     <div className="text-3xl font-bold text-amber-600 tabular-nums">{reorderNeeded.length.toLocaleString()}</div>
                     <div className="text-xs font-medium text-amber-700 mt-2">{t('ai_action_needed')}</div>
                 </div>
                 <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-700">
                     <ShoppingCart className="w-6 h-6" />
                 </div>
            </div>

             <div className="nx-glass-card p-6 flex items-center justify-between">
                 <div>
                     <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">{t('total_forecasted')}</div>
                     <div className="text-3xl font-bold text-sky-700 tabular-nums">{data.length.toLocaleString()}</div>
                     <div className="text-xs font-medium text-slate-500 mt-2">{t('ai_total_items')}</div>
                 </div>
                 <div className="p-3 rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                     <TrendingUp className="w-6 h-6" />
                 </div>
            </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Risk Table */}
            <div className="nx-glass-card overflow-hidden">
                 <div className="p-5 border-b border-slate-200/70 flex justify-between items-center">
                     <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                         <AlertTriangle className="w-4 h-4 text-rose-600" /> {t('stock_risk_monitor')}
                     </h3>
                 </div>
                 <div className="max-h-[520px] overflow-y-auto">
                     <table className="w-full text-left text-slate-700 text-sm">
                         <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200/80">
                             <tr>
                                 <th className="p-3.5">{t('product')}</th>
                                 <th className="p-3.5 text-right">{t('label_stock')}</th>
                                 <th className="p-3.5 text-right">{t('days_supply')}</th>
                                 <th className="p-3.5">{t('risk_level')}</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {loading ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">{t('ai_analyzing')}</td></tr> :
                              data.slice(0, 50).map((item, i) => (
                                 <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                                     <td className="p-3.5 font-semibold text-slate-900 max-w-[180px] truncate" title={item.name}>{item.name}</td>
                                     <td className="p-3.5 text-right font-bold text-slate-900 tabular-nums">{item.stock.toLocaleString()}</td>
                                     <td className="p-3.5 text-right tabular-nums">
                                         <div className="text-xs font-bold text-slate-900">
                                             {item.daysSupply > 365 ? '>1y' : item.daysSupply.toFixed(1) + 'd'}
                                         </div>
                                         <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-auto mt-1">
                                             <div
                                                 className={`h-full transition-all duration-300 ${
                                                     item.daysSupply < 15 ? 'bg-rose-500' : item.daysSupply < 30 ? 'bg-amber-500' : 'bg-emerald-500'
                                                 }`}
                                                 style={{ width: `${Math.min(100, Math.max(8, (item.daysSupply / 30) * 100))}%` }}
                                             />
                                         </div>
                                     </td>
                                     <td className="p-3.5">
                                         <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                                             item.riskLevel.includes('High')
                                             ? 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                                             : 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                                         }`}>
                                             {item.riskLevel === 'Very High' ? t('risk_very_high') :
                                              item.riskLevel === 'High' ? t('risk_high') :
                                              item.riskLevel === 'Low' ? t('risk_low') : item.riskLevel}
                                         </span>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
            </div>

            {/* Right: PO Planner */}
             <div className="nx-glass-card overflow-hidden flex flex-col">
                 <div className="p-5 border-b border-slate-200/70">
                     <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                         <ShoppingCart className="w-4 h-4 text-amber-600" /> {t('automated_po_planner')}
                     </h3>
                     <p className="text-xs text-slate-500 mt-1">{t('avg_demand_desc')}</p>
                 </div>
                 <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[450px]">
                     {loading ? <div className="text-center text-slate-500 py-8">{t('loading')}</div> :
                      reorderNeeded.length === 0 ? <div className="text-center text-emerald-700 font-semibold py-10">{t('no_urgent_orders')}</div> :
                      reorderNeeded.map((item, i) => (
                         <div key={i} className="bg-white/75 border border-slate-200/80 p-4 rounded-2xl flex justify-between items-center hover:border-emerald-400 transition-colors">
                             <div>
                                 <div className="font-bold text-slate-900 max-w-[220px] truncate" title={item.name}>{item.name}</div>
                                 <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                                     {t('label_stock')}: <span className="text-slate-900 font-bold">{item.stock}</span> · {t('ai_insight')}: <span className="text-sky-700 font-semibold">{item.avgDemand.toFixed(1)}/mo</span>
                                 </div>
                             </div>
                             <div className="text-right tabular-nums">
                                 <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{t('ai_suggested_add')}</div>
                                 <div className="text-xl font-bold text-emerald-700">+{item.suggestedQty}</div>
                             </div>
                         </div>
                     ))}
                 </div>
                 <div className="p-5 border-t border-slate-200/70 bg-slate-50/60">
                     <button
                         onClick={() => {
                             if (reorderNeeded.length === 0) return alert(t('no_urgent_orders'));
                             const items = reorderNeeded.map(i => `- ${i.name}: ${i.suggestedQty} units`).join('\n');
                             alert(`✅ ${t('ai_po_success')}:\n\n${items}`);
                         }}
                         className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold text-xs flex justify-center items-center gap-2 transition-all shadow-sm"
                     >
                         {t('create_po_draft')} <ArrowRight className="w-4 h-4" />
                     </button>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
}
