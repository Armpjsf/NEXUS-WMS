'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Calendar, ArrowRightLeft, ArrowUpCircle, ArrowDownCircle, History, TrendingUp, TrendingDown, Clock, ArrowRight, AlertTriangle, Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ProductSelector from '@/components/ProductSelector';
import LabelDesigner from '@/components/label/LabelDesigner';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { getApiUrl } from '@/lib/config';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Edit, Loader2 } from 'lucide-react';
import EditProductModal from '@/components/product/EditProductModal';

// Main Content Component
function StockCardContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLabelDesigner, setShowLabelDesigner] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Date Range (Default: Current Month)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // Fetch Products for Selector
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
  const searchSku = searchParams.get('search');

  useEffect(() => {
    if (searchSku && products.length > 0 && !selectedProduct) {
        // Try to match by Name or ID
        const found = products.find(p => p.name === searchSku || p.id === searchSku);
        if (found) {
            setSelectedProduct(found);
            // Optional: Auto-fetch immediately
        }
    }
  }, [searchSku, products]);

  // Auto-Fetch when product is selected (Debounced or Effect)
  useEffect(() => {
    if (selectedProduct) {
        fetchStockCard();
    }
  }, [selectedProduct]); // Trigger when selection changes

  // Fetch Stock Card Data
  const fetchStockCard = async () => {
    if (!selectedProduct) return;
    
    setLoading(true);
    setMovements([]); // Clear previous
    try {
        // Fix: Use 'startDate' and 'endDate' to match API route
        const res = await fetch(getApiUrl(`/api/stock-card?sku=${encodeURIComponent(selectedProduct.name)}&startDate=${startDate}&endDate=${endDate}`));
        const result = await res.json();
        
        // Fix: API returns array directly, or error object
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

  // Calculate Summary
  const totalIn = movements.filter(m => m.type === 'IN').reduce((acc, m) => acc + m.in, 0);
  const totalOut = movements.filter(m => m.type === 'OUT').reduce((acc, m) => acc + m.out, 0);

  const handleEditSuccess = () => {
      // Refresh products and current details
      fetchProducts();
      // Optionally update selectedProduct manually or wait for effect
      // But fetchProducts is async. 
      // A simple alert or toast would be nice.
      // We will re-trigger the product search logic if name changed? 
      // If name changed, selectedProduct might be stale.
      // Users are warned about name changes.
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8">
      <AmbientBackground />
      
      <div className="max-w-[1500px] mx-auto space-y-7 relative z-10">
         <Link href="/inventory" className="inline-flex items-center gap-2 rounded-xl border border-[#30353d] bg-[#171c23] px-3 py-2 text-sm font-bold text-[#d1c6ab] shadow-sm transition-colors hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-700">
             <ArrowLeft className="w-4 h-4" /> {t('back_to_inventory')}
         </Link>
         {/* Header */}
         <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[1.75rem] border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl"
         >
             <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-cyan-500 to-teal-500" />
             <div>
                 <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Movement Ledger</p>
                 <h1 className="text-4xl font-black text-[#dee2ec] tracking-tight flex items-center gap-3">
                    <span className="p-3 bg-gradient-to-br from-blue-700 to-cyan-600 rounded-2xl text-white shadow-lg shadow-blue-900/20">
                        <History className="w-8 h-8" />
                    </span>
                    {t('stock_card_title')}
                 </h1>
                 <p className="text-[#8a92a6] mt-2 font-semibold ml-1">{t('stock_card_subtitle')}</p>
             </div>
         </motion.div>

         {/* Controls */}
         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1 }}
           className="rounded-[1.5rem] border border-[#30353d] bg-[#171c23] p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl"
         >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div className="space-y-4">
                    <label className="text-xs text-[#8a92a6] font-bold uppercase tracking-wider block">{t('select_product')}</label>
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
                      <label className="text-xs text-[#8a92a6] font-bold uppercase tracking-wider block mb-2">{t('date_from')}</label>
                      <input 
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-[#171c23] border border-[#30353d] rounded-xl px-4 py-3 text-[#dee2ec] font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all"
                      />
                   </div>
                   <div>
                      <label className="text-xs text-[#8a92a6] font-bold uppercase tracking-wider block mb-2">{t('date_to')}</label>
                      <input 
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-[#171c23] border border-[#30353d] rounded-xl px-4 py-3 text-[#dee2ec] font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-300 transition-all"
                      />
                   </div>
                </div>
            </div>
            
            {/* Action Bar */}
            {selectedProduct && (
                <div className="mt-6 pt-6 border-t border-[#30353d] flex justify-between items-center">
                    <div className="flex gap-2">
                         {/* Edit Button */}
                         <button 
                            onClick={() => setShowEditModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-700 font-bold rounded-xl ring-1 ring-amber-500/30 hover:bg-amber-500/20 transition-colors"
                        >
                            <Edit className="w-5 h-5" />
                            แก้ไขสินค้า
                        </button>
                    </div>

                    <Link 
                        href={`/inventory/print-labels?sku=${selectedProduct.id}&name=${encodeURIComponent(selectedProduct.name)}&price=${selectedProduct.price}`}
                        target="_blank"
                        className="flex items-center gap-2 px-6 py-3 bg-blue-500/10 text-blue-700 font-bold rounded-xl ring-1 ring-blue-500/30 hover:bg-blue-500/20 transition-colors"
                    >
                        <Printer className="w-5 h-5" />
                        {t('print_barcode_btn')}
                    </Link>
                </div>
            )}

            <div className="mt-8 flex justify-end items-center gap-4 border-t border-[#30353d] pt-6">
                {selectedProduct && (
                    <button
                        onClick={() => setShowLabelDesigner(true)}
                        className="bg-[#171c23] border border-[#30353d] hover:border-blue-300 hover:bg-blue-500/10 hover:text-blue-700 text-[#d1c6ab] px-6 py-4 rounded-xl font-bold flex items-center gap-3 transition-all active:scale-[0.98]"
                    >
                        <Printer className="w-5 h-5" />
                        {t('print_label_btn')}
                    </button>
                )}
                <button 
                  onClick={fetchStockCard}
                  disabled={!selectedProduct || loading}
                  className="bg-gradient-to-r from-blue-700 to-teal-600 hover:from-blue-800 hover:to-teal-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                >
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                   {t('generate_report')}
                </button>
            </div>
         </motion.div>

         {/* Label Designer Modal */}
         <AnimatePresence>
            {showLabelDesigner && selectedProduct && (
                <LabelDesigner 
                    isOpen={showLabelDesigner}
                    onClose={() => setShowLabelDesigner(false)}
                    product={selectedProduct}
                />
            )}
            {/* Edit Modal */}
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
                     <Skeleton className="h-40 w-full rounded-3xl" />
                     <Skeleton className="h-20 w-full rounded-xl" />
                     <Skeleton className="h-20 w-full rounded-xl" />
                </motion.div>
             ) : movements.length > 0 ? (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 gap-6 lg:grid-cols-4"
                >
                    {/* Summary Cards */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="rounded-2xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg shadow-slate-900/5">
                             <h3 className="text-[#8a92a6] font-bold text-xs uppercase tracking-wider mb-4">{t('period_summary')}</h3>
                             <div className="space-y-5">
                                 <div className="flex items-center gap-4">
                                     <div className="p-3 bg-emerald-500/20 text-emerald-600 rounded-2xl">
                                         <TrendingUp className="w-6 h-6" />
                                     </div>
                                     <div>
                                         <p className="text-xs text-[#8a92a6] uppercase font-bold">{t('total_in')}</p>
                                         <p className="text-2xl font-black text-emerald-600 tabular-nums">+{totalIn.toLocaleString()}</p>
                                     </div>
                                 </div>
                                 <div className="w-full h-px bg-[#252a32]" />
                                 <div className="flex items-center gap-4">
                                     <div className="p-3 bg-rose-500/20 text-rose-600 rounded-2xl">
                                         <TrendingDown className="w-6 h-6" />
                                     </div>
                                     <div>
                                         <p className="text-xs text-[#8a92a6] uppercase font-bold">{t('total_out')}</p>
                                         <p className="text-2xl font-black text-rose-600 tabular-nums">-{totalOut.toLocaleString()}</p>
                                     </div>
                                 </div>
                                 {/* Damage Summary */}
                                 {movements.some(m => m.type === 'DAMAGE') && (
                                    <>
                                     <div className="w-full h-px bg-[#252a32]" />
                                     <div className="flex items-center gap-4">
                                         <div className="p-3 bg-amber-500/20 text-amber-600 rounded-2xl">
                                             <AlertTriangle className="w-6 h-6" />
                                         </div>
                                         <div>
                                             <p className="text-xs text-[#8a92a6] uppercase font-bold">{t('tab_damage')}</p>
                                             <p className="text-2xl font-black text-amber-600 tabular-nums">
                                                -{movements.filter(m => m.type === 'DAMAGE').reduce((acc, m) => acc + m.out, 0).toLocaleString()}
                                             </p>
                                         </div>
                                     </div>
                                    </>
                                 )}
                             </div>
                        </div>

                        {movements[0]?.balance !== undefined && (
                             <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-6 rounded-2xl shadow-lg shadow-slate-900/20">
                                 <p className="text-[#8a92a6] font-bold text-xs uppercase tracking-wider mb-1">{t('current_balance')}</p>
                                 <p className="text-4xl font-black text-white tabular-nums">{movements[movements.length-1].balance.toLocaleString()}</p>
                             </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="lg:col-span-3 rounded-[1.5rem] border border-[#30353d] bg-[#171c23] p-6 shadow-lg shadow-slate-900/5">
                        <h3 className="text-[#dee2ec] font-black text-lg mb-8 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-600" /> {t('transaction_history')}
                        </h3>
                        
                        <div className="relative border-l-2 border-[#30353d] ml-3 space-y-8 pl-8 pb-4">
                             {movements.map((m, idx) => (
                                 <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="relative"
                                 >
                                     {/* Dot */}
                                     {m.type === 'DAMAGE' ? (
                                         <div className="absolute -left-[41px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm bg-amber-500" />
                                     ) : (
                                        <div className={cn(
                                            "absolute -left-[41px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm",
                                            m.type === 'IN' ? "bg-emerald-500" : "bg-rose-500"
                                        )} />
                                     )}


                                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[#171c23] hover:bg-[#1b2027] transition-colors border border-[#30353d]">
                                         <div>
                                             <div className="flex items-center gap-3 mb-1">
                                                 <span className={cn(
                                                     "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                                     m.type === 'IN' ? "bg-emerald-500/20 text-emerald-700" : 
                                                     m.type === 'DAMAGE' ? "bg-amber-500/20 text-amber-700" : "bg-rose-500/20 text-rose-700"
                                                 )}>
                                                     {m.type === 'IN' ? 'INBOUND' : m.type === 'DAMAGE' ? 'DAMAGE' : 'OUTBOUND'}
                                                 </span>
                                                 <span className="text-sm font-medium text-[#8a92a6] font-mono">
                                                     {new Date(m.date).toLocaleDateString()}
                                                 </span>
                                             </div>
                                             <h4 className="font-bold text-[#dee2ec] text-lg flex items-center gap-2">
                                                 {m.docRef || 'Manual Adjustment'}
                                                 {m.type !== 'DAMAGE' && <span className="text-xs font-normal text-[#8a92a6] bg-[#252a32] px-2 py-0.5 rounded-full">Ref</span>}
                                             </h4>
                                         </div>

                                         <div className="flex items-center gap-6">
                                              <div className="text-right">
                                                  <p className="text-xs text-[#8a92a6] uppercase font-bold">{t('col_qty')}</p>
                                                  <p className={cn(
                                                      "text-2xl font-black tabular-nums",
                                                      m.type === 'IN' ? "text-emerald-600" : 
                                                      m.type === 'DAMAGE' ? "text-amber-600" : "text-rose-600"
                                                  )}>
                                                      {m.type === 'IN' ? '+' : '-'}{m.type === 'IN' ? m.in.toLocaleString() : m.out.toLocaleString()}
                                                  </p>
                                              </div>
                                              <ArrowRight className="text-slate-300 w-5 h-5 hidden md:block" />
                                              <div className="text-right min-w-[80px]">
                                                  <p className="text-xs text-[#8a92a6] uppercase font-bold">{t('col_balance')}</p>
                                                  <p className="text-lg font-bold text-[#d1c6ab] tabular-nums bg-[#252a32] px-3 py-1 rounded-lg inline-block">
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-[#8a92a6]">
                    <History className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-bold">{t('no_history')}</p>
                    <p className="text-sm">{t('no_history_desc')}</p>
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
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
    }>
        <StockCardContent />
    </Suspense>
  );
}
