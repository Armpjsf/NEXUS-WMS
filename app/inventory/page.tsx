'use client';

import { useState, useEffect } from 'react';
import { ProductModal } from '@/components/ProductModal';
import { Search, Plus, Filter, Download, MoreHorizontal, Moon, Sun, LayoutGrid, List, ArrowUpDown, RefreshCcw, X, ChevronLeft, ChevronRight, SlidersHorizontal, Package, Tag, MapPin, AlertCircle, ArrowRight, TrendingUp, History, Info, XCircle, Printer, Pencil, Maximize2, Camera } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import toast from 'react-hot-toast';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
       <InventoryContent />
    </Suspense>
  );
}

function InventoryContent() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status')?.toUpperCase() || 'ALL';
  const [filterStatus, setFilterStatus] = useState(initialStatus); // ALL, LOW, OK
  const [filterMovement, setFilterMovement] = useState('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showCamScan, setShowCamScan] = useState(false);

  // Hardware PDA / Laser Scanner Gun support for instant product lookup
  usePdaScanner({
    onScan: (scanned) => {
      const q = scanned.trim();
      setSearch(q);
      toast.success(`PDA สแกนค้นหา: ${q}`);
    },
    enabled: true,
  });
  
  // CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const openAddModal = () => {
      setEditingProduct(null);
      setIsModalOpen(true);
  };

  const openEditModal = (p: any, e: React.MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      setEditingProduct(p);
      setIsModalOpen(true);
  };
  
  const { sendNotification } = useNotification();

  // Sync URL Params to State (Always) with Fallback
  useEffect(() => {
     let s = searchParams.get('status');
     let m = searchParams.get('movement');
     let q = searchParams.get('search'); // Capture search query

     // Fallback: Direct window location check (Client-side only)
     if (!s && !q && typeof window !== 'undefined') {
         const urlParams = new URLSearchParams(window.location.search);
         s = urlParams.get('status');
         if (!m) m = urlParams.get('movement');
         if (!q) q = urlParams.get('search');
     }

     // 1. Magic Search: "Low Stock" -> Switch to Filter Mode
     const magicKeywords = ['low stock', 'สินค้าหมด', 'low', 'out of stock'];
     if ((q && magicKeywords.includes(q.toLowerCase())) || (s === 'LOW')) {
         setFilterStatus('LOW');
         setSearch(''); // Clear search so filter works
     } else {
         setFilterStatus(s?.toUpperCase() || 'ALL'); 
         if (q) setSearch(q);
     }
     setFilterMovement(m || 'ALL');
  }, [searchParams]);

  const fetchData = () => {
    setLoading(true);
    const urlParams = new URLSearchParams(window.location.search);
    const branchId = urlParams.get('branchId') || 'hq';
    const url = getApiUrl(`/api/products?branchId=${branchId}`);
    
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP Error: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
            console.log("Inventory Page Data:", data);
            if (data.length > 0) {
                console.log("Sample Item:", {
                    name: data[0].name,
                    movementStatus: data[0].movementStatus
                });
            }
            setProducts(data);
            
            // Check for Low Stock and Notify
            const lowStockItems = data.filter((p: any) => p.stock <= p.minStock);
            if (lowStockItems.length > 0) {
                // In a real app, you might want to debounce this or check if already notified
                // For now, we rely on the backend pushed/polled notifications or user manual trigger
                // But we can show a toast here if desired.
            }
        } else {
            console.error("API returned non-array data:", data);
            setProducts([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch products:", err);
        setProducts([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to normalize status
  const isInactive = (status: string) => {
      if (!status) return false;
      const s = status.toLowerCase().trim();
      return s === 'inactive' || s === 'discontinued' || s === 'ยกเลิก';
  }

  // Filter Logic
  const filtered = products.filter(p => {
    if (filterStatus === 'INACTIVE') {
      if (!isInactive(p.status)) return false;
    } else {
      if (!showInactive && isInactive(p.status)) return false;
    }
    const normalize = (val: string) => val ? val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    const term = normalize(search);

    const matchSearch = normalize(p.name).includes(term) || 
                        normalize(p.id).includes(term) ||
                        normalize(p.location).includes(term);
    const stockStatus = p.stock <= p.minStock ? 'LOW' : 'OK'; 
    const now = Date.now();
    const expTime = p.expiryDate ? new Date(p.expiryDate).getTime() : null;
    const isExpiringSoon = expTime !== null && expTime > now && (expTime - now) <= 30 * 86400000;
    const isExpired = expTime !== null && expTime <= now;

    let matchStatus = filterStatus === 'ALL' || 
                      (filterStatus === 'LOW' && stockStatus === 'LOW') || 
                      (filterStatus === 'OK' && stockStatus === 'OK') ||
                      (filterStatus === 'INACTIVE') ||
                      (filterStatus === 'EXPIRING' && isExpiringSoon) ||
                      (filterStatus === 'EXPIRED' && isExpired);
    
    // Robust movement matching (Trim + Case Insensitive + Handle Empty)
    const pMovement = (p.movementStatus || '').trim().toLowerCase();
    const filterVal = filterMovement.trim().toLowerCase();
    const matchMovement = filterMovement === 'ALL' || pMovement === filterVal;
    
    return matchSearch && matchStatus && matchMovement;
  });

  // Debug Filtering
  useEffect(() => {
    if (products.length > 0) {
        console.log(`[FilterDebug] Filter: ${filterMovement}, First Item Status: '${products[0].movementStatus}' -> Parsed: '${(products[0].movementStatus || '').trim()}'`);
        console.log(`[FilterDebug] Visible Items: ${filtered.length} / ${products.length}`);
    }
  }, [filterMovement, products, filtered.length]);

  // Calculate Status dynamically for display
  const getStatus = (p: any) => {
    if (isInactive(p.status)) return { label: 'Inactive', color: 'text-white', bg: 'bg-gradient-to-r from-slate-500 to-slate-600', border: 'border-transparent shadow-lg shadow-slate-200/50' };
    if (p.stock <= p.minStock) return { label: 'Low Stock', color: 'text-white', bg: 'bg-gradient-to-r from-rose-500 to-pink-600', border: 'border-transparent shadow-lg shadow-rose-200/50' };
    if (p.stock === 0) return { label: 'Out of Stock', color: 'text-white', bg: 'bg-gradient-to-r from-slate-800 to-slate-900', border: 'border-transparent shadow-lg shadow-slate-900/10' };
    return { label: 'In Stock', color: 'text-white', bg: 'bg-gradient-to-r from-emerald-500 to-teal-600', border: 'border-transparent shadow-lg shadow-emerald-200/50' };
  };

  const exportCSV = () => {
    // Added BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF"; 
    const headers = ['ID,Name,Category,Location,Movement Status,Stock,MinStock,Price,Stock Status,Master Status'];
    const rows = filtered.map(p => 
        `"${p.id}","${p.name.replace(/"/g, '""')}","${p.category}","${p.location || '-'}","${p.movementStatus || 'Unknown'}",${p.stock},${p.minStock},${p.price},"${getStatus(p).label}","${p.status}"`
    );
    const csvContent = BOM + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_export.csv');
    document.body.appendChild(link);
    link.click();
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.01
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen relative px-4 py-6 pb-32 sm:px-6 lg:p-8">
        <AmbientBackground />
        
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mx-auto mb-6 flex max-w-[1500px] flex-col gap-4 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between"
        >
           <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#facc15] via-[#4cd7f6] to-[#57ec7f]" />
           
           <div className="relative z-10">
              <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6]">
                Tactical Inventory Control & Stock Master
              </p>
              <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
                <div className="bg-[#facc15] text-[#1b1600] p-2.5 rounded-lg shadow-md">
                    <Package className="w-6 h-6" />
                </div>
                {t('inventory_title')}
              </h1>
              <p className="text-[#d1c6ab] font-mono text-xs ml-1">{t('inventory_subtitle')}</p>
           </div>
           
           <div className="flex flex-wrap gap-2.5 relative z-10">
              <button 
                  onClick={openAddModal}
                  className="flex items-center gap-2 bg-[#facc15] text-[#1b1600] px-5 py-2.5 rounded-lg font-mono text-xs font-bold hover:bg-[#eec200] transition-all shadow-sm active:translate-y-px"
              >
                  <Plus className="w-4 h-4" />
                  {t('add_product')}
              </button>

              <Link
                  href="/ops/cycle-count"
                  className="hidden xl:flex items-center gap-2 bg-[#252a32] border border-[#30353d] text-[#57ec7f] px-4 py-2.5 rounded-lg font-mono text-xs font-bold hover:border-[#57ec7f]/50 transition-all"
              >
                  <RefreshCcw className="w-4 h-4" />
                  ตรวจนับ Cycle Count
              </Link>

              <button 
                onClick={fetchData} 
                className={cn("p-2.5 rounded-lg transition-all border border-[#30353d]", loading ? "bg-[#1b2027] text-[#8a92a6]" : "bg-[#252a32] text-[#d1c6ab] hover:text-[#facc15]")}
                title="รีเฟรชข้อมูลสต็อก"
              >
                  <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
              </button>
              
               <button 
                  onClick={exportCSV}
                  className="flex items-center gap-2 bg-[#252a32] border border-[#30353d] text-[#dee2ec] px-4 py-2.5 rounded-lg font-mono text-xs font-bold hover:text-[#facc15] transition-all"
               >
                  <Download className="w-4 h-4" />
                  {t('export_csv')}
               </button>
           </div>
        </motion.div>

        <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="mx-auto mb-6 flex max-w-[1500px] flex-col gap-3 rounded-xl border border-[#30353d] bg-[#171c23]/80 p-3 shadow-xl backdrop-blur-xl md:flex-row md:items-center"
         >
            <div className="flex-1 relative group w-full flex gap-2.5 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-[#d1c6ab]" />
                    <input 
                       type="text" 
                       placeholder={t('search_placeholder')}
                       value={search}
                       onChange={e => setSearch(e.target.value)}
                       className="w-full pl-9 pr-24 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-xs font-mono text-[#dee2ec] placeholder-[#d1c6ab]/50 focus:border-[#facc15] outline-none transition-all"
                    />
                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          className="p-1 text-[#d1c6ab] hover:text-[#dee2ec] rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowCamScan(true)}
                        title="สแกนบาร์โค้ดสินค้า"
                        className="px-2 py-1 bg-[#252a32] border border-[#30353d] hover:border-[#facc15] text-[#facc15] rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all"
                      >
                        <Camera className="w-3 h-3" />
                        <span>สแกน</span>
                      </button>
                    </div>
                </div>
                <span className="px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#d1c6ab] font-mono text-xs whitespace-nowrap">
                    {search ? `ค้นพบ ${filtered.length.toLocaleString()} รายการ` : `ทั้งหมด ${filtered.length.toLocaleString()} รายการ`}
                </span>
            </div>
           
           <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 font-mono text-xs">
                <select 
                    value={filterMovement}
                    onChange={e => setFilterMovement(e.target.value)}
                    className="px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#dee2ec] outline-none focus:border-[#facc15] cursor-pointer"
                >
                    <option value="ALL">{t('filter_all_movements')}</option>
                    <option value="Fast Moving">{t('filter_fast_moving')}</option>
                    <option value="Normal Moving">{t('filter_normal_moving')}</option>
                    <option value="Slow Moving">{t('filter_slow_moving')}</option>
                    <option value="Deadstock">{t('filter_deadstock')}</option>
                </select>

                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-2 bg-[#090f15] border border-[#30353d] rounded-lg text-[#dee2ec] outline-none focus:border-[#facc15] cursor-pointer"
                >
                    <option value="ALL">{t('filter_all_status')}</option>
                    <option value="LOW">{t('filter_low_stock')}</option>
                    <option value="EXPIRING">⏰ ใกล้หมดอายุ (≤ 30 วัน)</option>
                    <option value="EXPIRED">❌ หมดอายุแล้ว</option>
                    <option value="OK">{t('filter_in_stock')}</option>
                    <option value="INACTIVE">{t('filter_inactive')}</option>
                </select>
                
                <button 
                  onClick={() => setShowInactive(!showInactive)}
                  className={cn(
                    "px-3 py-2 rounded-lg border font-mono text-xs whitespace-nowrap transition-all",
                    showInactive 
                        ? "bg-[#facc15] text-[#1b1600] border-[#facc15] font-bold" 
                        : "bg-[#090f15] text-[#d1c6ab] border-[#30353d] hover:text-[#dee2ec]"
                  )}
                >
                    {showInactive ? t('show_active_only') : t('show_inactive')}
                </button>
           </div>
        </motion.div>

        {loading ? (
            <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
               {[...Array(12)].map((_, i) => (
                   <Skeleton key={i} className="h-[280px] w-full rounded-[2rem]" />
               ))}
            </div>
        ) : (
           <motion.div 
             variants={container}
             initial="hidden"
             animate="show"
             className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
           >
              <AnimatePresence mode='popLayout'>
              {filtered.map((product) => {
                  const status = getStatus(product);
                  return (
                    <motion.div
                        key={product.id}
                        variants={item}
                        layout
                        className="group relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-4 shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[#facc15]/60"
                    >
                        <div className="h-full relative z-10 flex flex-col justify-between">
                            <div className={cn("absolute inset-x-0 top-0 h-1", product.stock <= product.minStock ? "bg-[#ffb4ab]" : "bg-[#facc15]")} />
                            
                            <div>
                                <div className="flex justify-between items-start mb-3 pt-1">
                                    <div className="w-14 h-14 rounded-lg bg-[#090f15] border border-[#30353d] p-1 relative group/image">
                                        <div className="hidden md:flex absolute inset-0 bg-black/60 rounded-lg items-center justify-center gap-1.5 opacity-0 group-hover/image:opacity-100 transition-all duration-150 z-20 backdrop-blur-sm pointer-events-none">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setZoomedImage(product.image);
                                                }}
                                                className="p-1.5 bg-[#252a32] hover:bg-[#facc15] text-[#dee2ec] hover:text-[#1b1600] rounded transition-colors pointer-events-auto"
                                                title="Zoom Image"
                                            >
                                                <Maximize2 className="w-3.5 h-3.5" />
                                            </button>
                                            <Link 
                                                href={`/inventory/print-labels?sku=${product.id}&name=${encodeURIComponent(product.name)}&price=${product.price}&code=${encodeURIComponent(product.location || product.id)}&stock=${product.stock}&location=${encodeURIComponent(product.location || '')}`}
                                                target="_blank"
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1.5 bg-[#252a32] hover:bg-[#facc15] text-[#dee2ec] hover:text-[#1b1600] rounded transition-colors pointer-events-auto"
                                                title="Print Label"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                            </Link>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    openEditModal(product, e);
                                                }}
                                                className="p-1.5 bg-[#252a32] hover:bg-[#facc15] text-[#dee2ec] hover:text-[#1b1600] rounded transition-colors pointer-events-auto"
                                                title="Edit Product"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                    {product.image ? (
                                        <div 
                                            className="w-full h-full cursor-zoom-in"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setZoomedImage(product.image);
                                            }}
                                        >
                                            <img src={`/api/proxy/image?url=${encodeURIComponent(product.image)}`} alt={product.name} className="w-full h-full object-cover rounded" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#d1c6ab]/40">
                                            <Package className="w-6 h-6" />
                                        </div>
                                    )}
                                    </div>
                                    <span className={cn(
                                        "px-2.5 py-1 rounded font-mono text-[9px] uppercase font-bold tracking-wider",
                                        product.stock <= product.minStock
                                            ? "bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/30 animate-pulse"
                                            : "bg-[#1b2027] text-[#57ec7f] border border-[#57ec7f]/30"
                                    )}>
                                        {status.label}
                                    </span>
                                </div>

                                <Link href={`/stock-card?search=${encodeURIComponent(product.name)}`} className="block">
                                    <div className="mb-3 h-12">
                                        <h3 className="font-headline font-bold text-sm text-[#dee2ec] line-clamp-2 leading-tight group-hover:text-[#facc15] transition-colors" title={product.name}>
                                            {product.name}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                                        <div className="bg-[#090f15] p-1.5 rounded border border-[#30353d]">
                                            <span className="block text-[#d1c6ab]/60 text-[9px] uppercase font-bold">{t('col_category')}</span>
                                            <span className="text-[#dee2ec] truncate block font-semibold" title={product.category}>{product.category}</span>
                                        </div>
                                        <div className="bg-[#090f15] p-1.5 rounded border border-[#30353d]">
                                            <span className="block text-[#d1c6ab]/60 text-[9px] uppercase font-bold">{t('no_loc')}</span>
                                            <span className="text-[#4cd7f6] truncate block font-bold">{product.location || '-'}</span>
                                        </div>
                                    </div>

                                    {(product.lotNo || product.expiryDate) && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono mb-3 px-2 py-1 rounded bg-[#090f15] border border-[#30353d]">
                                            {product.lotNo && (
                                                <span className="font-bold text-[#dee2ec] truncate" title={`Lot: ${product.lotNo}`}>
                                                    Lot: {product.lotNo}
                                                </span>
                                            )}
                                            {product.expiryDate && (
                                                <span className={cn(
                                                    "ml-auto font-bold px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap",
                                                    new Date(product.expiryDate).getTime() < Date.now()
                                                        ? "bg-[#93000a] text-[#ffdad6]"
                                                        : (new Date(product.expiryDate).getTime() - Date.now() <= 30 * 86400000)
                                                        ? "bg-[#eec200]/20 text-[#facc15]"
                                                        : "bg-[#57ec7f]/20 text-[#57ec7f]"
                                                )}>
                                                    Exp: {product.expiryDate}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </Link>
                            </div>

                            <Link href={`/stock-card?search=${encodeURIComponent(product.name)}`} className="block">
                                <div className="space-y-1.5 pt-2 border-t border-[#30353d]/50 font-mono">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-[#d1c6ab] uppercase tracking-wider">{t('label_stock')}</span>
                                        <span className="text-xl font-bold text-white">
                                            {product.stock.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-[#d1c6ab]">
                                        <span>{t('label_min')} {product.minStock}</span>
                                        <div className="flex items-center gap-1 font-bold text-[#facc15] bg-[#090f15] px-1.5 py-0.5 rounded border border-[#30353d]">
                                            <span>฿</span>
                                            <span>{product.price.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>

                            <div className="mt-2.5 pt-2 border-t border-[#30353d]/40 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Link 
                                        href={`/inventory/print-labels?sku=${product.id}&name=${encodeURIComponent(product.name)}&price=${product.price}&code=${encodeURIComponent(product.location || product.id)}&stock=${product.stock}&location=${encodeURIComponent(product.location || '')}`}
                                        target="_blank"
                                        className="h-7 px-2 flex items-center gap-1 bg-[#252a32] text-[#d1c6ab] hover:text-[#facc15] rounded border border-[#30353d] font-mono text-[10px] transition-colors"
                                    >
                                        <Printer className="w-3 h-3" />
                                        <span>พิมพ์บาร์โค้ด</span>
                                    </Link>
                                    <button
                                        onClick={(e) => openEditModal(product, e)}
                                        className="h-7 w-7 flex items-center justify-center bg-[#252a32] text-[#d1c6ab] hover:text-[#dee2ec] rounded border border-[#30353d] transition-colors"
                                        title="แก้ไข"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                  );
              })}
              </AnimatePresence>
           </motion.div>
        )}

        {/* Zoom Modal */}
        <AnimatePresence>
            {zoomedImage && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setZoomedImage(null)}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <button 
                            onClick={() => setZoomedImage(null)}
                            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors z-50 backdrop-blur-md"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <div className="w-full h-full p-4 flex items-center justify-center overflow-auto" onClick={() => setZoomedImage(null)}>
                            <img 
                                src={`/api/proxy/image?url=${encodeURIComponent(zoomedImage)}`} 
                                alt="Zoomed" 
                                className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl cursor-default"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {filtered.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border border-[#30353d] rounded-2xl bg-[#171c23]/50 p-8 my-8">
                <div className="w-16 h-16 bg-[#252a32] border border-[#30353d] rounded-full flex items-center justify-center mb-4">
                    <Filter className="w-8 h-8 text-[#d1c6ab]" />
                </div>
                <h3 className="text-base font-mono font-bold text-[#dee2ec] mb-1">{t('no_products_found')}</h3>
                <p className="text-xs font-mono text-[#8a92a6] max-w-sm">{t('try_adjusting_filters')}</p>
                <button onClick={() => {setSearch(''); setFilterStatus('ALL'); setFilterMovement('ALL'); }} className="mt-4 px-4 py-1.5 rounded-lg border border-[#facc15]/40 bg-[#facc15]/10 text-[#facc15] font-mono text-xs font-bold hover:bg-[#facc15]/20 transition-colors">
                    Clear all filters
                </button>
            </div>
        )}

        {/* Product CRUD Modal */}
        <ProductModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            product={editingProduct}
            onSuccess={fetchData} 
        />

        {/* Embedded Camera Scanner for Instant Product Search */}
        <CameraScannerModal
            isOpen={showCamScan}
            onClose={() => setShowCamScan(false)}
            onScan={(scanned) => {
              setSearch(scanned.trim());
              setShowCamScan(false);
              toast.success(`ค้นหาจากบาร์โค้ด: ${scanned.trim()}`);
            }}
            title="สแกนบาร์โค้ดค้นหาสินค้าคงคลัง"
            description="ส่องกล้องไปที่บาร์โค้ดบนตัวสินค้าเพื่อค้นหาข้อมูลสต็อก พิกัดจัดเก็บ และประวัติ"
        />
    </div>
  );
}
