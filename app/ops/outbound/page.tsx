'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Send, Loader2, PackageMinus, Plus, Trash2, Calendar, FileText, Info, FileSpreadsheet, Camera } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchableSelect } from '@/components/SearchableSelect';
import { RecentTransactions } from '@/components/RecentTransactions';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';

import { useOfflineSync } from '@/hooks/useOfflineSync';
import { db } from '@/lib/db';
import { toast } from 'react-hot-toast';
import { ImportTransactionsModal } from '@/components/ImportTransactionsModal';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';
import BinQuickSelect from '@/components/stock/BinQuickSelect';
import { errorMessage } from '@/lib/errors';

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
  const [currentBin, setCurrentBin] = useState('');
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
      setCurrentBin('');
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
        { sku: currentSku, qty: currentQty, salePrice: currentPrice, location: currentBin }
     ]);
     // Clear inputs
     setCurrentSku('');
     setCurrentQty('');
     setCurrentPrice('');
     setCurrentBin('');
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
    } catch (error) {
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
          alert('Error: ' + errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-20 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto relative z-10 space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {t('back_to_dashboard')}
        </Link>

        {/* Open Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-1"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Dispatch Workspace
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <PackageMinus className="w-7 h-7 text-rose-600 shrink-0" />
              <span>{t('outbound_order')}</span>
            </h1>
            <p className="text-slate-600 font-medium text-xs sm:text-sm mt-0.5">{t('outbound_subtitle')}</p>
          </div>

          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 px-4 py-2 rounded-full font-semibold text-xs transition-all active:scale-95 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-rose-600" />
            <span>{t('import_excel')}</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-1 space-y-6">
            {/* Document Info Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="nx-glass-card p-6"
            >
              <h3 className="font-bold text-slate-900 mb-5 uppercase text-xs tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" /> {t('document_info')}
              </h3>
              <div className="space-y-4">
                <div className="group">
                  <label className="text-xs text-slate-600 font-semibold mb-1.5 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">
                    {t('date')}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full bg-white/85 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all font-medium tabular-nums"
                    />
                  </div>
                </div>
                <div className="group">
                  <label className="text-xs text-slate-600 font-semibold mb-1.5 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">
                    {t('reference_inv')}
                  </label>
                  <input
                    type="text"
                    value={docRef}
                    onChange={e => setDocRef(e.target.value)}
                    placeholder="e.g. INV-2024-001"
                    className="w-full bg-white/85 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all font-medium"
                  />
                </div>
              </div>
            </motion.div>

            {/* Add Item Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="nx-glass-card p-6"
            >
              <h3 className="font-bold text-slate-900 mb-5 uppercase text-xs tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-rose-600" /> {t('add_item')}
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-600 font-semibold block uppercase tracking-wider">{t('product')}</label>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 active:scale-95 transition-transform"
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
                        onChange={(val) => {
                          setCurrentSku(val);
                          setCurrentBin('');
                        }}
                        placeholder="-- Select Product --"
                        disabled={loading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="p-3 bg-rose-500/12 hover:bg-rose-500/20 text-rose-700 rounded-full border border-rose-500/25 transition-colors shrink-0"
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
                      <div className="bg-amber-500/12 border border-amber-500/25 rounded-2xl p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-amber-800 uppercase">
                            {t('fifo_recommendation')}
                          </p>
                          <p className="text-xs text-amber-900 mt-0.5">
                            Pick stock from <strong>{p.fifo.oldestDate}</strong> (<span className="tabular-nums">{p.fifo.maxDaysOld}</span> days old).
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {currentSku && (() => {
                  const foundProd = products.find(prod => prod.name === currentSku || prod.id === currentSku);
                  const realSku = foundProd?.sku || foundProd?.id || currentSku;
                  return (
                    <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl">
                      <BinQuickSelect
                        sku={realSku}
                        selectedBin={currentBin}
                        onSelectBin={setCurrentBin}
                        mode="picking"
                        theme="light"
                        label="ช่องเก็บที่ต้องการหยิบออก (คลิกเลือก):"
                      />
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="group">
                    <label className="text-xs text-slate-600 font-semibold mb-1.5 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">
                      {t('qty')}
                    </label>
                    <input
                      type="number"
                      value={currentQty}
                      onChange={e => setCurrentQty(e.target.value)}
                      className="w-full bg-white/85 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold tabular-nums outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div className="group">
                    <label className="text-xs text-slate-600 font-semibold mb-1.5 block uppercase tracking-wider group-focus-within:text-rose-600 transition-colors">
                      {t('price_opt')}
                    </label>
                    <input
                      type="number"
                      value={currentPrice}
                      onChange={e => setCurrentPrice(e.target.value)}
                      className="w-full bg-white/85 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 tabular-nums outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* FIFO/FEFO Preview Info Box */}
                {fifoPreview && currentSku && currentQty && (
                  <div className="p-3.5 bg-sky-500/10 border border-sky-500/25 rounded-2xl">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs w-full">
                        {/* Method Toggle */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-sky-900">
                            {fifoMethod === 'FIFO' ? 'FIFO (ของเก่าก่อน)' : 'FEFO (หมดอายุก่อน)'}
                          </p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setFifoMethod('FIFO')}
                              className={`px-2.5 py-0.5 text-[11px] rounded-full font-bold transition-colors ${
                                fifoMethod === 'FIFO' ? 'bg-sky-600 text-white' : 'bg-white/80 text-sky-700 border border-sky-200'
                              }`}
                            >
                              FIFO
                            </button>
                            <button
                              onClick={() => setFifoMethod('FEFO')}
                              className={`px-2.5 py-0.5 text-[11px] rounded-full font-bold transition-colors ${
                                fifoMethod === 'FEFO' ? 'bg-amber-500 text-white' : 'bg-white/80 text-amber-700 border border-amber-200'
                              }`}
                            >
                              FEFO
                            </button>
                          </div>
                        </div>
                        {fifoLoading ? (
                          <p className="text-sky-700">กำลังคำนวณ...</p>
                        ) : fifoPreview.allocations?.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-sky-800">
                              สต๊อคคงเหลือ: <strong className="tabular-nums">{fifoPreview.currentStock}</strong> ชิ้น
                            </p>
                            <p className="text-sky-800">จะดึงจาก:</p>
                            <ul className="list-disc list-inside text-sky-700 space-y-0.5">
                              {fifoPreview.allocations.map((a: any, i: number) => (
                                <li key={i}>
                                  <strong className="tabular-nums">{a.qtyFromLayer}</strong> ชิ้น
                                  {a.expiryDate ? ` (หมดอายุ ${a.expiryDate})` : ` (รับ ${a.date})`}
                                  <span className="text-slate-500 tabular-nums"> • {a.daysOld} วัน</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-rose-600 font-semibold">⚠️ สต๊อคไม่เพียงพอ!</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={addItem}
                  disabled={!currentSku || !currentQty}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98] text-sm"
                >
                  <Plus className="w-4 h-4" /> {t('add_to_list')}
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
            <div className="nx-glass-card overflow-hidden min-h-[500px] flex flex-col">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 flex items-center gap-2.5 text-base">
                  {t('items_list')}
                  <span className="bg-rose-500/12 text-rose-700 text-xs px-2.5 py-0.5 rounded-full border border-rose-500/20 font-bold tabular-nums">
                    {items.length}
                  </span>
                </h3>
                {items.length > 0 && (
                  <button
                    onClick={() => setItems([])}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold uppercase tracking-wider transition-colors"
                  >
                    {t('clear_all')}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                    <PackageMinus className="w-14 h-14 mb-3 stroke-1 opacity-60" />
                    <p className="text-base font-semibold text-slate-600">{t('no_items_added')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('select_product_prompt')}</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50/90 text-slate-600 uppercase font-semibold text-[11px] tracking-wider sticky top-0 z-20 border-b border-slate-200/80">
                      <tr>
                        <th className="p-4">{t('product')}</th>
                        <th className="p-4 text-right">{t('qty')}</th>
                        <th className="p-4 text-right">{t('price_opt')}</th>
                        <th className="p-4 text-center">{t('edit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <AnimatePresence mode="popLayout">
                        {items.map((item, i) => (
                          <motion.tr
                            key={`${item.sku}-${i}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group hover:bg-rose-50/30 transition-colors"
                          >
                            <td className="p-4 font-semibold text-slate-900">
                              <div>{item.sku}</div>
                              {item.location && (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 mt-1 rounded-full bg-rose-500/10 text-rose-700 border border-rose-500/20 font-mono font-semibold">
                                  ช่อง: {item.location}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right font-mono text-rose-600 font-bold text-base tabular-nums">
                              {parseInt(item.qty).toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono text-slate-600 tabular-nums">
                              {item.salePrice ? `฿${item.salePrice}` : '-'}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => removeItem(i)}
                                className="p-2 hover:bg-rose-500/12 text-slate-400 hover:text-rose-600 rounded-full transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-5 bg-slate-50/70 border-t border-slate-200/80">
                <button
                  onClick={handleSubmit}
                  disabled={items.length === 0 || submitting}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 rounded-full shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                  <span className="tabular-nums">{t('confirm_outbound')} ({items.length})</span>
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
          className="col-span-full"
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
