'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart, 
  RefreshCw,
  Activity,
  BarChart3,
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
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Skeleton } from '@/components/ui/Skeleton';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { speakThai } from '@/lib/voiceAssistant';

// Mock Sparkline Data Generator
const generateSparkline = () => {
    return Array.from({ length: 7 }, () => Math.floor(Math.random() * 40) + 10).join(','); 
};

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
              // Enrich with mock sparkline data for UI demo if not present
              const enriched = data.map(item => ({
                  ...item,
                  sparkline: generateSparkline()
              }));
              setSuggestions(enriched);
          }
          setLoading(false);
      })
      .catch(err => {
          console.error(err);
          setLoading(false);
      });

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
      }, 2000); // Fake analysis time
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
      } catch (err: any) {
          console.error(err);
          toast.error(err.message || 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ');
      } finally {
          setSubmitting(false);
      }
  };

  const filtered = suggestions.filter(s => {
      if (activeTab === 'CRITICAL') return s.confidence >= 90;
      if (activeTab === 'WARNING') return s.confidence >= 70 && s.confidence < 90;
      return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.orderQty), 0);

  return (
    <div className="relative min-h-screen bg-slate-50/50 p-4 md:p-8 pb-32 overflow-hidden">
      <AmbientBackground />

      <div className="max-w-7xl mx-auto relative z-10">
          <Link href="/analytics" className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-6 transition-colors font-bold group w-fit">
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
              {t('back_to_analytics')}
          </Link>
          
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/50 shadow-xl shadow-slate-900/5 relative overflow-hidden"
          >
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full" />
              
              <div className="relative z-10">
                  <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                      <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white p-3 rounded-2xl shadow-lg shadow-amber-200">
                        <Sparkles className="w-10 h-10 fill-white" />
                      </div>
                      {t('ai_title')}
                  </h1>
                  <p className="text-slate-500 mt-4 font-medium max-w-xl text-lg ml-2 leading-relaxed">
                      {t('ai_subtitle')}
                  </p>
              </div>
              <div className="flex gap-4 relative z-10">
                   <button 
                      onClick={handleReanalyze}
                      disabled={analyzing}
                      className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 group disabled:opacity-50 active:scale-95 shadow-lg shadow-slate-200/50"
                   >
                       <RefreshCw className={`w-6 h-6 ${analyzing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
                       {analyzing ? t('ai_analyzing') : t('ai_reanalyze')}
                   </button>
                   <button 
                      onClick={() => setIsCartOpen(true)}
                      className="relative px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl font-bold hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 shadow-xl shadow-slate-900/40 active:scale-95"
                   >
                       <ShoppingCart className="w-6 h-6" />
                       <span className="hidden md:inline">{t('ai_cart')}</span>
                       {cart.length > 0 && (
                           <span className="absolute -top-3 -right-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg animate-bounce border-2 border-white">
                               {cart.length}
                           </span>
                       )}
                   </button>
              </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <KPICard label={t('ai_total_items')} value={suggestions.length} icon={Package} color="indigo" subtext={t('ai_monitored')} />
              <KPICard label={t('ai_critical_stock')} value={suggestions.filter(s => s.confidence >= 90).length} icon={AlertTriangle} color="rose" subtext={t('ai_action_needed')} />
              <KPICard label={t('ai_high_velocity')} value={suggestions.filter(s => (s.trendInfo?.growth || 0) > 10).length} icon={TrendingUp} color="emerald" subtext={t('ai_trending_up')} />
              <KPICard label={t('ai_po_value')} value={`฿${suggestions.reduce((a,b) => a + (b.suggestedQty * b.price), 0).toLocaleString()}`} icon={DollarSign} color="emerald" subtext={t('ai_estimated_cost')} />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              <TabButton label={t('ai_all_suggestions')} active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} count={suggestions.length} />
              <TabButton label={t('ai_critical')} active={activeTab === 'CRITICAL'} onClick={() => setActiveTab('CRITICAL')} count={suggestions.filter(s => s.confidence >= 90).length} color="bg-rose-100 text-rose-700" />
              <TabButton label={t('ai_warnings')} active={activeTab === 'WARNING'} onClick={() => setActiveTab('WARNING')} count={suggestions.filter(s => s.confidence >= 70 && s.confidence < 90).length} color="bg-amber-100 text-amber-700" />
          </div>

          {/* Suggestions List */}
          {loading ? (
              <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
              </div>
          ) : (
              <div className="grid grid-cols-1 gap-4 pb-20">
                  <AnimatePresence>
                      {filtered.map((item, idx) => (
                          <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ delay: idx * 0.05 }}
                              className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-lg border border-white/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
                          >
                              {/* Left Border Indicator */}
                              <div className={`absolute left-0 top-0 bottom-0 w-2 ${
                                  item.confidence >= 90 ? 'bg-gradient-to-b from-rose-500 to-pink-600' : 
                                  item.confidence >= 70 ? 'bg-gradient-to-b from-amber-500 to-orange-500' : 'bg-gradient-to-b from-slate-300 to-slate-400'
                              }`} />

                              <div className="flex flex-col md:flex-row gap-6">
                                  {/* Info Section */}
                                  <div className="flex-1">
                                      <div className="flex items-start justify-between mb-4">
                                          <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                  <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                                                  {item.confidence >= 90 && (
                                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wide rounded-md">
                                                          {t('ai_critical')}
                                                      </span>
                                                  )}
                                              </div>
                                              <p className="text-xs text-slate-400 font-mono">ID: {item.id}</p>
                                          </div>
                                          <div className="text-right">
                                              <div className="text-2xl font-black text-slate-900">
                                                  {item.suggestedQty} <span className="text-sm font-medium text-slate-400">{t('ai_unit')}</span>
                                              </div>
                                              <p className="text-xs text-slate-400">
                                                  {t('ai_suggested_add')}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Stocks */}
                                      <div className="flex gap-8 mb-6">
                                          <div>
                                              <p className="text-xs text-slate-400 uppercase font-bold mb-1">{t('ai_current_stock')}</p>
                                              <p className={`text-lg font-bold ${item.currentStock <= item.minStock ? 'text-rose-600' : 'text-slate-700'}`}>
                                                  {item.currentStock}
                                              </p>
                                          </div>
                                          <div>
                                              <p className="text-xs text-slate-400 uppercase font-bold mb-1">{t('ai_min_stock')}</p>
                                              <p className="text-lg font-bold text-slate-700">{item.minStock}</p>
                                          </div>
                                          <div className="hidden md:block">
                                              <p className="text-xs text-slate-400 uppercase font-bold mb-1">{t('ai_est_cost')}</p>
                                              <p className="text-lg font-bold text-slate-700">฿{(item.suggestedQty * item.price).toLocaleString()}</p>
                                          </div>
                                      </div>

                                      {/* AI Insight Box */}
                                      <div className="bg-slate-50/80 rounded-xl p-3 mb-6 backdrop-blur-sm border border-slate-100 relative overflow-hidden">
                                           {/* Trend Background Effect */}
                                          {item.trendInfo?.direction === 'UP' && (
                                              <div className="absolute right-0 top-0 p-4 opacity-5">
                                                  <TrendingUp className="w-16 h-16 text-emerald-600" />
                                              </div>
                                          )}

                                          <div className="flex gap-3 relative z-10">
                                              <div className={`mt-1 p-1.5 rounded-full ${
                                                  item.trendInfo?.direction === 'UP' ? 'bg-emerald-100' :
                                                  item.confidence > 80 ? 'bg-rose-100' : 'bg-amber-100'
                                              }`}>
                                                  {item.trendInfo?.direction === 'UP' ? (
                                                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                                                  ) : (
                                                      <Sparkles className={`w-3 h-3 ${item.confidence > 80 ? 'text-rose-500' : 'text-amber-500'}`} />
                                                  )}
                                              </div>
                                              <div className="flex-1">
                                                  <div className="flex justify-between items-center mb-0.5">
                                                      <p className="text-xs font-bold text-slate-700 uppercase">{t('ai_insight')}</p>
                                                      {item.trendInfo && Math.abs(item.trendInfo.growth) > 5 && (
                                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                              item.trendInfo.growth > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                                          }`}>
                                                              {item.trendInfo.growth > 0 ? '+' : ''}{item.trendInfo.growth.toFixed(1)}% Growth
                                                          </span>
                                                      )}
                                                  </div>
                                                  <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex gap-3">
                                          <button 
                                              onClick={() => addToCart(item)}
                                              className="flex-1 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
                                          >
                                              <Plus className="w-4 h-4" />
                                              {t('ai_add_to_cart')}
                                          </button>
                                          <button className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-colors">
                                              {t('ai_ignore')}
                                          </button>
                                      </div>
                                  </div>

                                  {/* Right Side: Graph? (Hidden on mobile) */}
                                  <div className="hidden lg:block w-48 bg-slate-50 rounded-xl p-4 self-stretch flex flex-col justify-between">
                                      <div>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">30-Day Trend</p>
                                          {/* Mock Chart Area */}
                                          <div className="h-20 flex items-end gap-1">
                                              {item.sparkline?.split(',').map((h, i) => (
                                                  <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-indigo-200 rounded-t-sm" />
                                              ))}
                                          </div>
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
                      className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
                  >
                      {/* Cart Header */}
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <div>
                              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                  <ShoppingCart className="w-6 h-6 text-indigo-600" />
                                  {t('ai_cart')}
                              </h2>
                              <p className="text-xs text-slate-500">{cart.length} items ready to order</p>
                          </div>
                          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                              <X className="w-6 h-6 text-slate-400" />
                          </button>
                      </div>

                      {/* Cart Items */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                          {cart.map(item => (
                              <div key={item.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                                  <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <Package className="w-6 h-6 text-slate-300" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-slate-900 truncate">{item.name}</h4>
                                      <p className="text-xs text-slate-400 font-mono mb-2">{item.id}</p>
                                      <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
                                              <button onClick={() => updateCartQty(item.id, -1)} className="p-1 hover:bg-white rounded shadow-sm transition-all">
                                                  <Minus className="w-3 h-3 text-slate-500" />
                                              </button>
                                              <span className="text-sm font-bold text-slate-700 w-8 text-center">{item.orderQty}</span>
                                              <button onClick={() => updateCartQty(item.id, 1)} className="p-1 hover:bg-white rounded shadow-sm transition-all">
                                                  <Plus className="w-3 h-3 text-slate-500" />
                                              </button>
                                          </div>
                                          <div className="text-xs font-medium text-slate-500">
                                              ฿{(item.price * item.orderQty).toLocaleString()}
                                          </div>
                                      </div>
                                  </div>
                                  <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors self-start">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              </div>
                          ))}
                      </div>

                       {/* Supplier & Notes */}
                       <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-3">
                           <div>
                               <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                                   <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                                   ผู้จำหน่ายสินค้า (Supplier)
                               </label>
                               <select
                                   value={selectedSupplier}
                                   onChange={e => setSelectedSupplier(e.target.value)}
                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500"
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
                               <label className="block text-xs font-bold text-slate-600 mb-1">
                                   หมายเหตุใบสั่งซื้อ
                               </label>
                               <input
                                   value={poNotes}
                                   onChange={e => setPoNotes(e.target.value)}
                                   placeholder="เช่น ด่วนที่สุด, ส่งภายในวันศุกร์"
                                   className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500"
                               />
                           </div>
                       </div>

                       {/* Footer Actions */}
                       <div className="p-6 border-t border-slate-100 bg-slate-50">
                           <div className="flex justify-between items-center mb-6">
                               <span className="text-sm font-medium text-slate-500">{t('ai_cart_total')}</span>
                               <span className="text-2xl font-black text-slate-900">฿{cartTotal.toLocaleString()}</span>
                           </div>
                           <button 
                               onClick={submitPO}
                               disabled={submitting || cart.length === 0}
                               className="w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                               {submitting ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                               {submitting ? 'กำลังสร้างใบสั่งซื้อ...' : 'สร้างใบสั่งซื้อ (Generate PO)'}
                           </button>
                       </div>
                   </motion.div>
               </>
           )}
       </AnimatePresence>

       {/* PO Created Success Modal */}
       {createdPoResult && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 text-center space-y-4">
                   <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                       <CheckCircle2 className="w-10 h-10" />
                   </div>
                   <h3 className="text-xl font-black text-slate-900">สร้างใบสั่งซื้อเรียบร้อยแล้ว!</h3>
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-sm space-y-1.5">
                       <div className="flex justify-between">
                           <span className="text-slate-500">เลขที่ PO:</span>
                           <span className="font-mono font-black text-indigo-600">{createdPoResult.po_number}</span>
                       </div>
                       <div className="flex justify-between">
                           <span className="text-slate-500">ผู้จำหน่าย:</span>
                           <span className="font-bold text-slate-800">{createdPoResult.supplier || '-'}</span>
                       </div>
                       <div className="flex justify-between">
                           <span className="text-slate-500">จำนวนรายการ:</span>
                           <span className="font-bold text-slate-800">{createdPoResult.total_items} รายการ</span>
                       </div>
                       <div className="flex justify-between">
                           <span className="text-slate-500">ยอดเงินรวม:</span>
                           <span className="font-bold text-emerald-600">฿{Number(createdPoResult.total_amount || 0).toLocaleString()}</span>
                       </div>
                   </div>

                   <div className="flex flex-col sm:flex-row gap-2 pt-2">
                       <Link
                           href={`/print/purchase-order?id=${createdPoResult.id}`}
                           target="_blank"
                           className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                       >
                           <Printer className="w-4 h-4" />
                           พิมพ์ใบสั่งซื้อ (PO)
                       </Link>
                       <Link
                           href="/ops/receiving"
                           className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                       >
                           <FileText className="w-4 h-4" />
                           ไปหน้าตรวจรับเข้า
                       </Link>
                   </div>
                   <button
                       onClick={() => setCreatedPoResult(null)}
                       className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                   >
                       ปิดหน้าต่างนี้
                   </button>
               </div>
           </div>
       )}

    </div>
  );
}

// Subcomponents
function KPICard({ label, value, icon: Icon, color, subtext }: any) {
    const colorStyles = {
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600',
        indigo: 'bg-indigo-50 text-indigo-600',
    } as any;

    return (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
                <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
                <p className="text-xs font-medium text-slate-400 mt-1">{subtext}</p>
            </div>
            <div className={`p-4 rounded-2xl ${colorStyles[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}

function TabButton({ label, active, onClick, count, color = "" }: any) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                active 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105' 
                : 'bg-transparent text-slate-500 hover:bg-slate-100'
            }`}
        >
            {label}
            {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'} ${active ? '' : color}`}>
                    {count}
                </span>
            )}
        </button>
    );
}
