'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle, Download, ArrowLeft, Layers, X, Calendar, Package } from 'lucide-react';
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

  // Active items (< 30 days)
  const activeObs = data.filter(item => item.daysSinceLastSale < 30 && item.stock > 0);

  const tableData = viewMode === 'DEADSTOCK' ? deadstock : data;

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
         <Link href="/analytics" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700">
             <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
             {t('back_to_analytics')}
         </Link>

         {/* Header */}
         <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-200 bg-white/85 p-6 shadow-xl shadow-amber-900/10 backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-slate-700" />
             <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Aging Risk</p>
                <h1 className="text-3xl font-black text-slate-950 flex items-center gap-3">
                   <div className="p-2 bg-amber-50 rounded-xl ring-1 ring-amber-200">
                      <Clock className="w-8 h-8 text-amber-500" />
                   </div>
                   {t('aging_title')}
                </h1>
                <p className="text-slate-500 font-medium mt-2">{t('aging_subtitle')}</p>
             </div>
           
            <div className="bg-white border border-slate-200 p-1.5 rounded-2xl flex flex-wrap gap-1 shadow-inner shadow-slate-100">
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
                           className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                               period === d 
                               ? 'bg-amber-600 text-white shadow-lg' 
                               : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
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
           <div className="bg-white/90 border border-amber-100 p-6 rounded-2xl shadow-lg shadow-amber-900/5">
               <h3 className="text-amber-400 text-sm font-semibold mb-2">
                   {language === 'en' ? `Stagnant Items (> ${period} Days)` : `สินค้าไม่เคลื่อนไหวเกิน ${period} วัน`}
               </h3>
               <div className="text-3xl font-black text-slate-950 flex items-center gap-2">
                   {loading ? '...' : deadstock.length}
                   <span className="text-xs font-normal text-slate-500">{t('ai_unit')}</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full w-fit">
                   <AlertCircle className="w-3 h-3" />
                   {language === 'en' ? `Inactive for at least ${period} days` : `ไม่มีการเคลื่อนไหวอย่างน้อย ${period} วันขึ้นไป`}
               </div>
           </div>

           <div className="bg-white/90 border border-blue-100 p-6 rounded-2xl shadow-lg shadow-blue-900/5">
               <h3 className="text-amber-400 text-sm font-semibold mb-2">
                   {language === 'en' ? `Stagnant Value (> ${period} Days)` : `มูลค่าสินค้าไม่เคลื่อนไหว (> ${period} วัน)`}
               </h3>
               <div className="text-3xl font-black text-slate-950 flex items-center gap-2">
                   ฿{loading ? '...' : deadstockValue.toLocaleString()}
                   <span className="text-xs font-normal text-slate-500">THB</span>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">
                   <Clock className="w-3 h-3 text-slate-500" />
                   {language === 'en' ? 'Capital tied up in this range' : 'ทุนจมที่ควรเร่งระบายในกลุ่มนี้'}
               </div>
           </div>

           <div className="bg-white/90 border border-rose-200 p-6 rounded-2xl relative overflow-hidden group hover:border-rose-300 transition-colors shadow-lg shadow-rose-900/5">
               <h3 className="text-red-400 text-sm font-bold flex items-center gap-1.5 mb-2">
                   <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                   {language === 'en' ? 'True Deadstock (1 Year+)' : 'สินค้าค้างสต็อกแท้ (Deadstock 1 ปี+)'}
               </h3>
               <div className="text-3xl font-black text-slate-950 flex items-center gap-2">
                   {loading ? '...' : trueDeadstock.length}
                   <span className="text-xs font-normal text-slate-500">{t('ai_unit')}</span>
               </div>
               <div className="mt-4 text-xs text-red-300 font-medium">
                   {language === 'en' ? 'Total Frozen Capital: ' : 'เงินจมสะสมวิกฤต: '}
                   <span className="text-red-400 font-bold text-sm">฿{loading ? '...' : trueDeadstockValue.toLocaleString()}</span>
               </div>
           </div>
       </div>

       {/* Detailed Table */}
       <div className="bg-white/90 border border-slate-200 rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5 backdrop-blur-xl">
           <div className="p-6 border-b border-slate-100 flex justify-between items-center">
               <div className="flex items-center gap-4">
                   <h3 className="text-slate-950 font-black">{t('inventory_list')}</h3>
                   <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                       <button 
                         onClick={() => setViewMode('DEADSTOCK')}
                         className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${viewMode === 'DEADSTOCK' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-rose-700'}`}
                       >
                         {t('deadstock_only')}
                       </button>
                       <button 
                         onClick={() => setViewMode('ALL')}
                         className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${viewMode === 'ALL' ? 'bg-blue-700 text-white' : 'text-slate-500 hover:text-blue-700'}`}
                       >
                         {t('show_all')}
                       </button>
                   </div>
               </div>
               <button onClick={exportCSV} className="text-slate-500 hover:text-amber-700 flex items-center gap-2 text-sm font-bold">
                   <Download className="w-4 h-4" /> {t('export_csv')}
               </button>
           </div>
           
            <div className="overflow-x-auto">
                <table className="w-full text-left text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
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
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">{t('loading')}</td></tr>
                        ) : tableData.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">{t('no_products_found')}</td></tr>
                        ) : (
                            tableData.map((item) => (
                                <tr key={item.id} className="hover:bg-amber-50/50">
                                    <td className="px-6 py-4 font-bold text-slate-950">{item.name}</td>
                                    <td className="px-6 py-4 font-mono text-blue-700">{item.location || '-'}</td>
                                    <td className="px-6 py-4 font-bold">{item.stock.toLocaleString()}</td>
                                    <td className="px-6 py-4">฿{item.value.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                         <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                                             (item.movementStatus || 'Deadstock') === 'Fast Moving' ? 'bg-emerald-500/20 text-emerald-600' :
                                             (item.movementStatus || 'Deadstock') === 'Normal Moving' ? 'bg-blue-500/20 text-blue-600' :
                                             (item.movementStatus || 'Deadstock') === 'Slow Moving' ? 'bg-amber-500/20 text-amber-600' :
                                             (item.movementStatus || 'Deadstock') === 'Very Slow Moving' ? 'bg-orange-500/20 text-orange-600' :
                                             'bg-rose-500/20 text-rose-600'
                                         }`}>
                                             {item.movementStatus || 'Deadstock'}
                                         </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {item.fifoTiers && (
                                                <>
                                                    {item.fifoTiers.tier_0_30 > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold" title="อายุไม่เกิน 30 วัน">
                                                            ≤30d: {item.fifoTiers.tier_0_30}
                                                        </span>
                                                    )}
                                                    {item.fifoTiers.tier_31_60 > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold" title="อายุ 31-60 วัน">
                                                            31-60d: {item.fifoTiers.tier_31_60}
                                                        </span>
                                                    )}
                                                    {item.fifoTiers.tier_61_90 > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold" title="อายุ 61-90 วัน">
                                                            61-90d: {item.fifoTiers.tier_61_90}
                                                        </span>
                                                    )}
                                                    {(item.fifoTiers.tier_91_180 + item.fifoTiers.tier_180_plus) > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold" title="อายุมากกว่า 90 วัน">
                                                            &gt;90d: {item.fifoTiers.tier_91_180 + item.fifoTiers.tier_180_plus}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                            {item.fifoLayers && item.fifoLayers.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedProductForFifo(item)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors ml-1"
                                                >
                                                    <Layers className="w-3 h-3" />
                                                    {item.fifoLayers.length} ล็อต
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {item.lastSoldDate || t('never_sold')}
                                    </td>
                                    <td className="px-6 py-4 text-red-500 font-bold">
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedProductForFifo(null)}>
                <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-amber-600" />
                                รายละเอียดล็อต FIFO: {selectedProductForFifo.name}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                สต็อกคงเหลือทั้งหมด {selectedProductForFifo.stock} ชิ้น · มูลค่ารวม ฿{selectedProductForFifo.value.toLocaleString()}
                            </p>
                        </div>
                        <button onClick={() => setSelectedProductForFifo(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-3">
                        {selectedProductForFifo.fifoLayers && selectedProductForFifo.fifoLayers.length > 0 ? (
                            selectedProductForFifo.fifoLayers.map((layer: any, idx: number) => {
                                const layerVal = (layer.qty || 0) * (selectedProductForFifo.price || 0);
                                return (
                                    <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <span className="font-bold text-slate-800 text-sm">รับเข้าเมื่อ: {layer.date}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                อายุสต็อกล็อตนี้: <span className="font-bold text-slate-700">{layer.daysOld} วัน</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-slate-900">{layer.qty} ชิ้น</div>
                                            <div className="text-xs font-semibold text-emerald-600">฿{layerVal.toLocaleString()}</div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-slate-400">ไม่พบล็อตการรับเข้าในประวัติ</div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                        <button
                            onClick={() => setSelectedProductForFifo(null)}
                            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-all"
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
