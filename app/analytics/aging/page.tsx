'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, Download, ArrowLeft, Layers, X, Calendar } from 'lucide-react';
import Link from 'next/link';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function AgingPage() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90); // Default 3 months
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
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:p-8">
       <AmbientBackground />
       
       <div className="relative z-10 mx-auto max-w-[1500px] space-y-7">
         <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-sm font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-[#facc15]/30 hover:bg-[#facc15]/10 hover:text-[#facc15]">
             <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
             {t('back_to_analytics')}
         </Link>

         {/* Header */}
         <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-black/20 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f59e0b] via-[#ff5449] to-[#30353d]" />
             <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#facc15]">Aging Risk</p>
                <h1 className="text-3xl font-black text-[#dee2ec] flex items-center gap-3">
                   <div className="p-2.5 bg-[#facc15]/15 border border-[#facc15]/30 rounded-xl">
                      <Clock className="w-8 h-8 text-[#facc15]" />
                   </div>
                   {t('aging_title')}
                </h1>
                <p className="text-[#8a92a6] font-medium mt-2">{t('aging_subtitle')}</p>
             </div>
           
            <div className="bg-[#1b2027] border border-[#30353d] p-1.5 rounded-xl flex flex-wrap gap-1">
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
                           className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                               period === d 
                               ? 'bg-[#facc15] text-[#1b1600]' 
                               : 'text-[#d1c6ab] hover:text-[#facc15] hover:bg-[#facc15]/10'
                           }`}
                        >
                            {getPeriodLabel(d)}
                        </button>
                    );
                })}
            </div>
       </div>

       {/* KPIs */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl shadow-lg">
               <h3 className="text-[#facc15] text-xs font-mono font-bold uppercase tracking-wider mb-2">
                   {language === 'en' ? `Stagnant Items (> ${period} Days)` : `สินค้าไม่เคลื่อนไหวเกิน ${period} วัน`}
               </h3>
               <div className="text-3xl font-mono font-black text-[#dee2ec] flex items-center gap-2">
                   {loading ? '...' : deadstock.length}
                   <span className="text-xs font-normal text-[#8a92a6]">{t('ai_unit')}</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs font-mono text-[#facc15] bg-[#facc15]/10 border border-[#facc15]/20 px-3 py-1 rounded-md w-fit">
                   <AlertCircle className="w-3.5 h-3.5 text-[#facc15]" />
                   {language === 'en' ? `Inactive for at least ${period} days` : `ไม่มีการเคลื่อนไหวอย่างน้อย ${period} วันขึ้นไป`}
               </div>
           </div>

           <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl shadow-lg">
               <h3 className="text-[#4cd7f6] text-xs font-mono font-bold uppercase tracking-wider mb-2">
                   {language === 'en' ? `Stagnant Value (> ${period} Days)` : `มูลค่าสินค้าไม่เคลื่อนไหว (> ${period} วัน)`}
               </h3>
               <div className="text-3xl font-mono font-black text-[#dee2ec] flex items-center gap-2">
                   ฿{loading ? '...' : deadstockValue.toLocaleString()}
                   <span className="text-xs font-normal text-[#8a92a6]">THB</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs font-mono text-[#d1c6ab] bg-[#252a32] border border-[#30353d] px-3 py-1 rounded-md w-fit">
                   <Clock className="w-3.5 h-3.5 text-[#4cd7f6]" />
                   {language === 'en' ? 'Capital tied up in this range' : 'ทุนจมที่ควรเร่งระบายในกลุ่มนี้'}
               </div>
           </div>

           <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-xl relative overflow-hidden group hover:border-[#ff5449]/40 transition-colors shadow-lg">
               <h3 className="text-[#ffb4ab] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2">
                   <span className="w-2 h-2 rounded-full bg-[#ff5449] animate-pulse" />
                   {language === 'en' ? 'True Deadstock (1 Year+)' : 'สินค้าค้างสต็อกแท้ (Deadstock 1 ปี+)'}
               </h3>
               <div className="text-3xl font-mono font-black text-[#dee2ec] flex items-center gap-2">
                   {loading ? '...' : trueDeadstock.length}
                   <span className="text-xs font-normal text-[#8a92a6]">{t('ai_unit')}</span>
               </div>
               <div className="mt-4 text-xs font-mono text-[#8a92a6]">
                   {language === 'en' ? 'Total Frozen Capital: ' : 'เงินจมสะสมวิกฤต: '}
                   <span className="text-[#ffb4ab] font-bold text-sm">฿{loading ? '...' : trueDeadstockValue.toLocaleString()}</span>
               </div>
           </div>
       </div>

       {/* FIFO Aging Tier Visual Distribution Strip */}
       <div className="bg-[#171c23] border border-[#30353d] rounded-xl p-5 shadow-sm space-y-4">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
               <div>
                   <h4 className="text-sm font-bold text-[#dee2ec] flex items-center gap-2">
                       <Layers className="w-4 h-4 text-[#facc15]" />
                       ภาพรวมการกระจายอายุสต็อก (FIFO Aging Tier Distribution)
                   </h4>
                   <p className="text-xs text-[#8a92a6] mt-0.5">
                       แสดงสัดส่วนอายุสินค้าทั้งหมด {totalFifoUnits.toLocaleString()} ชิ้นในมุมมอง {viewMode}
                   </p>
               </div>
               <div className="text-xs font-mono text-[#d1c6ab] bg-[#1b2027] px-3 py-1.5 rounded-lg border border-[#30353d]">
                   Total Tracked: <span className="font-bold text-[#dee2ec]">{totalFifoUnits.toLocaleString()}</span> units
               </div>
           </div>

           {/* Multi-segment Tactical Progress Bar */}
           <div className="h-4 w-full bg-[#090f15] rounded-lg overflow-hidden flex border border-[#30353d]">
               {totalFifoUnits > 0 ? (
                   <>
                       <div 
                           style={{ width: `${(fifoSummary.tier0 / totalFifoUnits) * 100}%` }}
                           className="bg-[#57ec7f] h-full transition-all duration-500"
                           title={`≤30d: ${fifoSummary.tier0} (${((fifoSummary.tier0 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                       <div 
                           style={{ width: `${(fifoSummary.tier31 / totalFifoUnits) * 100}%` }}
                           className="bg-[#4cd7f6] h-full transition-all duration-500"
                           title={`31-60d: ${fifoSummary.tier31} (${((fifoSummary.tier31 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                       <div 
                           style={{ width: `${(fifoSummary.tier61 / totalFifoUnits) * 100}%` }}
                           className="bg-[#facc15] h-full transition-all duration-500"
                           title={`61-90d: ${fifoSummary.tier61} (${((fifoSummary.tier61 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                       <div 
                           style={{ width: `${(fifoSummary.tier90 / totalFifoUnits) * 100}%` }}
                           className="bg-[#ff5449] h-full transition-all duration-500"
                           title={`>90d: ${fifoSummary.tier90} (${((fifoSummary.tier90 / totalFifoUnits) * 100).toFixed(1)}%)`}
                       />
                   </>
               ) : (
                   <div className="w-full h-full bg-[#1b2027] flex items-center justify-center text-[10px] text-[#8a92a6]">
                       No FIFO Data
                   </div>
               )}
           </div>

           {/* Legend Cards */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
               <div className="bg-[#1b2027] border border-[#30353d] p-3 rounded-lg flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-sm bg-[#57ec7f]" />
                       <span className="text-xs font-mono font-bold text-[#dee2ec]">≤ 30 วัน</span>
                   </div>
                   <div className="text-right">
                       <div className="text-xs font-mono font-bold text-[#57ec7f]">{fifoSummary.tier0.toLocaleString()}</div>
                       <div className="text-[10px] text-[#8a92a6] font-mono">{totalFifoUnits > 0 ? ((fifoSummary.tier0 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>

               <div className="bg-[#1b2027] border border-[#30353d] p-3 rounded-lg flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-sm bg-[#4cd7f6]" />
                       <span className="text-xs font-mono font-bold text-[#dee2ec]">31 - 60 วัน</span>
                   </div>
                   <div className="text-right">
                       <div className="text-xs font-mono font-bold text-[#4cd7f6]">{fifoSummary.tier31.toLocaleString()}</div>
                       <div className="text-[10px] text-[#8a92a6] font-mono">{totalFifoUnits > 0 ? ((fifoSummary.tier31 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>

               <div className="bg-[#1b2027] border border-[#30353d] p-3 rounded-lg flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-sm bg-[#facc15]" />
                       <span className="text-xs font-mono font-bold text-[#dee2ec]">61 - 90 วัน</span>
                   </div>
                   <div className="text-right">
                       <div className="text-xs font-mono font-bold text-[#facc15]">{fifoSummary.tier61.toLocaleString()}</div>
                       <div className="text-[10px] text-[#8a92a6] font-mono">{totalFifoUnits > 0 ? ((fifoSummary.tier61 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>

               <div className="bg-[#1b2027] border border-[#30353d] p-3 rounded-lg flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-sm bg-[#ff5449]" />
                       <span className="text-xs font-mono font-bold text-[#dee2ec]">&gt; 90 วัน</span>
                   </div>
                   <div className="text-right">
                       <div className="text-xs font-mono font-bold text-[#ffb4ab]">{fifoSummary.tier90.toLocaleString()}</div>
                       <div className="text-[10px] text-[#8a92a6] font-mono">{totalFifoUnits > 0 ? ((fifoSummary.tier90 / totalFifoUnits) * 100).toFixed(1) : 0}%</div>
                   </div>
               </div>
           </div>
       </div>

       {/* Detailed Table */}
       <div className="bg-[#171c23] border border-[#30353d] rounded-xl overflow-hidden shadow-sm backdrop-blur-xl">
           <div className="p-6 border-b border-[#30353d] flex justify-between items-center">
               <div className="flex items-center gap-4">
                   <h3 className="text-[#dee2ec] font-bold">{t('inventory_list')}</h3>
                   <div className="flex bg-[#1b2027] rounded-lg p-1 border border-[#30353d]">
                       <button 
                         onClick={() => setViewMode('DEADSTOCK')}
                         className={`px-3 py-1 text-xs rounded-md font-mono font-bold transition-colors ${viewMode === 'DEADSTOCK' ? 'bg-[#ff5449] text-white' : 'text-[#8a92a6] hover:text-[#ffb4ab]'}`}
                       >
                         {t('deadstock_only')}
                       </button>
                       <button 
                         onClick={() => setViewMode('ALL')}
                         className={`px-3 py-1 text-xs rounded-md font-mono font-bold transition-colors ${viewMode === 'ALL' ? 'bg-[#4cd7f6] text-[#090f15]' : 'text-[#8a92a6] hover:text-[#4cd7f6]'}`}
                       >
                         {t('show_all')}
                       </button>
                   </div>
               </div>
               <button onClick={exportCSV} className="text-[#d1c6ab] hover:text-[#facc15] flex items-center gap-2 text-sm font-mono font-bold transition-colors">
                   <Download className="w-4 h-4 text-[#facc15]" /> {t('export_csv')}
               </button>
           </div>
           
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[#d1c6ab]">
                    <thead className="bg-[#1b2027] text-[#8a92a6] text-xs font-mono font-bold uppercase tracking-wider border-b border-[#30353d]">
                        <tr>
                            <th className="px-6 py-4">{t('product')}</th>
                            <th className="px-6 py-4">{t('delivery_location')}</th>
                            <th className="px-6 py-4">{t('label_stock')}</th>
                            <th className="px-6 py-4">{t('total_value')}</th>
                            <th className="px-6 py-4 text-center">{t('col_status')}</th>
                            <th className="px-6 py-4">กระจายอายุสต็อก (FIFO Tiers)</th>
                            <th className="px-6 py-4">{t('col_last_sold')}</th>
                            <th className="px-6 py-4">{t('col_days_inactive')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30353d]">
                        {loading ? (
                            <tr><td colSpan={8} className="p-8 text-center text-[#8a92a6] font-mono">{t('loading')}</td></tr>
                        ) : tableData.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-[#8a92a6] font-mono">{t('no_products_found')}</td></tr>
                        ) : (
                            tableData.map((item) => (
                                <tr key={item.id} className="hover:bg-[#1b2027]/60 transition-colors">
                                    <td className="px-6 py-4 font-bold text-[#dee2ec]">{item.name}</td>
                                    <td className="px-6 py-4 font-mono text-[#4cd7f6]">{item.location || '-'}</td>
                                    <td className="px-6 py-4 font-mono font-bold text-[#dee2ec]">{item.stock.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-mono">฿{item.value.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                         <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold whitespace-nowrap border ${
                                             (item.movementStatus || 'Deadstock') === 'Fast Moving' ? 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30' :
                                             (item.movementStatus || 'Deadstock') === 'Normal Moving' ? 'bg-[#4cd7f6]/15 text-[#4cd7f6] border-[#4cd7f6]/30' :
                                             (item.movementStatus || 'Deadstock') === 'Slow Moving' ? 'bg-[#facc15]/15 text-[#facc15] border-[#facc15]/30' :
                                             (item.movementStatus || 'Deadstock') === 'Very Slow Moving' ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30' :
                                             'bg-[#ff5449]/15 text-[#ffb4ab] border-[#ff5449]/30'
                                         }`}>
                                             {item.movementStatus || 'Deadstock'}
                                         </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {item.fifoTiers && (
                                                <>
                                                    {item.fifoTiers.tier_0_30 > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#57ec7f]/15 border border-[#57ec7f]/30 text-[#57ec7f] font-mono font-semibold" title="อายุไม่เกิน 30 วัน">
                                                            ≤30d: {item.fifoTiers.tier_0_30}
                                                        </span>
                                                    )}
                                                    {item.fifoTiers.tier_31_60 > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#4cd7f6]/15 border border-[#4cd7f6]/30 text-[#4cd7f6] font-mono font-semibold" title="อายุ 31-60 วัน">
                                                            31-60d: {item.fifoTiers.tier_31_60}
                                                        </span>
                                                    )}
                                                    {item.fifoTiers.tier_61_90 > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#facc15]/15 border border-[#facc15]/30 text-[#facc15] font-mono font-semibold" title="อายุ 61-90 วัน">
                                                            61-90d: {item.fifoTiers.tier_61_90}
                                                        </span>
                                                    )}
                                                    {(item.fifoTiers.tier_91_180 + item.fifoTiers.tier_180_plus) > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#ff5449]/15 border border-[#ff5449]/30 text-[#ffb4ab] font-mono font-semibold" title="อายุมากกว่า 90 วัน">
                                                            &gt;90d: {item.fifoTiers.tier_91_180 + item.fifoTiers.tier_180_plus}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {item.fifoLayers && item.fifoLayers.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedProductForFifo(item)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#facc15] hover:text-white bg-[#facc15]/10 hover:bg-[#facc15]/20 px-2 py-0.5 rounded border border-[#facc15]/30 transition-colors ml-1"
                                                >
                                                    <Layers className="w-3 h-3 text-[#facc15]" />
                                                    {item.fifoLayers.length} ล็อต
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-[#8a92a6]">
                                        {item.lastSoldDate || t('never_sold')}
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-[#ffb4ab]">
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedProductForFifo(null)}>
                <div className="bg-[#171c23] border border-[#30353d] rounded-xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-[#30353d] flex justify-between items-center bg-[#171c23] shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-[#dee2ec] flex items-center gap-2">
                                <Layers className="w-5 h-5 text-[#facc15]" />
                                รายละเอียดล็อต FIFO: {selectedProductForFifo.name}
                            </h2>
                            <p className="text-xs text-[#8a92a6] mt-0.5 font-mono">
                                สต็อกคงเหลือทั้งหมด {selectedProductForFifo.stock} ชิ้น · มูลค่ารวม ฿{selectedProductForFifo.value.toLocaleString()}
                            </p>
                        </div>
                        <button onClick={() => setSelectedProductForFifo(null)} className="p-2 hover:bg-[#252a32] rounded-lg text-[#8a92a6] hover:text-[#dee2ec] transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-3">
                        {selectedProductForFifo.fifoLayers && selectedProductForFifo.fifoLayers.length > 0 ? (
                            selectedProductForFifo.fifoLayers.map((layer: any, idx: number) => {
                                const layerVal = (layer.qty || 0) * (selectedProductForFifo.price || 0);
                                return (
                                    <div key={idx} className="p-4 rounded-xl border border-[#30353d] bg-[#1b2027] flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-[#8a92a6]" />
                                                <span className="font-bold text-[#dee2ec] text-sm">รับเข้าเมื่อ: {layer.date}</span>
                                            </div>
                                            <div className="text-xs text-[#8a92a6]">
                                                อายุสต็อกล็อตนี้: <span className="font-mono font-bold text-[#d1c6ab]">{layer.daysOld} วัน</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono font-black text-[#dee2ec]">{layer.qty} ชิ้น</div>
                                            <div className="text-xs font-mono font-semibold text-[#57ec7f]">฿{layerVal.toLocaleString()}</div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-[#8a92a6] font-mono">ไม่พบล็อตการรับเข้าในประวัติ</div>
                        )}
                    </div>
                    <div className="p-4 border-t border-[#30353d] bg-[#1b2027] flex justify-end">
                        <button
                            onClick={() => setSelectedProductForFifo(null)}
                            className="px-5 py-2 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] font-mono font-bold text-sm rounded-lg transition-all"
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
