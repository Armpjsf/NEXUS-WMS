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
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Skeleton } from '@/components/ui/Skeleton';
import { getApiUrl } from '@/lib/config';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { speakThai } from '@/lib/voiceAssistant';
import { errorMessage } from '@/lib/errors';

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

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.orderQty), 0);

  return (
    <div className="relative min-h-screen bg-[#0f141b] p-4 md:p-8 pb-32 overflow-hidden">
      <AmbientBackground />

      <div className="max-w-7xl mx-auto relative z-10">
          <Link href="/analytics" className="text-[#8a92a6] hover:text-[#facc15] flex items-center gap-2 mb-6 transition-colors font-bold group w-fit">
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
              {t('back_to_analytics')}
          </Link>
          
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-[#171c23] backdrop-blur-xl p-8 rounded-xl border border-[#30353d] shadow-xl shadow-black/20 relative overflow-hidden"
          >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
              
              <div className="relative z-10">
                  <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#facc15]">Autonomous Inventory Engine</p>
                  <h1 className="text-3xl md:text-4xl font-black text-[#dee2ec] tracking-tight flex items-center gap-3">
                      <div className="bg-[#facc15]/15 border border-[#facc15]/30 text-[#facc15] p-3 rounded-xl">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      {t('ai_title')}
                  </h1>
                  <p className="text-[#8a92a6] mt-2 font-medium max-w-xl text-base leading-relaxed">
                      {t('ai_subtitle')}
                  </p>
              </div>
              <div className="flex gap-3 relative z-10">
                   <button 
                      onClick={handleReanalyze}
                      disabled={analyzing}
                      className="px-6 py-3 bg-[#1b2027] border border-[#30353d] hover:bg-[#252a32] text-[#d1c6ab] rounded-xl font-mono font-bold transition-all flex items-center gap-2.5 group disabled:opacity-50 active:scale-95 shadow-sm"
                   >
                       <RefreshCw className={`w-4 h-4 text-[#facc15] ${analyzing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
                       {analyzing ? t('ai_analyzing') : t('ai_reanalyze')}
                   </button>
                   <button 
                      onClick={() => setIsCartOpen(true)}
                      className="relative px-6 py-3 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] rounded-xl font-mono font-bold transition-all flex items-center gap-2.5 shadow-md active:scale-95"
                   >
                       <ShoppingCart className="w-5 h-5 text-[#1b1600]" />
                       <span className="hidden md:inline">{t('ai_cart')}</span>
                       {cart.length > 0 && (
                           <span className="absolute -top-2.5 -right-2.5 bg-[#ff5449] text-white text-[11px] font-mono font-black px-2 py-0.5 rounded-full shadow-lg">
                               {cart.length}
                           </span>
                       )}
                   </button>
              </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <KPICard label={t('ai_total_items')} value={totalProducts || suggestions.length} icon={Package} color="cyan" subtext={t('ai_monitored')} />
              <KPICard label={t('ai_critical_stock')} value={suggestions.filter(s => s.confidence >= 90).length} icon={AlertTriangle} color="rose" subtext={t('ai_action_needed')} />
              <KPICard label={t('ai_high_velocity')} value={suggestions.filter(s => (s.trendInfo?.growth || 0) > 10).length} icon={TrendingUp} color="emerald" subtext={t('ai_trending_up')} />
              <KPICard label={t('ai_po_value')} value={`฿${suggestions.reduce((a,b) => a + (b.suggestedQty * b.price), 0).toLocaleString()}`} icon={DollarSign} color="amber" subtext={t('ai_estimated_cost')} />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              <TabButton label={t('ai_all_suggestions')} active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} count={suggestions.length} />
              <TabButton label={t('ai_critical')} active={activeTab === 'CRITICAL'} onClick={() => setActiveTab('CRITICAL')} count={suggestions.filter(s => s.confidence >= 90).length} badgeColor="bg-[#ff5449]/15 text-[#ffb4ab] border border-[#ff5449]/30" />
              <TabButton label={t('ai_warnings')} active={activeTab === 'WARNING'} onClick={() => setActiveTab('WARNING')} count={suggestions.filter(s => s.confidence >= 70 && s.confidence < 90).length} badgeColor="bg-[#facc15]/15 text-[#facc15] border border-[#facc15]/30" />
          </div>

          {/* Suggestions List */}
          {loading ? (
              <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
              </div>
          ) : filtered.length === 0 ? (
              <div className="bg-[#171c23] border border-[#30353d] rounded-xl p-12 text-center shadow-sm mb-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#57ec7f]/15 border border-[#57ec7f]/30 flex items-center justify-center text-[#57ec7f]">
                      <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-[#dee2ec] mb-2">สต็อกอยู่ในเกณฑ์ปกติ</h3>
                  <p className="text-[#8a92a6] max-w-md mx-auto text-sm">
                      {activeTab === 'CRITICAL' 
                          ? 'ไม่พบสินค้าที่มีสต็อกในระดับวิกฤต'
                          : activeTab === 'WARNING'
                          ? 'ไม่พบสินค้าที่มีสัญญาณเตือนสต็อกต่ำ'
                          : 'สินค้าทุกรายการมีปริมาณสต็อกเพียงพอต่อความต้องการ ยังไม่ต้องสั่งซื้อเพิ่มในขณะนี้'}
                  </p>
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
                              className="bg-[#171c23] backdrop-blur-xl rounded-xl p-6 shadow-sm border border-[#30353d] hover:border-[#facc15]/50 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
                          >
                              {/* Left Border Indicator */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                  item.confidence >= 90 ? 'bg-[#ff5449]' : 
                                  item.confidence >= 70 ? 'bg-[#facc15]' : 'bg-[#4cd7f6]'
                              }`} />

                              <div className="flex flex-col md:flex-row gap-6">
                                  {/* Info Section */}
                                  <div className="flex-1">
                                      <div className="flex items-start justify-between mb-4">
                                          <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                  <h3 className="text-lg font-bold text-[#dee2ec]">{item.name}</h3>
                                                  {item.confidence >= 90 && (
                                                      <span className="px-2 py-0.5 bg-[#ff5449]/15 border border-[#ff5449]/30 text-[#ffb4ab] text-[10px] font-mono font-bold uppercase tracking-wide rounded-md">
                                                          {t('ai_critical')}
                                                      </span>
                                                  )}
                                              </div>
                                              <p className="text-xs text-[#8a92a6] font-mono">ID: {item.id}</p>
                                          </div>
                                          <div className="text-right">
                                              <div className="text-2xl font-mono font-black text-[#dee2ec]">
                                                  {item.suggestedQty} <span className="text-sm font-medium text-[#8a92a6]">{t('ai_unit')}</span>
                                              </div>
                                              <p className="text-xs text-[#8a92a6]">
                                                  {t('ai_suggested_add')}
                                              </p>
                                          </div>
                                      </div>

                                      {/* Stocks */}
                                      <div className="flex gap-8 mb-6">
                                          <div>
                                              <p className="text-xs text-[#8a92a6] uppercase font-bold mb-1">{t('ai_current_stock')}</p>
                                              <p className={`text-lg font-mono font-bold ${item.currentStock <= item.minStock ? 'text-[#ff5449]' : 'text-[#d1c6ab]'}`}>
                                                  {item.currentStock}
                                              </p>
                                          </div>
                                          <div>
                                              <p className="text-xs text-[#8a92a6] uppercase font-bold mb-1">{t('ai_min_stock')}</p>
                                              <p className="text-lg font-mono font-bold text-[#d1c6ab]">{item.minStock}</p>
                                          </div>
                                          <div className="hidden md:block">
                                              <p className="text-xs text-[#8a92a6] uppercase font-bold mb-1">{t('ai_est_cost')}</p>
                                              <p className="text-lg font-mono font-bold text-[#dee2ec]">฿{(item.suggestedQty * item.price).toLocaleString()}</p>
                                          </div>
                                      </div>

                                      {/* AI Insight Box */}
                                      <div className="bg-[#1b2027] rounded-xl p-3.5 mb-5 border border-[#30353d] relative overflow-hidden">
                                          <div className="flex gap-3 relative z-10">
                                              <div className={`mt-0.5 p-1.5 rounded-lg border ${
                                                  item.trendInfo?.direction === 'UP' ? 'bg-[#57ec7f]/15 border-[#57ec7f]/30 text-[#57ec7f]' :
                                                  item.confidence > 80 ? 'bg-[#ff5449]/15 border-[#ff5449]/30 text-[#ff5449]' : 'bg-[#facc15]/15 border-[#facc15]/30 text-[#facc15]'
                                              }`}>
                                                  {item.trendInfo?.direction === 'UP' ? (
                                                      <TrendingUp className="w-3.5 h-3.5" />
                                                  ) : (
                                                      <Sparkles className="w-3.5 h-3.5" />
                                                  )}
                                              </div>
                                              <div className="flex-1">
                                                  <div className="flex justify-between items-center mb-0.5">
                                                      <p className="text-xs font-mono font-bold text-[#d1c6ab] uppercase">{t('ai_insight')}</p>
                                                      {item.trendInfo && Math.abs(item.trendInfo.growth) > 5 && (
                                                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                                              item.trendInfo.growth > 0 ? 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/30' : 'bg-[#ff5449]/15 text-[#ffb4ab] border-[#ff5449]/30'
                                                          }`}>
                                                              {item.trendInfo.growth > 0 ? '+' : ''}{item.trendInfo.growth.toFixed(1)}% Growth
                                                          </span>
                                                      )}
                                                  </div>
                                                  <p className="text-xs text-[#d1c6ab] leading-relaxed">{item.reason}</p>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex gap-3">
                                          <button 
                                              onClick={() => addToCart(item)}
                                              className="flex-1 py-2.5 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] rounded-xl font-mono font-bold text-sm transition-all shadow flex items-center justify-center gap-2"
                                          >
                                              <Plus className="w-4 h-4 text-[#1b1600]" />
                                              {t('ai_add_to_cart')}
                                          </button>
                                          <button className="px-4 py-2.5 bg-[#1b2027] border border-[#30353d] hover:bg-[#252a32] text-[#d1c6ab] rounded-xl font-mono font-bold text-sm transition-colors">
                                              {t('ai_ignore')}
                                          </button>
                                      </div>
                                  </div>

                                  {/* Right Side: Graph */}
                                  <div className="hidden lg:block w-48 bg-[#1b2027] border border-[#30353d] rounded-xl p-4 self-stretch flex flex-col justify-between">
                                      <div>
                                          <div className="flex items-center justify-between mb-2">
                                              <p className="text-[10px] font-mono font-bold text-[#8a92a6] uppercase">7-Day Usage</p>
                                              {(() => {
                                                  const values = item.sparkline?.split(',').map(Number) || [];
                                                  const total = values.reduce((a, b) => a + b, 0);
                                                  return <span className="text-[10px] font-mono text-[#4cd7f6]">{total}u</span>;
                                              })()}
                                          </div>
                                          {/* Proportional Chart Area */}
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
                                                              className={`flex-1 rounded-t-sm transition-all ${val > 0 ? 'bg-[#4cd7f6] hover:bg-[#facc15]' : 'bg-[#252a32]'}`}
                                                              title={`Day ${i + 1}: ${val} units`} 
                                                          />
                                                      );
                                                  });
                                              })()}
                                          </div>
                                      </div>
                                      <div className="text-[10px] font-mono text-[#8a92a6] pt-2 border-t border-[#30353d]/50 flex justify-between">
                                          <span>7d History</span>
                                          {(() => {
                                              const values = item.sparkline?.split(',').map(Number) || [];
                                              const peak = Math.max(0, ...values);
                                              return <span className="text-[#facc15]">pk: {peak}</span>;
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
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                  />
                  <motion.div 
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#171c23] border-l border-[#30353d] z-50 shadow-2xl flex flex-col"
                  >
                      {/* Cart Header */}
                      <div className="p-6 border-b border-[#30353d] flex justify-between items-center bg-[#1b2027]">
                          <div>
                              <h2 className="text-xl font-black text-[#dee2ec] flex items-center gap-2">
                                  <ShoppingCart className="w-5 h-5 text-[#facc15]" />
                                  {t('ai_cart')}
                              </h2>
                              <p className="text-xs font-mono text-[#8a92a6]">{cart.length} items ready to order</p>
                          </div>
                          <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-[#252a32] rounded-lg transition-colors text-[#8a92a6] hover:text-[#dee2ec]">
                              <X className="w-5 h-5" />
                          </button>
                      </div>

                      {/* Cart Items */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-3">
                          {cart.map(item => (
                              <div key={item.id} className="flex gap-4 p-4 bg-[#1b2027] border border-[#30353d] rounded-xl shadow-sm">
                                  <div className="w-10 h-10 bg-[#252a32] rounded-lg flex items-center justify-center flex-shrink-0 border border-[#30353d]">
                                      <Package className="w-5 h-5 text-[#8a92a6]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-[#dee2ec] text-sm truncate">{item.name}</h4>
                                      <p className="text-xs text-[#8a92a6] font-mono mb-2">{item.id}</p>
                                      <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1.5 bg-[#171c23] border border-[#30353d] rounded-lg p-1">
                                              <button onClick={() => updateCartQty(item.id, -1)} className="p-1 hover:bg-[#252a32] rounded transition-all">
                                                  <Minus className="w-3 h-3 text-[#8a92a6]" />
                                              </button>
                                              <span className="text-sm font-mono font-bold text-[#dee2ec] w-8 text-center">{item.orderQty}</span>
                                              <button onClick={() => updateCartQty(item.id, 1)} className="p-1 hover:bg-[#252a32] rounded transition-all">
                                                  <Plus className="w-3 h-3 text-[#8a92a6]" />
                                              </button>
                                          </div>
                                          <div className="text-xs font-mono font-bold text-[#57ec7f]">
                                              ฿{(item.price * item.orderQty).toLocaleString()}
                                          </div>
                                      </div>
                                  </div>
                                  <button onClick={() => removeFromCart(item.id)} className="text-[#8a92a6] hover:text-[#ff5449] transition-colors self-start p-1">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                      </div>

                       {/* Supplier & Notes */}
                       <div className="p-6 border-t border-[#30353d] bg-[#1b2027] space-y-3">
                           <div>
                               <label className="block text-xs font-mono font-bold text-[#d1c6ab] mb-1 flex items-center gap-1.5">
                                   <Building2 className="w-3.5 h-3.5 text-[#4cd7f6]" />
                                   ผู้จำหน่ายสินค้า (Supplier)
                               </label>
                               <select
                                   value={selectedSupplier}
                                   onChange={e => setSelectedSupplier(e.target.value)}
                                   className="w-full bg-[#171c23] border border-[#30353d] rounded-xl px-3 py-2 text-sm font-medium text-[#dee2ec] outline-none focus:border-[#4cd7f6]"
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
                               <label className="block text-xs font-mono font-bold text-[#d1c6ab] mb-1">
                                   หมายเหตุใบสั่งซื้อ
                               </label>
                               <input
                                   value={poNotes}
                                   onChange={e => setPoNotes(e.target.value)}
                                   placeholder="เช่น ด่วนที่สุด, ส่งภายในวันศุกร์"
                                   className="w-full bg-[#171c23] border border-[#30353d] rounded-xl px-3 py-2 text-sm text-[#dee2ec] outline-none focus:border-[#4cd7f6]"
                               />
                           </div>
                       </div>

                       {/* Footer Actions */}
                       <div className="p-6 border-t border-[#30353d] bg-[#171c23]">
                           <div className="flex justify-between items-center mb-6">
                               <span className="text-sm font-mono text-[#8a92a6]">{t('ai_cart_total')}</span>
                               <span className="text-2xl font-mono font-black text-[#dee2ec]">฿{cartTotal.toLocaleString()}</span>
                           </div>
                           <button 
                               onClick={submitPO}
                               disabled={submitting || cart.length === 0}
                               className="w-full py-3.5 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] rounded-xl font-mono font-bold text-base flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                               {submitting ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 text-[#1b1600]" />}
                               {submitting ? 'กำลังสร้างใบสั่งซื้อ...' : 'สร้างใบสั่งซื้อ (Generate PO)'}
                           </button>
                       </div>
                   </motion.div>
               </>
           )}
       </AnimatePresence>

       {/* PO Created Success Modal */}
       {createdPoResult && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
               <div className="bg-[#171c23] border border-[#30353d] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl p-6 text-center space-y-4">
                   <div className="w-16 h-16 bg-[#57ec7f]/15 border border-[#57ec7f]/30 text-[#57ec7f] rounded-xl flex items-center justify-center mx-auto">
                       <CheckCircle2 className="w-8 h-8" />
                   </div>
                   <h3 className="text-xl font-bold text-[#dee2ec]">สร้างใบสั่งซื้อเรียบร้อยแล้ว!</h3>
                   <div className="p-4 bg-[#1b2027] rounded-xl border border-[#30353d] text-left text-sm space-y-2">
                       <div className="flex justify-between font-mono">
                           <span className="text-[#8a92a6]">เลขที่ PO:</span>
                           <span className="font-bold text-[#4cd7f6]">{createdPoResult.po_number}</span>
                       </div>
                       <div className="flex justify-between">
                           <span className="text-[#8a92a6]">ผู้จำหน่าย:</span>
                           <span className="font-bold text-[#dee2ec]">{createdPoResult.supplier || '-'}</span>
                       </div>
                       <div className="flex justify-between font-mono">
                           <span className="text-[#8a92a6]">จำนวนรายการ:</span>
                           <span className="font-bold text-[#dee2ec]">{createdPoResult.total_items} รายการ</span>
                       </div>
                       <div className="flex justify-between font-mono">
                           <span className="text-[#8a92a6]">ยอดเงินรวม:</span>
                           <span className="font-bold text-[#57ec7f]">฿{Number(createdPoResult.total_amount || 0).toLocaleString()}</span>
                       </div>
                   </div>

                   <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                       <Link
                           href={`/print/purchase-order?id=${createdPoResult.id}`}
                           target="_blank"
                           className="flex-1 py-3 px-4 bg-[#facc15] hover:bg-[#eec200] text-[#1b1600] font-mono font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                       >
                           <Printer className="w-4 h-4 text-[#1b1600]" />
                           พิมพ์ใบสั่งซื้อ (PO)
                       </Link>
                       <Link
                           href="/ops/receiving"
                           className="flex-1 py-3 px-4 bg-[#57ec7f] hover:bg-[#45d46c] text-[#090f15] font-mono font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                       >
                           <FileText className="w-4 h-4 text-[#090f15]" />
                           ไปหน้าตรวจรับเข้า
                       </Link>
                   </div>
                   <button
                       onClick={() => setCreatedPoResult(null)}
                       className="w-full py-2 text-[#8a92a6] hover:text-[#d1c6ab] text-xs font-mono font-bold"
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
        emerald: 'bg-[#57ec7f]/15 border border-[#57ec7f]/30 text-[#57ec7f]',
        rose: 'bg-[#ff5449]/15 border border-[#ff5449]/30 text-[#ff5449]',
        cyan: 'bg-[#4cd7f6]/15 border border-[#4cd7f6]/30 text-[#4cd7f6]',
        amber: 'bg-[#facc15]/15 border border-[#facc15]/30 text-[#facc15]',
    } as any;

    return (
        <div className="bg-[#171c23] rounded-xl p-5 border border-[#30353d] shadow-sm flex items-start justify-between">
            <div>
                <p className="text-xs font-mono font-bold text-[#8a92a6] uppercase tracking-wider mb-1.5">{label}</p>
                <div className="text-3xl font-mono font-black text-[#dee2ec] tracking-tight">{value}</div>
                <p className="text-xs font-medium text-[#8a92a6] mt-1">{subtext}</p>
            </div>
            <div className={`p-3 rounded-xl ${colorStyles[color] || colorStyles.cyan}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}

function TabButton({ label, active, onClick, count, badgeColor = "" }: any) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm font-mono font-bold transition-all flex items-center gap-2 ${
                active 
                ? 'bg-[#facc15] text-[#1b1600] shadow-sm' 
                : 'bg-[#171c23] border border-[#30353d] text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32]'
            }`}
        >
            {label}
            {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${active ? 'bg-[#1b1600]/20 text-[#1b1600]' : badgeColor || 'bg-[#252a32] text-[#d1c6ab]'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}
