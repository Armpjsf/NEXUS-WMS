'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, History, TrendingUp, TrendingDown, Clock, ArrowRight, AlertTriangle, Printer, ArrowLeft, Edit, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ProductSelector from '@/components/ProductSelector';
import LabelDesigner from '@/components/label/LabelDesigner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { getApiUrl } from '@/lib/config';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import EditProductModal from '@/components/product/EditProductModal';

function StockCardContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLabelDesigner, setShowLabelDesigner] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Date Range (Default: Start of Current Year to Today)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
      const res = await fetch(getApiUrl('/api/products'));
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
  }

  // Handle Search Param Auto-Select
  const searchParams = useSearchParams();
  const searchParam = searchParams.get('search')?.trim() || '';
  const skuParam = searchParams.get('sku')?.trim() || '';
  const idParam = searchParams.get('id')?.trim() || '';
  const nameParam = searchParams.get('name')?.trim() || '';

  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      const candidates = [idParam, skuParam, nameParam, searchParam].filter(Boolean);
      if (candidates.length === 0) return;

      let found = products.find(p =>
        (idParam && String(p.id).toLowerCase() === idParam.toLowerCase()) ||
        (skuParam && String(p.id).toLowerCase() === skuParam.toLowerCase())
      );

      if (!found && nameParam) {
        found = products.find(p => String(p.name).trim().toLowerCase() === nameParam.toLowerCase());
      }

      if (!found && searchParam) {
        found = products.find(p =>
          String(p.name).trim().toLowerCase() === searchParam.toLowerCase() ||
          String(p.id).trim().toLowerCase() === searchParam.toLowerCase() ||
          (p.sku && String(p.sku).trim().toLowerCase() === searchParam.toLowerCase())
        );
      }

      if (!found) {
        const primarySearch = (searchParam || nameParam || skuParam || idParam).toLowerCase();
        found = products.find(p =>
          String(p.name || '').toLowerCase().includes(primarySearch) ||
          String(p.id || '').toLowerCase().includes(primarySearch) ||
          (p.sku && String(p.sku).toLowerCase().includes(primarySearch))
        );
      }

      if (found) {
        setSelectedProduct(found);
      }
    }
  }, [searchParam, skuParam, idParam, nameParam, products, selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
        fetchStockCard();
    }
  }, [selectedProduct, startDate, endDate]);

  const fetchStockCard = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    setMovements([]);
    try {
        const querySku = selectedProduct.id || selectedProduct.sku || '';
        const queryName = selectedProduct.name || '';
        const params = new URLSearchParams({
            sku: querySku,
            name: queryName,
            startDate,
            endDate
        });
        const res = await fetch(getApiUrl(`/api/stock-card?${params.toString()}`));
        const result = await res.json();

        if (Array.isArray(result)) {
            setMovements(result);
        } else {
            console.error("API Error or Invalid Format:", result);
            setMovements([]);
        }
    } catch (error) {
        console.error("Failed to fetch stock card", error);
    } finally {
        setLoading(false);
    }
  };

  const totalIn = movements.filter(m => m.type === 'IN').reduce((acc, m) => acc + m.in, 0);
  const totalOut = movements.filter(m => m.type === 'OUT').reduce((acc, m) => acc + m.out, 0);

  const handleEditSuccess = () => {
      fetchProducts();
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
         <Link
           href="/inventory"
           className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
         >
             <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
             {t('back_to_inventory')}
         </Link>

         {/* Open Page Header */}
         <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-1"
         >
             <div className="flex items-center gap-2 mb-1.5">
                 <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                     <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                     Movement Ledger
                 </span>
             </div>
             <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <History className="w-7 h-7 text-emerald-600 shrink-0" />
                <span>{t('stock_card_title')}</span>
             </h1>
             <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('stock_card_subtitle')}</p>
         </motion.div>

         {/* Controls */}
         <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.05 }}
           className="nx-glass-card p-6"
         >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                    <label className="text-xs text-slate-600 font-semibold uppercase tracking-wider block">{t('select_product')}</label>
                    <ProductSelector
                        products={products}
                        onSelect={(p) => {
                            setSelectedProduct(p);
                        }}
                        selectedId={selectedProduct?.id}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-xs text-slate-600 font-semibold uppercase tracking-wider block mb-2">{t('date_from')}</label>
                      <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-white/85 border border-slate-200 rounded-full px-4 py-2.5 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
                      />
                   </div>
                   <div>
                      <label className="text-xs text-slate-600 font-semibold uppercase tracking-wider block mb-2">{t('date_to')}</label>
                      <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-white/85 border border-slate-200 rounded-full px-4 py-2.5 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
                      />
                   </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 pt-5 border-t border-slate-200/70 flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap gap-2">
                    {selectedProduct && (
                        <>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500/12 text-amber-800 border border-amber-500/25 font-semibold text-xs rounded-full hover:bg-amber-500/20 transition-colors"
                            >
                                <Edit className="w-3.5 h-3.5" />
                                แก้ไขสินค้า
                            </button>
                            <Link
                                href={`/inventory/print-labels?sku=${selectedProduct.id}&name=${encodeURIComponent(selectedProduct.name)}&price=${selectedProduct.price}`}
                                target="_blank"
                                className="flex items-center gap-2 px-4 py-2 bg-sky-500/12 text-sky-800 border border-sky-500/25 font-semibold text-xs rounded-full hover:bg-sky-500/20 transition-colors"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                {t('print_barcode_btn')}
                            </Link>
                            <button
                                onClick={() => setShowLabelDesigner(true)}
                                className="bg-white/80 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                {t('print_label_btn')}
                            </button>
                        </>
                    )}
                </div>

                <button
                  onClick={fetchStockCard}
                  disabled={!selectedProduct || loading}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ml-auto"
                >
                   {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                   {t('generate_report')}
                </button>
            </div>
         </motion.div>

         {/* Modals */}
         <AnimatePresence>
            {showLabelDesigner && selectedProduct && (
                <LabelDesigner
                    isOpen={showLabelDesigner}
                    onClose={() => setShowLabelDesigner(false)}
                    product={selectedProduct}
                />
            )}
            {showEditModal && selectedProduct && (
                <EditProductModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    product={selectedProduct}
                    onSuccess={handleEditSuccess}
                />
            )}
         </AnimatePresence>

         {/* Results */}
         <AnimatePresence mode='wait'>
             {loading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                     <Skeleton className="h-40 w-full nx-glass-card" />
                     <Skeleton className="h-20 w-full nx-glass-card" />
                     <Skeleton className="h-20 w-full nx-glass-card" />
                </motion.div>
             ) : movements.length > 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 gap-6 lg:grid-cols-4"
                >
                    {/* Summary Cards */}
                    <div className="lg:col-span-1 space-y-5">
                        {/* 1 Hero Dark Accent Card for Current Balance */}
                        {movements[0]?.balance !== undefined && (
                             <div className="nx-dark-accent-card p-6">
                                 <p className="text-slate-300 font-semibold text-xs uppercase tracking-wider mb-1">{t('current_balance')}</p>
                                 <p className="text-4xl font-bold text-white tabular-nums">{movements[movements.length-1].balance.toLocaleString()}</p>
                                 <p className="text-[11px] text-emerald-400 font-medium mt-2">Latest ledger balance</p>
                             </div>
                        )}

                        <div className="nx-glass-card p-6">
                             <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-4">{t('period_summary')}</h3>
                             <div className="space-y-4">
                                 <div className="flex items-center gap-3.5">
                                     <div className="p-2.5 bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 rounded-2xl">
                                         <TrendingUp className="w-5 h-5" />
                                     </div>
                                     <div>
                                         <p className="text-xs text-slate-500 uppercase font-semibold">{t('total_in')}</p>
                                         <p className="text-2xl font-bold text-emerald-700 tabular-nums">+{totalIn.toLocaleString()}</p>
                                     </div>
                                 </div>
                                 <div className="w-full h-px bg-slate-200/70" />
                                 <div className="flex items-center gap-3.5">
                                     <div className="p-2.5 bg-rose-500/12 border border-rose-500/20 text-rose-600 rounded-2xl">
                                         <TrendingDown className="w-5 h-5" />
                                     </div>
                                     <div>
                                         <p className="text-xs text-slate-500 uppercase font-semibold">{t('total_out')}</p>
                                         <p className="text-2xl font-bold text-rose-600 tabular-nums">-{totalOut.toLocaleString()}</p>
                                     </div>
                                 </div>
                                 {movements.some(m => m.type === 'DAMAGE') && (
                                    <>
                                     <div className="w-full h-px bg-slate-200/70" />
                                     <div className="flex items-center gap-3.5">
                                         <div className="p-2.5 bg-amber-500/15 border border-amber-500/25 text-amber-700 rounded-2xl">
                                             <AlertTriangle className="w-5 h-5" />
                                         </div>
                                         <div>
                                             <p className="text-xs text-slate-500 uppercase font-semibold">{t('tab_damage')}</p>
                                             <p className="text-2xl font-bold text-amber-700 tabular-nums">
                                                -{movements.filter(m => m.type === 'DAMAGE').reduce((acc, m) => acc + m.out, 0).toLocaleString()}
                                             </p>
                                         </div>
                                     </div>
                                    </>
                                 )}
                             </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="lg:col-span-3 nx-glass-card p-6">
                        <h3 className="text-slate-900 font-bold text-base mb-6 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600" /> {t('transaction_history')}
                        </h3>

                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-5 pl-7 pb-2">
                             {movements.map((m, idx) => (
                                 <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                                    className="relative"
                                 >
                                     {m.type === 'DAMAGE' ? (
                                         <div className="absolute -left-[37px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm bg-amber-500" />
                                     ) : (
                                        <div className={cn(
                                            "absolute -left-[37px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm",
                                            m.type === 'IN' ? "bg-emerald-500" : "bg-rose-500"
                                        )} />
                                     )}

                                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/75 hover:bg-emerald-50/40 transition-colors border border-slate-200/80">
                                         <div>
                                             <div className="flex items-center gap-2.5 mb-1">
                                                 <span className={cn(
                                                     "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                     m.type === 'IN' ? "bg-emerald-500/12 text-emerald-700 border-emerald-500/20" :
                                                     m.type === 'DAMAGE' ? "bg-amber-500/15 text-amber-800 border-amber-500/25" : "bg-rose-500/12 text-rose-700 border-rose-500/25"
                                                 )}>
                                                     {m.type === 'IN' ? 'INBOUND' : m.type === 'DAMAGE' ? 'DAMAGE' : 'OUTBOUND'}
                                                 </span>
                                                 <span className="text-xs font-medium text-slate-500 font-mono">
                                                     {new Date(m.date).toLocaleDateString()}
                                                 </span>
                                             </div>
                                             <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                                 {m.docRef || 'Manual Adjustment'}
                                                 {m.type !== 'DAMAGE' && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Ref</span>}
                                             </h4>
                                         </div>

                                         <div className="flex items-center gap-5">
                                              <div className="text-right">
                                                  <p className="text-[11px] text-slate-500 uppercase font-semibold">{t('col_qty')}</p>
                                                  <p className={cn(
                                                      "text-xl font-bold tabular-nums",
                                                      m.type === 'IN' ? "text-emerald-700" :
                                                      m.type === 'DAMAGE' ? "text-amber-700" : "text-rose-600"
                                                  )}>
                                                      {m.type === 'IN' ? '+' : '-'}{m.type === 'IN' ? m.in.toLocaleString() : m.out.toLocaleString()}
                                                  </p>
                                              </div>
                                              <ArrowRight className="text-slate-300 w-4 h-4 hidden md:block" />
                                              <div className="text-right min-w-[72px]">
                                                  <p className="text-[11px] text-slate-500 uppercase font-semibold">{t('col_balance')}</p>
                                                  <p className="text-base font-bold text-slate-900 tabular-nums bg-slate-100 px-3 py-1 rounded-full inline-block">
                                                      {m.balance.toLocaleString()}
                                                  </p>
                                              </div>
                                         </div>
                                     </div>
                                 </motion.div>
                             ))}
                        </div>
                    </div>
                </motion.div>
             ) : selectedProduct && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="nx-glass-card flex flex-col items-center justify-center py-16 text-slate-500">
                    <History className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="text-base font-bold text-slate-700">{t('no_history')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('no_history_desc')}</p>
                </motion.div>
             )}
         </AnimatePresence>
      </div>
    </div>
  );
}

export default function StockCardPage() {
  return (
    <Suspense fallback={
        <div className="theme-nexus-hybrid min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-600"></div>
        </div>
    }>
        <StockCardContent />
    </Suspense>
  );
}
