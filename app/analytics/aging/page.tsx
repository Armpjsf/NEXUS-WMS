'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, Download, ArrowLeft, Layers, X, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { cn } from '@/lib/utils';

export default function AgingPage() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90);
  const [viewMode, setViewMode] = useState<'DEADSTOCK' | 'ALL'>('DEADSTOCK');
  const [selectedProductForFifo, setSelectedProductForFifo] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchData() {
        try {
            const res = await fetch('/api/analytics/aging');
            const json = await res.json();
            if (Array.isArray(json)) setData(json);
        } catch (error) {
            console.error("Failed to fetch aging", error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, []);

  void mounted;

  // Filter Logic: Cumulative (>= selected period)
  const deadstock = data.filter(item => item.daysSinceLastSale >= period && item.stock > 0);
  const deadstockValue = deadstock.reduce((sum, item) => sum + item.value, 0);

  // Fixed True Deadstock (>= 365 days)
  const trueDeadstock = data.filter(item => item.daysSinceLastSale >= 365 && item.stock > 0);
  const trueDeadstockValue = trueDeadstock.reduce((sum, item) => sum + item.value, 0);

  const tableData = viewMode === 'DEADSTOCK' ? deadstock : data;

  // FIFO Aging Tier Visual Distribution Calculations
  const fifoSummary = tableData.reduce((acc, item) => {
    const t0 = item.fifoTiers?.tier_0_30 || 0;
    const t31 = item.fifoTiers?.tier_31_60 || 0;
    const t61 = item.fifoTiers?.tier_61_90 || 0;
    const t90 = (item.fifoTiers?.tier_91_180 || 0) + (item.fifoTiers?.tier_180_plus || 0);
    acc.tier0 += t0;
    acc.tier31 += t31;
    acc.tier61 += t61;
    acc.tier90 += t90;
    return acc;
  }, { tier0: 0, tier31: 0, tier61: 0, tier90: 0 });

  const totalFifoUnits = fifoSummary.tier0 + fifoSummary.tier31 + fifoSummary.tier61 + fifoSummary.tier90;

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ['Product Name,Location,Stock,Value (THB),Movement Status,Last Sold,Days Since Sale'];
    const rows = tableData.map(item =>
        `"${item.name.replace(/"/g, '""')}","${item.location || '-'}","${item.stock}","${item.value}","${item.movementStatus || 'Deadstock'}","${item.lastSoldDate || 'Never'}","${item.daysSinceLastSale}"`
    );
    const csvContent = BOM + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aging_report_${viewMode.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Aging Risk
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                   <Clock className="w-7 h-7 text-amber-600 shrink-0" />
                   <span>{t('aging_title')}</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('aging_subtitle')}</p>
             </div>

            <div className="bg-white/65 backdrop-blur-md border border-white/85 p-1 rounded-full flex flex-wrap gap-1 shadow-xs">
                {[30, 60, 90, 180, 365].map((d) => {
                    const getPeriodLabel = (val: number) => {
                      if (val === 30) return language === 'en' ? '30 Days+' : '30 วัน+';
                      if (val === 60) return language === 'en' ? '60 Days+' : '60 วัน+';
                      if (val === 90) return language === 'en' ? '90 Days+' : '90 วัน+';
                      if (val === 180) return language === 'en' ? '180 Days+' : '180 วัน+';
                      return language === 'en' ? '1 Year+ (Dead)' : '1 ปี+ (Dead)';
                    };
                    return (
                        <button
                           key={d}
                           onClick={() => setPeriod(d)}
                           className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all tabular-nums ${
                               period === d
                               ? 'bg-slate-900 text-white shadow-xs'
                               : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                           }`}
                        >
                            {getPeriodLabel(d)}
                        </button>
                    );
                })}
            </div>
       </div>

       {/* KPIs (2 Glass Cards + 1 Hero Dark Accent Alert Card) */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
           <div className="nx-glass-card p-6">
               <h3 className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">
                   {language === 'en' ? `Stagnant Items (> ${period} Days)` : `สินค้าไม่เคลื่อนไหวเกิน ${period} วัน`}
               </h3>
               <div className="text-3xl font-bold text-slate-900 flex items-baseline gap-2 tabular-nums">
                   {loading ? '...' : deadstock.length.toLocaleString()}
                   <span className="text-xs font-medium text-slate-500">{t('ai_unit')}</span>
               </div>
               <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-500/15 border border-amber-500/25 px-3 py-1 rounded-full">
                   <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                   {language === 'en' ? `Inactive for at least ${period} days` : `ไม่มีการเคลื่อนไหวอย่างน้อย ${period} วันขึ้นไป`}
               </div>
           </div>

           <div className="nx-glass-card p-6">
               <h3 className="text-sky-700 text-xs font-semibold uppercase tracking-wider mb-2">
                   {language === 'en' ? `Stagnant Value (> ${period} Days)` : `มูลค่าสินค้าไม่เคลื่อนไหว (> ${period} วัน)`}
               </h3>
               <div className="text-3xl font-bold text-slate-900 flex items-baseline gap-2 tabular-nums">
                   ฿{loading ? '...' : deadstockValue.toLocaleString()}
                   <span className="text-xs font-medium text-slate-500">THB</span>
               </div>
               <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-sky-800 bg-sky-500/12 border border-sky-500/20 px-3 py-1 rounded-full">
                   <Clock className="w-3.5 h-3.5 text-sky-600" />
                   {language === 'en' ? 'Capital tied up in this range' : 'ทุนจมที่ควรเร่งระบายในกลุ่มนี้'}
               </div>
           </div>

           {/* 1 Hero Dark Accent Card for True Deadstock */}
           <div className="nx-dark-accent-card p-6 relative overflow-hidden">
               <h3 className="text-rose-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-2">
                   <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                   {language === 'en' ? 'True Deadstock (1 Year+)' : 'สินค้าค้างสต็อกแท้ (Deadstock 1 ปี+)'}
               </h3>
               <div className="text-3xl font-bold text-white flex items-baseline gap-2 tabular-nums">
                   {loading ? '...' : trueDeadstock.length.toLocaleString()}
                   <span className="text-xs font-medium text-slate-400">{t('ai_unit')}</span>
               </div>
               <div className="mt-4 text-xs text-slate-300 tabular-nums">
                   {language === 'en' ? 'Total Frozen Capital: ' : 'เงินจมสะสมวิกฤต: '}
                   <span className="text-rose-300 font-bold text-sm">฿{loading ? '...' : trueDeadstockValue.toLocaleString()}</span>
               </div>
           </div>
       </div>

       {/* FIFO Aging Tier Visual Distribution Strip */}
       <div className="nx-glass-card p-6 space-y-4">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
               <div>
                   <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                       <Layers className="w-4 h-4 text-amber-600" />
                       ภาพรวมการกระจายอายุสต็อก (FIFO Aging Tier Distribution)
                   </h4>
                   <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                       แสดงสัดส่วนอายุสินค้าทั้งหมด {totalFifoUnits.toLocaleString()} ชิ้นในมุมมอง {viewMode}
                   </p>
               </div>
               <div className="text-xs font-semibold text-slate-700 bg-white/80 px-3.5 py-1.5 rounded-full border border-slate-200 tabular-nums">
                   Total Tracked: <span className="font-bold text-slate-900">{totalFifoUnits.toLocaleString()}</span> units
               </div>
           </div>

           {/* Multi-segment Progress Bar */}
           <div className="h-3.5 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
               {totalFifoUnits > 0 ? (
                   <>
                       <div
                           style={{ width: `${(fifoSummary.tier0 / totalFifoUnits) * 100}%` }}
                           className="bg-emerald-500 h-full transition-all duration-500"
                           title={`≤30d: ${fifoSummary.tier0} (${((fifoSummary.tier0 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                       <div
                           style={{ width: `${(fifoSummary.tier31 / totalFifoUnits) * 100}%` }}
                           className="bg-sky-500 h-full transition-all duration-500"
                           title={`31-60d: ${fifoSummary.tier31} (${((fifoSummary.tier31 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                       <div
                           style={{ width: `${(fifoSummary.tier61 / totalFifoUnits) * 100}%` }}
                           className="bg-amber-500 h-full transition-all duration-500"
                           title={`61-90d: ${fifoSummary.tier61} (${((fifoSummary.tier61 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                       <div
                           style={{ width: `${(fifoSummary.tier90 / totalFifoUnits) * 100}%` }}
                           className="bg-rose-500 h-full transition-all duration-500"
                           title={`>90d: ${fifoSummary.tier90} (${((fifoSummary.tier90 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                   </>
               ) : (
                   <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                       No FIFO Data
                   </div>
               )}
           </div>

           {/* Legend Cards */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
               <div className="bg-white/75 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-emerald-500" />
                       <span className="text-xs font-bold text-slate-800">≤ 30 วัน</span>
                   </div>
                   <div className="text-right tabular-nums">
                       <div className="text-xs font-bold text-emerald-700">{fifoSummary.tier0.toLocaleString()}</div>
                       <div className="text-[10px] text-slate-500">{totalFifoUnits > 0 ? ((fifoSummary.tier0 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>

               <div className="bg-white/75 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-sky-500" />
                       <span className="text-xs font-bold text-slate-800">31 - 60 วัน</span>
                   </div>
                   <div className="text-right tabular-nums">
                       <div className="text-xs font-bold text-sky-700">{fifoSummary.tier31.toLocaleString()}</div>
                       <div className="text-[10px] text-slate-500">{totalFifoUnits > 0 ? ((fifoSummary.tier31 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>

               <div className="bg-white/75 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-amber-500" />
                       <span className="text-xs font-bold text-slate-800">61 - 90 วัน</span>
                   </div>
                   <div className="text-right tabular-nums">
                       <div className="text-xs font-bold text-amber-700">{fifoSummary.tier61.toLocaleString()}</div>
                       <div className="text-[10px] text-slate-500">{totalFifoUnits > 0 ? ((fifoSummary.tier61 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>

               <div className="bg-white/75 border border-slate-200/80 p-3 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-rose-500" />
                       <span className="text-xs font-bold text-slate-800">&gt; 90 วัน</span>
                   </div>
                   <div className="text-right tabular-nums">
                       <div className="text-xs font-bold text-rose-600">{fifoSummary.tier90.toLocaleString()}</div>
                       <div className="text-[10px] text-slate-500">{totalFifoUnits > 0 ? ((fifoSummary.tier90 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>
           </div>
       </div>

       {/* Detailed Table */}
       <div className="nx-glass-card overflow-hidden">
           <div className="p-5 border-b border-slate-200/70 flex flex-wrap justify-between items-center gap-3">
               <div className="flex flex-wrap items-center gap-3">
                   <h3 className="text-slate-900 font-bold text-base">{t('inventory_list')}</h3>
                   <div className="flex bg-slate-100 rounded-full p-1 border border-slate-200">
                       <button
                         onClick={() => setViewMode('DEADSTOCK')}
                         className={`px-3.5 py-1 text-xs rounded-full font-semibold transition-colors ${viewMode === 'DEADSTOCK' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                       >
                         {t('deadstock_only')}
                       </button>
                       <button
                         onClick={() => setViewMode('ALL')}
                         className={`px-3.5 py-1 text-xs rounded-full font-semibold transition-colors ${viewMode === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                       >
                         {t('show_all')}
                       </button>
                   </div>
               </div>
               <button
                 onClick={exportCSV}
                 className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full flex items-center gap-2 text-xs font-semibold transition-all shadow-xs"
               >
                   <Download className="w-3.5 h-3.5" /> {t('export_csv')}
               </button>
           </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50/80 sticky top-0 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
                        <tr>
                            <th className="px-6 py-4">{t('product')}</th>
                            <th className="px-6 py-4">{t('delivery_location')}</th>
                            <th className="px-6 py-4 text-right">{t('label_stock')}</th>
                            <th className="px-6 py-4 text-right">{t('total_value')}</th>
                            <th className="px-6 py-4 text-center">{t('col_status')}</th>
                            <th className="px-6 py-4">กระจายอายุสต็อก (FIFO Tiers)</th>
                            <th className="px-6 py-4">{t('col_last_sold')}</th>
                            <th className="px-6 py-4 text-right">{t('col_days_inactive')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">{t('loading')}</td></tr>
                        ) : tableData.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">{t('no_products_found')}</td></tr>
                        ) : (
                            tableData.map((item) => (
                                <tr key={item.id} className="hover:bg-emerald-50/40 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-slate-900">{item.name}</td>
                                    <td className="px-6 py-4 font-mono text-xs font-semibold text-sky-700">{item.location || '-'}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">{item.stock.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-700 tabular-nums">฿{item.value.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                         <span className={cn(
                                             "text-[10px] px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap border",
                                             (item.movementStatus || 'Deadstock') === 'Fast Moving' ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' :
                                             (item.movementStatus || 'Deadstock') === 'Normal Moving' ? 'bg-sky-500/12 text-sky-700 border-sky-500/20' :
                                             (item.movementStatus || 'Deadstock') === 'Slow Moving' ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' :
                                             (item.movementStatus || 'Deadstock') === 'Very Slow Moving' ? 'bg-amber-500/15 text-amber-800 border-amber-500/25' :
                                             'bg-rose-500/12 text-rose-700 border-rose-500/25'
                                         )}>
                                             {item.movementStatus || 'Deadstock'}
                                         </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {item.fifoTiers && (
                                                <>
                                                    {item.fifoTiers.tier_0_30 > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 font-semibold tabular-nums" title="อายุไม่เกิน 30 วัน">
                                                            ≤30d: {item.fifoTiers.tier_0_30}
                                                        </span>
                                                    )}
                                                    {item.fifoTiers.tier_31_60 > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/12 border border-sky-500/20 text-sky-700 font-semibold tabular-nums" title="อายุ 31-60 วัน">
                                                            31-60d: {item.fifoTiers.tier_31_60}
                                                        </span>
                                                    )}
                                                    {item.fifoTiers.tier_61_90 > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-800 font-semibold tabular-nums" title="อายุ 61-90 วัน">
                                                            61-90d: {item.fifoTiers.tier_61_90}
                                                        </span>
                                                    )}
                                                    {(item.fifoTiers.tier_91_180 + item.fifoTiers.tier_180_plus) > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/12 border border-rose-500/25 text-rose-700 font-semibold tabular-nums" title="อายุมากกว่า 90 วัน">
                                                            &gt;90d: {item.fifoTiers.tier_91_180 + item.fifoTiers.tier_180_plus}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {item.fifoLayers && item.fifoLayers.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedProductForFifo(item)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-slate-900 bg-amber-500/12 hover:bg-amber-500/25 px-2.5 py-0.5 rounded-full border border-amber-500/25 transition-colors ml-1 tabular-nums"
                                                >
                                                    <Layers className="w-3 h-3 text-amber-600" />
                                                    {item.fifoLayers.length} ล็อต
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                        {item.lastSoldDate || t('never_sold')}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-rose-600 tabular-nums">
                                        {item.daysSinceLastSale > 9000 ? t('never_sold') : `${item.daysSinceLastSale} days`}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* FIFO Lot Detail Modal */}
        {selectedProductForFifo && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setSelectedProductForFifo(null)}>
                <div className="bg-white border border-slate-200 rounded-[22px] w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col text-slate-900" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/80 shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-amber-600" />
                                รายละเอียดล็อต FIFO: {selectedProductForFifo.name}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                                สต็อกคงเหลือทั้งหมด {selectedProductForFifo.stock} ชิ้น · มูลค่ารวม ฿{selectedProductForFifo.value.toLocaleString()}
                            </p>
                        </div>
                        <button onClick={() => setSelectedProductForFifo(null)} className="p-2 hover:bg-slate-200/70 rounded-full text-slate-500 hover:text-slate-900 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-3">
                        {selectedProductForFifo.fifoLayers && selectedProductForFifo.fifoLayers.length > 0 ? (
                            selectedProductForFifo.fifoLayers.map((layer: any, idx: number) => {
                                const layerVal = (layer.qty || 0) * (selectedProductForFifo.price || 0);
                                return (
                                    <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-500" />
                                                <span className="font-bold text-slate-900 text-sm">รับเข้าเมื่อ: {layer.date}</span>
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                อายุสต็อกล็อตนี้: <span className="font-bold text-slate-900 tabular-nums">{layer.daysOld} วัน</span>
                                            </div>
                                        </div>
                                        <div className="text-right tabular-nums">
                                            <div className="text-sm font-bold text-slate-900">{layer.qty} ชิ้น</div>
                                            <div className="text-xs font-semibold text-emerald-700">฿{layerVal.toLocaleString()}</div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-slate-500">ไม่พบล็อตการรับเข้าในประวัติ</div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                        <button
                            onClick={() => setSelectedProductForFifo(null)}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-full transition-all"
                        >
                            ปิดหน้าต่าง
                        </button>
                    </div>
                </div>
            </div>
        )}
     </div>
   </div>
  );
}
