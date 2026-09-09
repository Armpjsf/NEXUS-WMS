'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Loader2, PackageMinus, Plus, Trash2, Calendar, FileText, Info, FileSpreadsheet, Camera, Zap } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RecentTransactions } from '@/components/RecentTransactions';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';

import { useOfflineSync } from '@/hooks/useOfflineSync';
import { db } from '@/lib/db';
import { toast } from 'react-hot-toast';
import { ImportTransactionsModal } from '@/components/ImportTransactionsModal';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function OutboundPage() {
  const { t } = useLanguage();
  const { isOnline } = useOfflineSync();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  // Cart
  const [items, setItems] = useState<any[]>([]);
  
  // Current Item Form
  const [currentSku, setCurrentSku] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [docRef, setDocRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCamera, setShowCamera] = useState(false);

  // FIFO Preview State
  const [fifoPreview, setFifoPreview] = useState<any>(null);
  const [fifoLoading, setFifoLoading] = useState(false);
  const [fifoMethod, setFifoMethod] = useState<'FIFO' | 'FEFO'>('FIFO');

  const handleScanSku = (scanned: string) => {
    const q = scanned.trim().toLowerCase();
    const matched = products.find(p =>
      (p.name || '').toLowerCase() === q ||
      (p.id || '').toLowerCase() === q ||
      (p.barcode || '').toLowerCase() === q
    );
    if (matched) {
      setCurrentSku(matched.name);
      if (!currentQty) setCurrentQty('1');
      setShowCamera(false);
      toast.success(`เลือกสินค้า: ${matched.name}`);
    } else {
      toast.error(`ไม่พบสินค้ารหัส "${scanned}" ในระบบ`);
    }
  };

  usePdaScanner({
    onScan: handleScanSku,
    enabled: true,
  });

  useEffect(() => {
    async function loadProducts() {
        try {
            if (navigator.onLine) {
                const res = await fetch(getApiUrl('/api/products'));
                const data = await res.json();
                setProducts(data);
            } else {
                console.log("Loading products from Offline Cache...");
                const cached = await db.products.toArray();
                setProducts(cached);
            }
        } catch (e) {
            console.error(e);
            const cached = await db.products.toArray();
            setProducts(cached);
        } finally {
            setLoading(false);
        }
    }
    loadProducts();
  }, []);

  // FIFO Preview: Fetch when SKU/Qty changes
  useEffect(() => {
    if (!currentSku || !currentQty || Number(currentQty) <= 0) {
      setFifoPreview(null);
      return;
    }

    const fetchPreview = async () => {
      setFifoLoading(true);
      try {
        const res = await fetch(getApiUrl('/api/fifo/preview'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: currentSku, qty: Number(currentQty), method: fifoMethod })
        });
        const data = await res.json();
        setFifoPreview(data);
      } catch (e) {
        console.error('FIFO Preview Error:', e);
        setFifoPreview(null);
      } finally {
        setFifoLoading(false);
      }
    };

    const debounce = setTimeout(fetchPreview, 500);
    return () => clearTimeout(debounce);
  }, [currentSku, currentQty, fifoMethod]);

  const addItem = () => {
     if (!currentSku || !currentQty) return;

     // Guard: don't let the running total for a SKU exceed available stock.
     const prod = products.find((p: any) => p.name === currentSku || p.id === currentSku);
     if (prod) {
        const already = items.filter(i => i.sku === currentSku).reduce((s, i) => s + Number(i.qty || 0), 0);
        const wanted = already + Number(currentQty || 0);
        const avail = Number(prod.stock || 0);
        if (wanted > avail) {
           toast.error(`สต็อกไม่พอ: ${prod.name} คงเหลือ ${avail} (จะจ่ายรวม ${wanted})`);
           return;
        }
     }

     setItems(prev => [
        ...prev,
        { sku: currentSku, qty: currentQty, salePrice: currentPrice }
     ]);
     // Clear inputs
     setCurrentSku('');
     setCurrentQty('');
     setCurrentPrice('');
  };

  const removeItem = (idx: number) => {
     setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (!confirm(`${t('confirm_prompt')} ${items.length}?`)) return;

    setSubmitting(true);
    
    const payloadItems = items.map(i => ({
         ...i,
         date,
         docRef // Apply global docRef to all items
    }));
    const payload = { items: payloadItems };

    // OFFLINE LOGIC
    if (!isOnline) {
        try {
            await db.pendingTransactions.add({
                type: 'OUTBOUND',
                data: payload,
                timestamp: Date.now(),
                status: 'PENDING',
                retryCount: 0
            });
            toast.success("Saved Offline! Will sync when online.");
            setItems([]);
            setDocRef('');
        } catch (e) {
            console.error(e);
            toast.error("Failed to save offline.");
        } finally {
            setSubmitting(false);
        }
        return;
    }

    // ONLINE LOGIC
    try {
      const res = await fetch(getApiUrl('/api/outbound'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Business errors (e.g. insufficient stock) — surface, do NOT save offline.
      if (res.status === 409 || res.status === 400) {
        const data = await res.json().catch(() => ({}));
        const detail = Array.isArray(data.shortages) ? `\n• ${data.shortages.join('\n• ')}` : '';
        toast.error((data.error || 'จ่ายออกไม่สำเร็จ') + detail, { duration: 6000 });
        setSubmitting(false);
        return;
      }

      if (!res.ok) throw new Error(await res.text());

      toast.success(t('success_outbound'));
      setItems([]);
      setDocRef('');
    } catch (error: any) {
      console.error(error);
      if (confirm("Network Failed. Save locally to sync later?")) {
          await db.pendingTransactions.add({
                type: 'OUTBOUND',
                data: payload,
                timestamp: Date.now(),
                status: 'PENDING',
                retryCount: 0
          });
          toast.success("Saved Offline!");
          setItems([]);
          setDocRef('');
      } else {
          alert('Error: ' + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8">
      <AmbientBackground />
      
      <div className="max-w-[1500px] mx-auto relative z-10">
      
        {/* Header */}
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-rose-200 bg-white/85 p-6 shadow-xl shadow-rose-900/10 backdrop-blur-xl"
        >
           <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-600 via-amber-500 to-blue-500" />
           
           <Link href="/dashboard" className="relative z-10 text-slate-500 hover:text-rose-600 flex items-center gap-2 mb-6 transition-colors font-bold uppercase text-xs tracking-widest">
              <ArrowLeft className="w-4 h-4" /> {t('back_to_dashboard')}
           </Link>
           <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-5">
                   <div className="p-5 bg-gradient-to-br from-rose-600 to-orange-600 rounded-3xl shadow-xl shadow-rose-900/20">
                     <PackageMinus className="w-10 h-10 text-white" />
                   </div>
                   <div>
                       <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-700">Dispatch Workspace</p>
                       <h1 className="text-4xl font-black text-slate-950 tracking-tight mb-1">
                          {t('outbound_order')}
                       </h1>
                       <p className="text-slate-500 font-semibold text-sm">{t('outbound_subtitle')}</p>
                   </div>
                </div>
                
                <button
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-rose-200 px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-sm"
                >
                    <FileSpreadsheet className="w-5 h-5 text-rose-500" />
                    <span>{t('import_excel')}</span>
                </button>
            </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Document Info Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
                >
                    <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-500" /> {t('document_info')}
                    </h3>
                    <div className="space-y-5">
                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('date')}</label>
                             <div className="relative">
                                 <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                 <input 
                                    type="date" 
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium" 
                                 />
                             </div>
                        </div>
                        <div className="group">
                             <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('reference_inv')}</label>
                             <input 
                                type="text" 
                                value={docRef} 
                                onChange={e => setDocRef(e.target.value)} 
                                placeholder="e.g. INV-2024-001" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all font-medium" 
                             />
                        </div>
                    </div>
                </motion.div>

                {/* Add Item Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
                >
                    <h3 className="font-bold text-slate-800 mb-6 uppercase text-sm tracking-wider flex items-center gap-2">
                        <Plus className="w-4 h-4 text-rose-500" /> {t('add_item')}
                    </h3>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-slate-400 font-bold block uppercase tracking-wider">{t('product')}</label>
                                <button
                                    type="button"
                                    onClick={() => setShowCamera(true)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 active:scale-95 transition-transform"
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>สแกนบาร์โค้ด</span>
                                </button>
                            </div>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <SearchableSelect 
                                        options={products.map(p => ({
                                            value: p.name,
                                            label: p.name,
                                            subLabel: `Stock: ${p.stock}`
                                        }))}
                                        value={currentSku}
                                        onChange={setCurrentSku}
                                        placeholder="-- Select Product --"
                                        disabled={loading}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCamera(true)}
                                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-colors shrink-0"
                                    title="เปิดกล้องสแกนบาร์โค้ดสินค้า"
                                >
                                    <Camera className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {currentSku && (() => {
                            const p = products.find(prod => prod.name === currentSku);
                            if (p?.fifo?.maxDaysOld > 90) {
                                return (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-amber-700 uppercase">
                                                {t('fifo_recommendation')}
                                            </p>
                                            <p className="text-sm text-amber-800">
                                                Pick stock from <strong>{p.fifo.oldestDate}</strong> ({p.fifo.maxDaysOld} days old).
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className="grid grid-cols-2 gap-4">
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('qty')}</label>
                                <input 
                                    type="number" 
                                    value={currentQty} 
                                    onChange={e => setCurrentQty(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all" 
                                    placeholder="0" 
                                />
                             </div>
                             <div className="group">
                                <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">{t('price_opt')}</label>
                                <input 
                                    type="number" 
                                    value={currentPrice} 
                                    onChange={e => setCurrentPrice(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all" 
                                    placeholder="0.00" 
                                />
                             </div>
                        </div>

                        {/* FIFO/FEFO Preview Info Box */}
                        {fifoPreview && currentSku && currentQty && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm w-full">
                                        {/* Method Toggle */}
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-bold text-blue-800">{fifoMethod === 'FIFO' ? 'FIFO (ของเก่าก่อน)' : 'FEFO (หมดอายุก่อน)'}</p>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => setFifoMethod('FIFO')}
                                                    className={`px-2 py-1 text-xs rounded-lg font-bold ${fifoMethod === 'FIFO' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}
                                                >FIFO</button>
                                                <button 
                                                    onClick={() => setFifoMethod('FEFO')}
                                                    className={`px-2 py-1 text-xs rounded-lg font-bold ${fifoMethod === 'FEFO' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600'}`}
                                                >FEFO</button>
                                            </div>
                                        </div>
                                        {fifoLoading ? (
                                            <p className="text-blue-600">กำลังคำนวณ...</p>
                                        ) : fifoPreview.allocations?.length > 0 ? (
                                            <div className="space-y-1">
                                                <p className="text-blue-700">สต๊อคคงเหลือ: <strong>{fifoPreview.currentStock}</strong> ชิ้น</p>
                                                <p className="text-blue-700">จะดึงจาก:</p>
                                                <ul className="list-disc list-inside text-blue-600 text-xs space-y-0.5">
                                                    {fifoPreview.allocations.map((a: any, i: number) => (
                                                        <li key={i}>
                                                            <strong>{a.qtyFromLayer}</strong> ชิ้น 
                                                            {a.expiryDate ? ` (หมดอายุ ${a.expiryDate})` : ` (รับ ${a.date})`}
                                                            <span className="text-slate-400"> • {a.daysOld} วัน</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="text-red-600 font-medium">⚠️ สต๊อคไม่เพียงพอ!</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={addItem}
                            disabled={!currentSku || !currentQty}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                        >
                            <Plus className="w-5 h-5" /> {t('add_to_list')}
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Right: List */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-2"
            >
                 <div className="bg-white/95 border border-slate-200 rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-lg shadow-slate-900/5">
                     <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center backdrop-blur-sm">
                         <h3 className="font-bold text-slate-900 flex items-center gap-3 text-lg">
                            {t('items_list')} <span className="bg-rose-100 text-rose-800 text-xs px-3 py-1 rounded-full border border-rose-200 font-bold">{items.length}</span>
                         </h3>
                         {items.length > 0 && (
                            <button onClick={() => setItems([])} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wider transition-colors">
                                {t('clear_all')}
                            </button>
                         )}
                     </div>
                     
                     <div className="flex-1 overflow-auto p-2">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 py-20">
                                <PackageMinus className="w-16 h-16 mb-4 stroke-1" />
                                <p className="text-lg font-medium">{t('no_items_added')}</p>
                                <p className="text-sm">{t('select_product_prompt')}</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="text-white uppercase font-black text-[10px] tracking-[0.1em] sticky top-0 z-20">
                                    <tr className="bg-gradient-to-r from-rose-600 to-pink-600 shadow-md">
                                        <th className="p-5 rounded-l-2xl">{t('product')}</th>
                                        <th className="p-5 text-right">{t('qty')}</th>
                                        <th className="p-5 text-right">{t('price_opt')}</th>
                                        <th className="p-5 text-center rounded-r-2xl">{t('edit')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <AnimatePresence mode='popLayout'>
                                    {items.map((item, i) => (
                                        <motion.tr 
                                            key={`${item.sku}-${i}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="group hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="p-4 font-bold text-slate-800 text-base">{item.sku}</td>
                                            <td className="p-4 text-right font-mono text-rose-600 font-bold text-lg">{parseInt(item.qty).toLocaleString()}</td>
                                            <td className="p-4 text-right font-mono text-slate-500">{item.salePrice ? `฿${item.salePrice}` : '-'}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => removeItem(i)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        )}
                     </div>

                     <div className="p-6 bg-white border-t border-slate-100">
                        <button
                            onClick={handleSubmit}
                            disabled={items.length === 0 || submitting}
                            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-rose-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-lg"
                        >
                            {submitting ? <Loader2 className="animate-spin w-6 h-6" /> : <Send className="w-6 h-6" />}
                            {t('confirm_outbound')} ({items.length})
                        </button>
                     </div>
                 </div>
            </motion.div>
        </div>

        {/* Recent Transactions History */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 col-span-full"
        >
             <RecentTransactions type="OUT" refreshTrigger={items.length} />
        </motion.div>
      </div>

      <ImportTransactionsModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          type="OUT"
          products={products}
          onImported={(importedItems) => setItems(prev => [...prev, ...importedItems])}
      />

      {/* Embedded Camera Scanner for Outbound Product Selection */}
      <CameraScannerModal
          isOpen={showCamera}
          onClose={() => setShowCamera(false)}
          onScan={handleScanSku}
          title="สแกนบาร์โค้ดสินค้าเพื่อจ่ายออก"
          description="ส่องกล้องไปที่บาร์โค้ดบนตัวสินค้าเพื่อเลือกสินค้าลงรายการจ่ายออกทันที"
      />
    </div>
  );
}
