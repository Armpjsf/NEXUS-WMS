'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Package,
  X,
  Send,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  Printer,
  Building2,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { speakThai } from '@/lib/voiceAssistant';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface SuggestionsItem {
    id: string;
    name: string;
    currentStock: number;
    minStock: number;
    suggestedQty: number;
    price: number;
    confidence: number;
    reason: string;
    sparkline?: string;
    trendInfo?: {
        slope: number;
        growth: number;
        direction: 'UP' | 'DOWN' | 'STABLE';
    };
}

interface CartItem extends SuggestionsItem {
    orderQty: number;
}

export default function AIReorderPage() {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState<SuggestionsItem[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  // Suppliers for PO
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [createdPoResult, setCreatedPoResult] = useState<any | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch(getApiUrl('/api/ai/reorder'))
      .then(res => res.json())
      .then(data => {
          if (Array.isArray(data)) {
              setSuggestions(data);
          } else if (data?.suggestions && Array.isArray(data.suggestions)) {
              setSuggestions(data.suggestions);
          }
          setLoading(false);
      })
      .catch(err => {
          console.error(err);
          setLoading(false);
      });

    // Load total monitored products count
    fetch(getApiUrl('/api/products'))
      .then(res => res.json())
      .then(data => {
          if (Array.isArray(data)) {
              setTotalProducts(data.length);
          }
      })
      .catch(() => {});

    // Load suppliers
    fetch('/api/suppliers')
      .then(res => res.json())
      .then(data => {
          if (Array.isArray(data)) {
              setSuppliers(data);
              if (data.length > 0 && !selectedSupplier) {
                  setSelectedSupplier(data[0].name);
              }
          }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReanalyze = () => {
      setAnalyzing(true);
      setTimeout(() => {
          setAnalyzing(false);
          fetchData();
      }, 800);
  };

  // Cart Functions
  const addToCart = (item: SuggestionsItem) => {
      setCart(prev => {
          const existing = prev.find(c => c.id === item.id);
          if (existing) {
              return prev.map(c => c.id === item.id ? { ...c, orderQty: c.orderQty + item.suggestedQty } : c);
          }
          return [...prev, { ...item, orderQty: item.suggestedQty }];
      });
      setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
      setCart(prev => prev.filter(c => c.id !== id));
  };

  const updateCartQty = (id: string, delta: number) => {
      setCart(prev => prev.map(c => {
          if (c.id === id) {
              const newQty = Math.max(1, c.orderQty + delta);
              return { ...c, orderQty: newQty };
          }
          return c;
      }));
  };

  const submitPO = async () => {
      setSubmitting(true);
      try {
          const body = {
             supplier: selectedSupplier || 'ผู้จำหน่ายทั่วไป',
             notes: poNotes,
             items: cart.map(c => ({
                 id: c.id,
                 sku: c.id,
                 name: c.name,
                 qty: c.orderQty,
                 price: c.price,
                 total: c.orderQty * c.price
             })),
             totalAmount: cart.reduce((sum, item) => sum + (item.price * item.orderQty), 0)
          };

          const res = await fetch(getApiUrl('/api/po/create'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          const json = await res.json();
          if (res.ok && json.success) {
              speakThai('สร้างใบสั่งซื้อสินค้าสำเร็จ');
              toast.success(`สร้างใบสั่งซื้อ ${json.po?.po_number || ''} สำเร็จ!`);
              setCreatedPoResult(json.po);
              setCart([]);
              setIsCartOpen(false);
          } else {
              toast.error(json.error || 'ไม่สามารถสร้างใบสั่งซื้อได้');
          }
      } catch (err) {
          console.error(err);
          toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ');
      } finally {
          setSubmitting(false);
      }
  };

  const filtered = suggestions.filter(s => {
      if (activeTab === 'CRITICAL') return s.confidence >= 90;
      if (activeTab === 'WARNING') return s.confidence >= 70 && s.confidence < 90;
      return true;
  });

  const criticalCount = suggestions.filter(s => s.confidence >= 90).length;
  const warningCount = suggestions.filter(s => s.confidence >= 70 && s.confidence < 90).length;
  const highVelocityCount = suggestions.filter(s => (s.trendInfo?.growth || 0) > 10).length;
  const totalEstimatedCost = suggestions.reduce((a, b) => a + (b.suggestedQty * b.price), 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.orderQty), 0);

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
          <Link
              href="/analytics"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
          >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              {t('back_to_analytics')}
          </Link>

          {/* Open Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1"
          >
              <div>
                  <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          Autonomous Inventory Engine
                      </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                      {t('ai_title')}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5 max-w-2xl">
                      {t('ai_subtitle')}
                  </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                   <button
                      onClick={handleReanalyze}
                      disabled={analyzing}
                      className="px-4 py-2 bg-white/80 hover:bg-white border border-white/90 text-slate-700 hover:text-slate-900 rounded-full text-xs font-semibold transition-all flex items-center gap-2 group disabled:opacity-50 shadow-xs"
                   >
                       <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${analyzing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
                       {analyzing ? t('ai_analyzing') : t('ai_reanalyze')}
                   </button>
                   <button
                      onClick={() => setIsCartOpen(true)}
                      className="relative px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"
                   >
                       <ShoppingCart className="w-3.5 h-3.5" />
                       <span>{t('ai_cart')}</span>
                       {cart.length > 0 && (
                           <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                               {cart.length}
                           </span>
                       )}
                   </button>
              </div>
          </motion.div>

          {/* Quick Stats Grid (with 1 Dark Hero Alert Card for Critical Stock) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                  label={t('ai_total_items')}
                  value={(totalProducts || suggestions.length).toLocaleString()}
                  icon={Package}
                  color="sky"
                  subtext={t('ai_monitored')}
              />

              {/* Hero Dark Accent Card for Critical Stock */}
              <div className="nx-dark-accent-card p-5 flex items-start justify-between">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          Priority
                      </div>
                      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t('ai_critical_stock')}</p>
                      <div className="text-3xl font-bold text-white tracking-tight tabular-nums mt-1">{criticalCount.toLocaleString()}</div>
                      <p className="text-xs font-medium text-slate-400 mt-1">{t('ai_action_needed')}</p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                  </div>
              </div>

              <KPICard
                  label={t('ai_high_velocity')}
                  value={highVelocityCount.toLocaleString()}
                  icon={TrendingUp}
                  color="emerald"
                  subtext={t('ai_trending_up')}
              />
              <KPICard
                  label={t('ai_po_value')}
                  value={`฿${totalEstimatedCost.toLocaleString()}`}
                  icon={DollarSign}
                  color="amber"
                  subtext={t('ai_estimated_cost')}
              />
          </div>

          {/* Pill Filters */}
          <div className="nx-glass-card p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                  <TabButton
                      label={t('ai_all_suggestions')}
                      active={activeTab === 'ALL'}
                      onClick={() => setActiveTab('ALL')}
                      count={suggestions.length}
                  />
                  <TabButton
                      label={t('ai_critical')}
                      active={activeTab === 'CRITICAL'}
                      onClick={() => setActiveTab('CRITICAL')}
                      count={criticalCount}
                      tone="rose"
                  />
                  <TabButton
                      label={t('ai_warnings')}
                      active={activeTab === 'WARNING'}
                      onClick={() => setActiveTab('WARNING')}
                      count={warningCount}
                      tone="amber"
                  />
              </div>
              <span className="text-xs font-semibold text-slate-600 px-2 tabular-nums">
                  {filtered.length.toLocaleString()} suggestions
              </span>
          </div>

          {/* Suggestions List */}
          {loading ? (
              <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full nx-glass-card" />)}
              </div>
          ) : filtered.length === 0 ? (
              <div className="nx-glass-card p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">สต็อกอยู่ในเกณฑ์ปกติ</h3>
                  <p className="text-slate-600 max-w-md mx-auto text-sm">
                      {activeTab === 'CRITICAL'
                          ? 'ไม่พบสินค้าที่มีสต็อกในระดับวิกฤต'
                          : activeTab === 'WARNING'
                          ? 'ไม่พบสินค้าที่มีสัญญาณเตือนสต็อกต่ำ'
                          : 'สินค้าทุกรายการมีปริมาณสต็อกเพียงพอต่อความต้องการ ยังไม่ต้องสั่งซื้อเพิ่มในขณะนี้'}
                  </p>
              </div>
          ) : (
              <div className="grid grid-cols-1 gap-4 pb-16">
                  <AnimatePresence>
                      {filtered.map((item, idx) => (
                          <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 14 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                              className="nx-glass-card p-6 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
                          >
                              {/* Left Border Indicator */}
                              <div className={cn(
                                  "absolute left-0 top-0 bottom-0 w-1.5",
                                  item.confidence >= 90 ? 'bg-rose-500' :
                                  item.confidence >= 70 ? 'bg-amber-500' : 'bg-sky-500'
                              )} />

                              <div className="flex flex-col md:flex-row gap-6 pl-2">
                                  {/* Info Section */}
                                  <div className="flex-1">
                                      <div className="flex items-start justify-between mb-4 gap-4">
                                          <div>
                                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                                  <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                                                  {item.confidence >= 90 && (
                                                      <span className="px-2.5 py-0.5 bg-rose-500/12 border border-rose-500/25 text-rose-700 text-[10px] font-bold uppercase tracking-wide rounded-full">
                                                          {t('ai_critical')}
                                                      </span>
                                                  )}
                                              </div>
                                              <p className="text-xs text-slate-500 font-mono">ID: {item.id}</p>
                                          </div>
                                          <div className="text-right shrink-0">
                                              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                                                  {item.suggestedQty.toLocaleString()} <span className="text-xs font-medium text-slate-500">{t('ai_unit')}</span>
                                              </div>
                                              <p className="text-xs text-slate-500">
                                                  {t('ai_suggested_add')}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Stocks */}
                                      <div className="flex flex-wrap gap-8 mb-5">
                                          <div>
                                              <p className="text-[11px] text-slate-500 uppercase font-semibold mb-0.5">{t('ai_current_stock')}</p>
                                              <p className={cn("text-lg font-bold tabular-nums", item.currentStock <= item.minStock ? 'text-rose-600' : 'text-slate-900')}>
                                                  {item.currentStock.toLocaleString()}
                                              </p>
                                          </div>
                                          <div>
                                              <p className="text-[11px] text-slate-500 uppercase font-semibold mb-0.5">{t('ai_min_stock')}</p>
                                              <p className="text-lg font-bold text-slate-700 tabular-nums">{item.minStock.toLocaleString()}</p>
                                          </div>
                                          <div>
                                              <p className="text-[11px] text-slate-500 uppercase font-semibold mb-0.5">{t('ai_est_cost')}</p>
                                              <p className="text-lg font-bold text-slate-900 tabular-nums">฿{(item.suggestedQty * item.price).toLocaleString()}</p>
                                          </div>
                                      </div>

                                      {/* AI Insight Box */}
                                      <div className="bg-slate-50/90 rounded-2xl p-3.5 mb-5 border border-slate-200/80">
                                          <div className="flex gap-3">
                                              <div className={cn(
                                                  "mt-0.5 p-1.5 rounded-xl border h-fit",
                                                  item.trendInfo?.direction === 'UP' ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-700' :
                                                  item.confidence > 80 ? 'bg-rose-500/12 border-rose-500/25 text-rose-700' : 'bg-amber-500/15 border-amber-500/25 text-amber-700'
                                              )}>
                                                  {item.trendInfo?.direction === 'UP' ? (
                                                      <TrendingUp className="w-3.5 h-3.5" />
                                                  ) : (
                                                      <Sparkles className="w-3.5 h-3.5" />
                                                  )}
                                              </div>
                                              <div className="flex-1">
                                                  <div className="flex justify-between items-center mb-0.5 gap-2">
                                                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('ai_insight')}</p>
                                                      {item.trendInfo && Math.abs(item.trendInfo.growth) > 5 && (
                                                          <span className={cn(
                                                              "text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums",
                                                              item.trendInfo.growth > 0 ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' : 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                                                          )}>
                                                              {item.trendInfo.growth > 0 ? '+' : ''}{item.trendInfo.growth.toFixed(1)}% Growth
                                                          </span>
                                                      )}
                                                  </div>
                                                  <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex gap-2.5">
                                          <button
                                              onClick={() => addToCart(item)}
                                              className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                                          >
                                              <Plus className="w-4 h-4" />
                                              {t('ai_add_to_cart')}
                                          </button>
                                          <button className="px-4 py-2.5 bg-white/80 hover:bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-full font-semibold text-xs transition-colors">
                                              {t('ai_ignore')}
                                          </button>
                                      </div>
                                  </div>

                                  {/* Right Side: 7-Day Usage Mini Chart */}
                                  <div className="hidden lg:flex w-52 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 self-stretch flex-col justify-between">
                                      <div>
                                          <div className="flex items-center justify-between mb-2">
                                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">7-Day Usage</p>
                                              {(() => {
                                                  const values = item.sparkline?.split(',').map(Number) || [];
                                                  const total = values.reduce((a, b) => a + b, 0);
                                                  return <span className="text-[11px] font-bold text-sky-700 tabular-nums">{total}u</span>;
                                              })()}
                                          </div>
                                          <div className="h-20 flex items-end gap-1.5 pt-2">
                                              {(() => {
                                                  const values = item.sparkline?.split(',').map(Number) || [];
                                                  const maxVal = Math.max(1, ...values);
                                                  return values.map((val, i) => {
                                                      const heightPercent = val > 0 ? Math.min(100, Math.max(12, (val / maxVal) * 100)) : 6;
                                                      return (
                                                          <div
                                                              key={i}
                                                              style={{ height: `${heightPercent}%` }}
                                                              className={`flex-1 rounded-t-md transition-all ${val > 0 ? 'bg-sky-500 hover:bg-emerald-500' : 'bg-slate-200'}`}
                                                              title={`Day ${i + 1}: ${val} units`}
                                                          />
                                                      );
                                                  });
                                              })()}
                                          </div>
                                      </div>
                                      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/80 flex justify-between tabular-nums">
                                          <span>7d History</span>
                                          {(() => {
                                              const values = item.sparkline?.split(',').map(Number) || [];
                                              const peak = Math.max(0, ...values);
                                              return <span className="font-bold text-amber-700">pk: {peak}</span>;
                                          })()}
                                      </div>
                                  </div>
                              </div>
                          </motion.div>
                      ))}
                  </AnimatePresence>
              </div>
          )}
      </div>

      {/* Cart Drawer Overlay */}
      <AnimatePresence>
          {isCartOpen && (
              <>
                  <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsCartOpen(false)}
                      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
                  />
                  <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white/95 backdrop-blur-xl border-l border-slate-200 z-50 shadow-2xl flex flex-col text-slate-900"
                  >
                      {/* Cart Header */}
                      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
                          <div>
                              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                                  {t('ai_cart')}
                              </h2>
                              <p className="text-xs text-slate-500 tabular-nums">{cart.length} items ready to order</p>
                          </div>
                          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-200/70 rounded-full transition-colors text-slate-500 hover:text-slate-900">
                              <X className="w-5 h-5" />
                          </button>
                      </div>

                      {/* Cart Items */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-3">
                          {cart.map(item => (
                              <div key={item.id} className="flex gap-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200">
                                      <Package className="w-5 h-5 text-slate-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-slate-900 text-sm truncate">{item.name}</h4>
                                      <p className="text-xs text-slate-500 font-mono mb-2">{item.id}</p>
                                      <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full p-1">
                                              <button onClick={() => updateCartQty(item.id, -1)} className="p-1 hover:bg-slate-100 rounded-full transition-all">
                                                  <Minus className="w-3 h-3 text-slate-600" />
                                              </button>
                                              <span className="text-xs font-bold text-slate-900 w-8 text-center tabular-nums">{item.orderQty}</span>
                                              <button onClick={() => updateCartQty(item.id, 1)} className="p-1 hover:bg-slate-100 rounded-full transition-all">
                                                  <Plus className="w-3 h-3 text-slate-600" />
                                              </button>
                                          </div>
                                          <div className="text-xs font-bold text-emerald-700 tabular-nums">
                                              ฿{(item.price * item.orderQty).toLocaleString()}
                                          </div>
                                      </div>
                                  </div>
                                  <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-rose-600 transition-colors self-start p-1">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                      </div>

                       {/* Supplier & Notes */}
                       <div className="p-6 border-t border-slate-200 bg-slate-50/70 space-y-3">
                           <div>
                               <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                                   <Building2 className="w-3.5 h-3.5 text-sky-600" />
                                   ผู้จำหน่ายสินค้า (Supplier)
                               </label>
                               <select
                                   value={selectedSupplier}
                                   onChange={e => setSelectedSupplier(e.target.value)}
                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500"
                               >
                                   <option value="">— เลือกผู้จำหน่าย —</option>
                                   {suppliers.map(s => (
                                       <option key={s.id} value={s.name}>
                                           {s.code} - {s.name}
                                       </option>
                                   ))}
                               </select>
                           </div>
                           <div>
                               <label className="block text-xs font-semibold text-slate-700 mb-1">
                                   หมายเหตุใบสั่งซื้อ
                               </label>
                               <input
                                   value={poNotes}
                                   onChange={e => setPoNotes(e.target.value)}
                                   placeholder="เช่น ด่วนที่สุด, ส่งภายในวันศุกร์"
                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
                               />
                           </div>
                       </div>

                       {/* Footer Actions */}
                       <div className="p-6 border-t border-slate-200 bg-white">
                           <div className="flex justify-between items-center mb-5">
                               <span className="text-sm font-medium text-slate-600">{t('ai_cart_total')}</span>
                               <span className="text-2xl font-bold text-slate-900 tabular-nums">฿{cartTotal.toLocaleString()}</span>
                           </div>
                           <button
                               onClick={submitPO}
                               disabled={submitting || cart.length === 0}
                               className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                               {submitting ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                               {submitting ? 'กำลังสร้างใบสั่งซื้อ...' : 'สร้างใบสั่งซื้อ (Generate PO)'}
                           </button>
                       </div>
                  </motion.div>
              </>
          )}
      </AnimatePresence>

      {/* PO Created Success Modal */}
      {createdPoResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-[22px] w-full max-w-lg overflow-hidden shadow-2xl p-6 text-center space-y-4 text-slate-900">
                  <div className="w-16 h-16 bg-emerald-500/12 border border-emerald-500/25 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">สร้างใบสั่งซื้อเรียบร้อยแล้ว!</h3>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-sm space-y-2">
                      <div className="flex justify-between">
                          <span className="text-slate-500">เลขที่ PO:</span>
                          <span className="font-mono font-bold text-sky-700">{createdPoResult.po_number}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-slate-500">ผู้จำหน่าย:</span>
                          <span className="font-bold text-slate-900">{createdPoResult.supplier || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-slate-500">จำนวนรายการ:</span>
                          <span className="font-bold text-slate-900 tabular-nums">{createdPoResult.total_items} รายการ</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-slate-500">ยอดเงินรวม:</span>
                          <span className="font-bold text-emerald-700 tabular-nums">฿{Number(createdPoResult.total_amount || 0).toLocaleString()}</span>
                      </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                      <Link
                          href={`/print/purchase-order?id=${createdPoResult.id}`}
                          target="_blank"
                          className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full flex items-center justify-center gap-2 shadow-sm transition-all text-sm"
                      >
                          <Printer className="w-4 h-4" />
                          พิมพ์ใบสั่งซื้อ (PO)
                      </Link>
                      <Link
                          href="/ops/receiving"
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full flex items-center justify-center gap-2 transition-all text-sm"
                      >
                          <FileText className="w-4 h-4" />
                          ไปหน้าตรวจรับเข้า
                      </Link>
                  </div>
                  <button
                      onClick={() => setCreatedPoResult(null)}
                      className="w-full py-2 text-slate-500 hover:text-slate-900 text-xs font-semibold"
                  >
                      ปิดหน้าต่างนี้
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color, subtext }: { label: string; value: any; icon: any; color: 'emerald' | 'sky' | 'amber'; subtext: string }) {
    const colorStyles = {
        emerald: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700',
        sky: 'bg-sky-500/12 border-sky-500/20 text-sky-700',
        amber: 'bg-amber-500/15 border-amber-500/25 text-amber-700',
    };

    return (
        <div className="nx-glass-card p-5 flex items-start justify-between">
            <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">{label}</p>
                <div className="text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</div>
                <p className="text-xs font-medium text-slate-500 mt-1">{subtext}</p>
            </div>
            <div className={`p-2.5 rounded-2xl border ${colorStyles[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
}

function TabButton({ label, active, onClick, count, tone = 'slate' }: { label: string; active: boolean; onClick: () => void; count: number; tone?: 'slate' | 'rose' | 'amber' }) {
    const activeStyle = tone === 'rose'
        ? 'bg-rose-600 text-white border-rose-600'
        : tone === 'amber'
        ? 'bg-amber-600 text-white border-amber-600'
        : 'bg-slate-900 text-white border-slate-900';

    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border",
                active
                    ? `${activeStyle} shadow-xs`
                    : "bg-white/75 border-white/90 text-slate-600 hover:text-slate-900 hover:bg-white"
            )}
        >
            <span>{label}</span>
            {count > 0 && (
                <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
                    active
                        ? "bg-white/20 text-white"
                        : tone === 'rose'
                        ? "bg-rose-500/12 text-rose-700"
                        : tone === 'amber'
                        ? "bg-amber-500/15 text-amber-800"
                        : "bg-slate-900/8 text-slate-700"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}
