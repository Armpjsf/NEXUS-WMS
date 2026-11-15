'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, ShoppingCart, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
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

  const highRisk = data.filter(i => i.riskLevel === 'Very High' || i.riskLevel === 'High');
  const reorderNeeded = data.filter(i => i.reorderAction === 'Reorder Now');

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-[1500px] space-y-7">
        <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-sm font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-[#4cd7f6]/30 hover:bg-[#4cd7f6]/10 hover:text-[#4cd7f6]">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
            {t('back_to_analytics')}
        </Link>
        <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-black/20 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
          <div>
              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#4cd7f6]">Demand Signal</p>
              <h1 className="text-3xl font-black text-[#dee2ec] mb-2">{t('forecast_title')}</h1>
              <p className="text-[#8a92a6] font-semibold">{t('forecast_subtitle')}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="relative z-10 mx-auto mt-7 grid max-w-[1500px] grid-cols-1 gap-6 md:grid-cols-3">
          <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl flex items-center justify-between shadow-lg">
               <div>
                   <div className="text-[#8a92a6] text-xs font-mono font-bold uppercase tracking-wider mb-1">{t('high_risk_items')}</div>
                   <div className="text-3xl font-mono font-black text-[#ff5449]">{highRisk.length}</div>
                   <div className="text-xs font-mono text-[#ffb4ab] mt-2">{t('label_stock')} {"<"} 15-30 {t('ai_unit')}</div>
               </div>
               <AlertTriangle className="w-10 h-10 text-[#ff5449]/30" />
          </div>
          <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl flex items-center justify-between shadow-lg">
               <div>
                   <div className="text-[#8a92a6] text-xs font-mono font-bold uppercase tracking-wider mb-1">{t('reorder_suggestions')}</div>
                   <div className="text-3xl font-mono font-black text-[#facc15]">{reorderNeeded.length}</div>
                   <div className="text-xs font-mono text-[#facc15] mt-2">{t('ai_action_needed')}</div>
               </div>
               <ShoppingCart className="w-10 h-10 text-[#facc15]/30" />
          </div>
           <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl flex items-center justify-between shadow-lg">
               <div>
                   <div className="text-[#8a92a6] text-xs font-mono font-bold uppercase tracking-wider mb-1">{t('total_forecasted')}</div>
                   <div className="text-3xl font-mono font-black text-[#4cd7f6]">{data.length}</div>
                   <div className="text-xs font-mono text-[#4cd7f6] mt-2">{t('ai_total_items')}</div>
               </div>
               <TrendingUp className="w-10 h-10 text-[#4cd7f6]/30" />
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="relative z-10 mx-auto mt-8 grid max-w-[1500px] grid-cols-1 gap-8 lg:grid-cols-2">
          
          {/* Left: Risk Table */}
          <div className="bg-[#171c23] border border-[#30353d] rounded-xl overflow-hidden shadow-sm">
               <div className="p-4 border-b border-[#30353d] flex justify-between items-center">
                   <h3 className="font-bold text-[#dee2ec] flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4 text-[#ff5449]" /> {t('stock_risk_monitor')}
                   </h3>
               </div>
               <div className="max-h-[500px] overflow-y-auto">
                   <table className="w-full text-left text-[#d1c6ab] text-sm">
                       <thead className="bg-[#1b2027] text-[#8a92a6] font-mono text-xs uppercase sticky top-0 border-b border-[#30353d]">
                           <tr>
                               <th className="p-3">{t('product')}</th>
                               <th className="p-3 text-right">{t('label_stock')}</th>
                               <th className="p-3 text-right">{t('days_supply')}</th>
                               <th className="p-3">{t('risk_level')}</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-[#30353d]">
                           {loading ? <tr><td colSpan={4} className="p-4 text-center text-[#8a92a6] font-mono">{t('ai_analyzing')}</td></tr> : 
                            data.slice(0, 50).map((item, i) => (
                               <tr key={i} className="hover:bg-[#1b2027]/60 transition-colors">
                                   <td className="p-3 font-bold text-[#dee2ec] max-w-[150px] truncate" title={item.name}>{item.name}</td>
                                   <td className="p-3 text-right font-mono font-bold text-[#dee2ec]">{item.stock}</td>
                                   <td className="p-3 text-right font-mono">
                                       <div className="text-xs font-bold text-[#dee2ec]">
                                           {item.daysSupply > 365 ? '>1y' : item.daysSupply.toFixed(1) + 'd'}
                                       </div>
                                       <div className="w-16 h-1.5 bg-[#090f15] rounded-full overflow-hidden ml-auto mt-1 border border-[#30353d]">
                                           <div 
                                               className={`h-full transition-all duration-300 ${
                                                   item.daysSupply < 15 ? 'bg-[#ff5449]' : item.daysSupply < 30 ? 'bg-[#facc15]' : 'bg-[#57ec7f]'
                                               }`}
                                               style={{ width: `${Math.min(100, Math.max(8, (item.daysSupply / 30) * 100))}%` }}
                                           />
                                       </div>
                                   </td>
                                   <td className="p-3">
                                       <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-mono font-bold border ${
                                           item.riskLevel.includes('High') 
                                           ? 'bg-[#ff5449]/15 text-[#ffb4ab] border-[#ff5449]/30' 
                                           : 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30'
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
           <div className="bg-[#171c23] border border-[#30353d] rounded-xl overflow-hidden flex flex-col shadow-sm">
               <div className="p-4 border-b border-[#30353d]">
                   <h3 className="font-bold text-[#dee2ec] flex items-center gap-2">
                       <ShoppingCart className="w-4 h-4 text-[#facc15]" /> {t('automated_po_planner')}
                   </h3>
                   <p className="text-xs text-[#8a92a6] mt-1">{t('avg_demand_desc')}</p>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                   {loading ? <div className="text-center text-[#8a92a6] font-mono py-8">{t('loading')}</div> :
                    reorderNeeded.length === 0 ? <div className="text-center text-[#57ec7f] font-mono py-10">{t('no_urgent_orders')}</div> :
                    reorderNeeded.map((item, i) => (
                       <div key={i} className="bg-[#1b2027] border border-[#30353d] p-4 rounded-xl flex justify-between items-center group hover:border-[#facc15]/40 transition-colors">
                           <div>
                               <div className="font-bold text-[#dee2ec] max-w-[200px] truncate" title={item.name}>{item.name}</div>
                               <div className="text-xs font-mono text-[#8a92a6] mt-0.5">
                                   {t('label_stock')}: <span className="text-[#dee2ec] font-bold">{item.stock}</span> | {t('ai_insight')}: <span className="text-[#4cd7f6]">{item.avgDemand.toFixed(1)}/mo</span>
                               </div>
                           </div>
                           <div className="text-right">
                               <div className="text-[10px] font-mono text-[#8a92a6] uppercase tracking-wider mb-1">{t('ai_suggested_add')}</div>
                               <div className="text-xl font-mono font-bold text-[#facc15]">+{item.suggestedQty}</div>
                           </div>
                       </div>
                   ))}
               </div>
               <div className="p-4 border-t border-[#30353d] bg-[#1b2027]">
                   <button 
                       onClick={() => {
                           if (reorderNeeded.length === 0) return alert(t('no_urgent_orders'));
                           const items = reorderNeeded.map(i => `- ${i.name}: ${i.suggestedQty} units`).join('\n');
                           alert(`✅ ${t('ai_po_success')}:\n\n${items}`);
                       }}
                       className="w-full py-3 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] rounded-xl font-mono font-bold flex justify-center items-center gap-2 transition-transform active:scale-95 shadow-md"
                   >
                       {t('create_po_draft')} <ArrowRight className="w-4 h-4 text-[#1b1600]" />
                   </button>
               </div>
           </div>

      </div>
    </div>
  );
}
