'use client';

import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle, Search, Camera, AlertTriangle, RefreshCw, MapPin, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileNav from '@/components/MobileNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { appAlert } from '@/components/ui/MobileDialog';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';

interface DailyCountItem {
  product_name: string;
  location: string;
  zone: string;
  system_qty: number;
  unit: string;
  movement_type: 'IN' | 'OUT' | 'BOTH';
  today_in: number;
  today_out: number;
  last_movement: string;
}

interface LogEntry {
  product_name: string;
  location?: string;
  count_date: string;
  inspector: string;
  system_qty: number;
  actual_qty: number;
  variance: number;
  status: string;
}

export default function CycleCountPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'count' | 'history'>('count');
  const [items, setItems] = useState<DailyCountItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Zone filtering
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [zones, setZones] = useState<string[]>([]);

  // Count Form State
  const [selectedProduct, setSelectedProduct] = useState<DailyCountItem | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [inspector, setInspector] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Variance handling
  const [showVarianceAlert, setShowVarianceAlert] = useState(false);
  const [varianceReason, setVarianceReason] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const { sendNotification } = useNotification();

  useEffect(() => {
    fetchData();
    fetchLogs();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/cycle-count/daily'));
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);

        // Extract unique zones
        const uniqueZones = Array.from(new Set(data.map((item: DailyCountItem) => item.zone)));
        setZones(['All', ...uniqueZones.sort()]);

        // Notify if there are items
        if (data.length > 0) {
          sendNotification(t('alert_cycle_tasks'), {
            body: t('alert_cycle_body').replace('{0}', String(data.length)),
            tag: 'cycle-count',
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch daily count items', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(getApiUrl('/api/cycle-count'));
      const json = await res.json();
      if (Array.isArray(json)) setLogs(json);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !actualQty) return void appAlert(t('alert_input_actual'));

    const sysQty = selectedProduct.system_qty;
    const actQty = parseFloat(actualQty);
    const variance = actQty - sysQty;

    // If variance exists, show alert
    if (variance !== 0) {
      setShowVarianceAlert(true);
      return;
    }

    // No variance, submit directly
    await submitCount();
  };

  const submitCount = async () => {
    if (!selectedProduct || !actualQty) return;

    try {
      const res = await fetch(getApiUrl('/api/cycle-count'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: selectedProduct.product_name,
          location: selectedProduct.location,
          system_qty: selectedProduct.system_qty,
          actual_qty: actualQty,
          inspector: inspector || t('staff'),
          variance_reason: varianceReason,
          photo_url: photoUrl,
        }),
      });

      if (res.ok) {
        // Remove from list to prevent double counting
        setItems(prev => prev.filter(item => item.product_name !== selectedProduct.product_name));

        const result = await res.json();
        appAlert(`✅ ${t('save_success')}${result.has_variance ? ` ${t('difference')}: ${result.variance}` : ''}`);
        resetForm();
        fetchLogs();
      } else {
        appAlert(`❌ ${t('save_failed')}`);
      }
    } catch (e) {
      appAlert('Error: ' + e);
    }
  };

  const resetForm = () => {
    setActualQty('');
    setVarianceReason('');
    setPhotoUrl('');
    setSelectedProduct(null);
    setShowVarianceAlert(false);
  };

  // Filter items by zone and search
  const filteredItems = items.filter(item => {
    const matchesZone = selectedZone === 'All' || item.zone === selectedZone;
    const matchesSearch =
      searchQuery === '' ||
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  const getMovementIcon = (type: string) => {
    if (type === 'IN') return '📥';
    if (type === 'OUT') return '📤';
    return '🔄';
  };

  const getMovementColor = (type: string) => {
    if (type === 'IN') return 'text-emerald-700 bg-emerald-500/12 border-emerald-500/20';
    if (type === 'OUT') return 'text-amber-800 bg-amber-500/15 border-amber-500/25';
    return 'text-sky-700 bg-sky-500/12 border-sky-500/20';
  };

  return (
    <div className="relative min-h-screen pb-28 text-slate-900">
      <div className="relative z-10 max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl p-5 border-b border-white/85 shadow-sm sticky top-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/15 border border-amber-500/25 rounded-2xl">
                <ClipboardCheck className="w-7 h-7 text-amber-700" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('cycle_count_title')}</h1>
                <p className="text-slate-500 text-xs font-medium">{t('cycle_count_subtitle')}</p>
              </div>
            </div>
            {loading && <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />}
          </div>

          {activeTab === 'count' && items.length > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 nx-dark-accent-card p-4"
            >
              <div className="flex justify-between items-center">
                <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">✨ {t('target_today')}</span>
                <span className="text-2xl font-black text-white tabular-nums">
                  {filteredItems.length} <span className="text-sm font-semibold text-emerald-300">{t('ai_unit')}</span>
                </span>
              </div>
              <div className="w-full bg-white/15 h-1.5 mt-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-1/3 rounded-full" />
              </div>
            </motion.div>
          )}
        </div>

        {/* Pill Tabs */}
        <div className="px-4 pt-3 pb-1 sticky top-[104px] z-10">
          <div className="nx-glass-card p-1.5 flex gap-1.5 rounded-full">
            <button
              onClick={() => setActiveTab('count')}
              className={cn(
                'flex-1 min-h-[44px] py-2.5 rounded-full text-sm font-bold transition-all tabular-nums',
                activeTab === 'count'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {t('tab_count')} ({filteredItems.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                'flex-1 min-h-[44px] py-2.5 rounded-full text-sm font-bold transition-all',
                activeTab === 'history'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {t('tab_history')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* COUNT TAB */}
          {activeTab === 'count' && (
            <>
              {!selectedProduct ? (
                <>
                  {/* Zone Tabs */}
                  {loading ? (
                    <div className="flex gap-2 overflow-x-auto pb-4">
                      <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                      <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                      <Skeleton className="h-10 w-24 rounded-full flex-shrink-0" />
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                      {zones.map(zone => (
                        <button
                          key={zone}
                          onClick={() => setSelectedZone(zone)}
                          className={cn(
                            'min-h-[44px] px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border',
                            selectedZone === zone
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white/85 border-white/90 text-slate-600 hover:bg-white'
                          )}
                        >
                          {zone === 'All' ? t('all_zones') : t('zone_label').replace('{0}', zone)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Search */}
                  <div className="nx-glass-card p-2.5 flex gap-3 items-center mb-5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Search className="text-slate-400 w-5 h-5 ml-2 shrink-0" />
                    <input
                      type="text"
                      placeholder={t('search_product_loc')}
                      className="bg-transparent text-slate-900 outline-none flex-1 placeholder:text-slate-400 font-medium h-10 text-sm"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Items List */}
                  <div className="space-y-3.5">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-[22px]" />
                      ))
                    ) : filteredItems.length === 0 ? (
                      <div className="nx-glass-card text-center py-16 text-slate-500 flex flex-col items-center">
                        <div className="w-16 h-16 bg-emerald-500/12 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle className="w-8 h-8 text-emerald-600" />
                        </div>
                        <p className="font-bold text-lg text-slate-900">{t('all_caught_up')}</p>
                        <p className="text-sm text-slate-500 mt-1">{t('no_items_remaining')}</p>
                      </div>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {filteredItems.map((item, i) => (
                          <motion.div
                            key={item.product_name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => setSelectedProduct(item)}
                            className="nx-glass-card p-5 active:scale-[0.98] transition-all cursor-pointer hover:bg-white/90"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-500/12 px-3 py-1 rounded-full border border-sky-500/20">
                                <MapPin className="w-3 h-3" /> {item.location}
                              </span>
                              <span className={cn('text-sm px-2.5 py-1 rounded-full border', getMovementColor(item.movement_type))}>
                                {getMovementIcon(item.movement_type)}
                              </span>
                            </div>

                            <h3 className="font-bold text-slate-900 text-base mb-3.5 line-clamp-2 leading-snug">
                              {item.product_name}
                            </h3>

                            <div className="bg-white/75 border border-slate-200/70 rounded-2xl p-3 grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5">{t('system_qty_label')}</span>
                                <span className="text-slate-900 font-black text-lg tabular-nums">
                                  {item.system_qty} <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5">{t('today_flow')}</span>
                                <span className={cn('font-black text-lg tabular-nums', item.movement_type === 'IN' ? 'text-emerald-700' : 'text-amber-700')}>
                                  {item.movement_type === 'IN' ? `+${item.today_in}` : `-${item.today_out}`}{' '}
                                  <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
                                </span>
                              </div>
                            </div>

                            <div className="mt-3.5 flex justify-end items-center gap-1.5 text-emerald-700 font-bold text-xs">
                              <span>{t('tap_to_count')}</span>
                              <span className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </>
              ) : (
                /* Count Form */
                <div className="max-w-md mx-auto pb-20">
                  <AnimatePresence mode="wait">
                    {showVarianceAlert ? (
                      /* Variance Alert */
                      <motion.div
                        key="alert"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        className="nx-glass-card border-2 border-amber-500/35 p-6 relative z-50"
                      >
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-amber-500/15 border border-amber-500/25 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                            <AlertTriangle className="w-8 h-8 text-amber-600" />
                          </div>
                          <h2 className="text-xl font-black text-slate-900 mb-1">⚠️ {t('variance_detected')}</h2>
                          <p className="text-slate-600 text-sm font-medium">{t('review_discrepancy')}</p>
                        </div>

                        <div className="bg-white/85 rounded-2xl p-5 mb-5 border border-slate-200/80">
                          <div className="grid grid-cols-2 gap-6 text-center relative">
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />
                            <div>
                              <div className="text-slate-500 text-xs font-bold uppercase mb-1">{t('legend_system') || 'System'}</div>
                              <div className="text-3xl font-black text-slate-900 tabular-nums">{selectedProduct.system_qty}</div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs font-bold uppercase mb-1">{t('counted')}</div>
                              <div className="text-3xl font-black text-amber-700 tabular-nums">{actualQty}</div>
                            </div>
                          </div>
                          <div className="text-center mt-5 pt-5 border-t border-slate-200">
                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">{t('difference')}</div>
                            <div
                              className={cn(
                                'text-4xl font-black tracking-tight tabular-nums',
                                parseFloat(actualQty) > selectedProduct.system_qty ? 'text-emerald-600' : 'text-rose-600'
                              )}
                            >
                              {parseFloat(actualQty) > selectedProduct.system_qty ? '+' : ''}
                              {parseFloat(actualQty) - selectedProduct.system_qty}{' '}
                              <span className="text-base font-bold text-slate-500">{selectedProduct.unit}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-slate-600 text-xs font-bold uppercase mb-1.5 ml-1">{t('reason_optional')}</label>
                            <textarea
                              value={varianceReason}
                              onChange={e => setVarianceReason(e.target.value)}
                              className="w-full bg-white/90 border border-slate-200 rounded-2xl p-4 text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 resize-none placeholder:text-slate-400 font-medium transition-all"
                              rows={3}
                              placeholder="e.g. Found damaged items, Unrecorded stock..."
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 text-xs font-bold uppercase mb-1.5 ml-1">{t('evidence_optional')}</label>
                            <button
                              type="button"
                              className="w-full min-h-[52px] bg-white/80 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-slate-600 hover:bg-white hover:border-emerald-400 transition-all flex items-center justify-center gap-2"
                            >
                              <Camera className="w-5 h-5 text-slate-500" />
                              <span className="font-bold text-sm">{t('add_photo_evidence')}</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 space-y-2.5">
                          <button
                            onClick={submitCount}
                            className="w-full min-h-[52px] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/25 text-base flex items-center justify-center gap-2"
                          >
                            <span>{t('confirm_variance')}</span> <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setShowVarianceAlert(false);
                              setActualQty('');
                            }}
                            className="w-full min-h-[44px] py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-full transition-colors text-sm"
                          >
                            {t('go_back_recount')}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      /* Count Entry Form */
                      <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="nx-glass-card p-5 relative z-40"
                      >
                        <form onSubmit={handleCountSubmit} className="space-y-6">
                          {/* Product Target Readout */}
                          <div className="nx-dark-accent-card p-6 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-sky-300 mb-3">
                              <MapPin className="w-3.5 h-3.5" /> {selectedProduct.location}
                            </div>
                            <h2 className="text-xl font-black text-white mb-1.5 leading-tight">{selectedProduct.product_name}</h2>
                            <p className="text-emerald-300 font-semibold text-sm tabular-nums">
                              {t('target') || 'Target'}: {selectedProduct.system_qty} {selectedProduct.unit}
                            </p>
                          </div>

                          {/* Input */}
                          <div className="bg-white/80 rounded-2xl p-5 border border-slate-200/80 text-center">
                            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
                              {t('enter_actual_qty')}
                            </label>
                            <div className="relative max-w-[200px] mx-auto">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                autoFocus
                                required
                                value={actualQty}
                                onChange={e => setActualQty(e.target.value)}
                                className="w-full bg-white border-2 border-slate-200 rounded-2xl py-5 text-4xl text-center text-slate-900 font-black tabular-nums outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-xs placeholder:text-slate-300"
                                placeholder="0"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-slate-600 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                              {t('inspector_name')}
                            </label>
                            <input
                              type="text"
                              value={inspector}
                              onChange={e => setInspector(e.target.value)}
                              className="w-full min-h-[48px] bg-white/90 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400"
                              placeholder={t('placeholder_name') || 'Your Name...'}
                            />
                          </div>

                          {/* Actions */}
                          <div className="pt-1 space-y-2.5">
                            <button
                              type="submit"
                              className="w-full min-h-[52px] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold rounded-full transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
                            >
                              <span>{t('verify_count')}</span> <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={resetForm}
                              className="w-full min-h-[44px] py-3 text-slate-500 font-bold hover:text-slate-800 hover:bg-white/60 rounded-full transition-colors text-sm"
                            >
                              {t('btn_cancel')}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="nx-glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/70 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200/80">
                    <tr>
                      <th className="p-3.5">{t('col_date')}</th>
                      <th className="p-3.5">{t('product')}</th>
                      <th className="p-3.5 text-right">SYS</th>
                      <th className="p-3.5 text-right">ACT</th>
                      <th className="p-3.5 text-right">VAR</th>
                      <th className="p-3.5 text-right">{t('col_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-slate-700">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">{t('no_history_logs')}</td>
                      </tr>
                    ) : (
                      logs.map((log, i) => (
                        <tr key={i} className="hover:bg-white/60 transition-colors">
                          <td className="p-3.5 text-xs font-mono text-slate-500 tabular-nums">{log.count_date}</td>
                          <td className="p-3.5 font-bold text-slate-900 text-xs max-w-[120px]">
                            <div className="truncate">{log.product_name}</div>
                            {log.location && (
                              <div className="text-[10px] text-slate-500 font-semibold mt-0.5 whitespace-nowrap">
                                📍 {log.location}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono tabular-nums">{log.system_qty}</td>
                          <td className="p-3.5 text-right font-mono tabular-nums text-slate-900 font-bold">{log.actual_qty}</td>
                          <td
                            className={cn(
                              'p-3.5 text-right font-black font-mono tabular-nums',
                              log.variance === 0 ? 'text-slate-400' : log.variance > 0 ? 'text-emerald-600' : 'text-rose-600'
                            )}
                          >
                            {log.variance > 0 ? `+${log.variance}` : log.variance}
                          </td>
                          <td className="p-3.5 text-right">
                            {log.variance === 0 ? (
                              <span className="bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                {t('matched')}
                              </span>
                            ) : (
                              <span className="bg-amber-500/15 text-amber-800 border border-amber-500/25 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                {t('variance_status')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileNav />
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
