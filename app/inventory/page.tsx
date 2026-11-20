'use client';

import { useState, useEffect, Suspense } from 'react';
import { ProductModal } from '@/components/ProductModal';
import { ProductImportModal } from '@/components/ProductImportModal';
import { HistoryImportModal } from '@/components/HistoryImportModal';
import { LotBreakdownModal } from '@/components/LotBreakdownModal';
import { LocationSwapModal } from '@/components/LocationSwapModal';
import { UomModal } from '@/components/UomModal';
import { LotTraceModal } from '@/components/LotTraceModal';
import {
  Search,
  Plus,
  Download,
  RefreshCcw,
  X,
  Package,
  ArrowLeftRight,
  History,
  Printer,
  Pencil,
  Maximize2,
  Camera,
  Layers,
  FileSpreadsheet,
  Boxes,
  GitBranch,
  Sparkles,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { useNotification } from '@/components/providers/GlobalNotificationProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import toast from 'react-hot-toast';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';
import { errorMessage } from '@/lib/errors';

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent p-8 text-sm text-slate-600">Loading...</div>}>
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
  const [filterStatus, setFilterStatus] = useState(initialStatus); // ALL, LOW, OK, OUT, EXPIRING, EXPIRED, INACTIVE
  const [filterMovement, setFilterMovement] = useState('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showCamScan, setShowCamScan] = useState(false);
  const [selectedProductForLots, setSelectedProductForLots] = useState<any>(null);
  const [selectedProductForSwap, setSelectedProductForSwap] = useState<any>(null);
  const [selectedProductForUom, setSelectedProductForUom] = useState<any>(null);
  const [selectedProductForTrace, setSelectedProductForTrace] = useState<any>(null);
  const [showGlobalLotsModal, setShowGlobalLotsModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryImportOpen, setIsHistoryImportOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const seedDemoProducts = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/products/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลตัวอย่างไม่สำเร็จ');
      toast.success(data.message || 'โหลดสินค้าตัวอย่างพร้อม FEFO Lots สำเร็จแล้ว');
      fetchData();
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการโหลดข้อมูลตัวอย่าง');
    } finally {
      setSeeding(false);
    }
  };

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
  void sendNotification;

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
            setProducts(data);
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
  };

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

    const matchStatus = filterStatus === 'ALL' ||
                      (filterStatus === 'LOW' && stockStatus === 'LOW') ||
                      (filterStatus === 'OUT' && p.stock <= 0) ||
                      (filterStatus === 'OK' && stockStatus === 'OK') ||
                      (filterStatus === 'INACTIVE') ||
                      (filterStatus === 'EXPIRING' && isExpiringSoon) ||
                      (filterStatus === 'EXPIRED' && isExpired) ||
                      (filterStatus === 'OUT_EXPIRING' && (p.stock <= 0 || isExpiringSoon || isExpired));

    // Robust movement matching (Trim + Case Insensitive + Handle Empty)
    const pMovement = (p.movementStatus || '').trim().toLowerCase();
    const filterVal = filterMovement.trim().toLowerCase();
    const matchMovement = filterMovement === 'ALL' || pMovement === filterVal;

    return matchSearch && matchStatus && matchMovement;
  });

  // Quick summary counts from active catalog
  const activeProducts = products.filter(p => !isInactive(p.status));
  const totalCount = activeProducts.length;
  const lowCount = activeProducts.filter(p => p.stock <= p.minStock).length;
  const okCount = activeProducts.filter(p => p.stock > p.minStock).length;
  const nowMs = Date.now();
  const outCount = activeProducts.filter(p => p.stock <= 0).length;
  const expiringCount = activeProducts.filter(p => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate).getTime();
    return exp <= nowMs || (exp - nowMs) <= 30 * 86400000;
  }).length;
  const outOrExpiringCount = activeProducts.filter(p => {
    const isOut = p.stock <= 0;
    const exp = p.expiryDate ? new Date(p.expiryDate).getTime() : null;
    const isExp = exp !== null && (exp <= nowMs || (exp - nowMs) <= 30 * 86400000);
    return isOut || isExp;
  }).length;
  const outExpiringFilterKey = outCount > 0 && expiringCount === 0
    ? 'OUT'
    : expiringCount > 0 && outCount === 0
      ? 'EXPIRING'
      : 'OUT_EXPIRING';

  // Calculate Status dynamically for display
  const getStatus = (p: any) => {
    if (isInactive(p.status)) {
      return {
        label: 'Inactive',
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
      };
    }
    if (p.stock <= 0) {
      return {
        label: 'Out of Stock',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    }
    if (p.stock <= p.minStock) {
      return {
        label: 'Low Stock',
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    return {
      label: 'In Stock',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    };
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

  const statusPills = [
    { key: 'ALL', label: t('filter_all_status'), count: totalCount },
    { key: 'OK', label: t('filter_in_stock'), count: okCount },
    { key: 'LOW', label: t('filter_low_stock'), count: lowCount },
    { key: 'OUT', label: t('filter_out_of_stock') },
    { key: 'EXPIRING', label: 'ใกล้หมดอายุ (≤30d)' },
    { key: 'EXPIRED', label: 'หมดอายุแล้ว' },
    { key: 'INACTIVE', label: t('filter_inactive') },
  ];

  return (
    <div className="min-h-screen relative px-4 py-6 pb-32 sm:px-6 lg:p-8 bg-transparent text-[#0f172a]">
        {/* V7 Open Header Row + Pill Action Toolbar */}
        <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-6 max-w-[1500px] pt-1"
        >
           <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
             <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/85 shadow-xs">
                    <Package className="w-3 h-3 text-emerald-600" />
                    Inventory Control &amp; Stock Master
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                  {t('inventory_title')}
                </h1>
                <p className="text-slate-600 text-xs sm:text-sm mt-0.5">{t('inventory_subtitle')}</p>
             </div>

             {/* Primary Pill CTA + Compact Secondary Action Pills */}
             <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    <span>{t('add_product')}</span>
                </button>

                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shadow-xs"
                    title="นำเข้ารายการสินค้าจากไฟล์ Excel หรือ CSV"
                >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel / CSV</span>
                </button>

                <button
                    onClick={() => setIsHistoryImportOpen(true)}
                    className="flex items-center gap-1.5 bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shadow-xs"
                    title="นำเข้าประวัติรับ/จ่าย/ชำรุด (ย้ายระบบ)"
                >
                    <History className="w-3.5 h-3.5 text-amber-600" />
                    <span>นำเข้าประวัติ</span>
                </button>

                <button
                    onClick={() => setShowGlobalLotsModal(true)}
                    className="flex items-center gap-1.5 bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shadow-xs"
                    title="เปิดภาพรวมและการจัดการ Lot / FEFO ทั้งคลัง"
                >
                    <Layers className="w-3.5 h-3.5 text-sky-600" />
                    <span>Lots &amp; FEFO</span>
                </button>

                <Link
                    href="/ops/cycle-count"
                    className="hidden xl:flex items-center gap-1.5 bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shadow-xs"
                >
                    <RefreshCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cycle Count</span>
                </Link>

                <button
                    onClick={seedDemoProducts}
                    disabled={seeding}
                    className="flex items-center gap-1.5 bg-amber-50/90 hover:bg-amber-100 border border-amber-200/90 text-amber-800 px-3.5 py-2 rounded-full text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                    title="โหลดสินค้าตัวอย่างพร้อม FEFO Lots (Demo)"
                >
                    <Sparkles className={cn("w-3.5 h-3.5 text-amber-600", seeding && "animate-spin")} />
                    <span>{seeding ? 'กำลังโหลด...' : 'Seed Demo'}</span>
                </button>

                <button
                  onClick={fetchData}
                  className={cn(
                    "p-2 rounded-full transition-all border border-white/90 backdrop-blur-md shadow-xs",
                    loading ? "bg-white/50 text-slate-400" : "bg-white/80 text-slate-600 hover:text-slate-900 hover:bg-white"
                  )}
                  title="รีเฟรชข้อมูลสต็อก"
                >
                    <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>

                 <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm"
                 >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('export_csv')}</span>
                 </button>
             </div>
           </div>
        </motion.div>

        {/* 4-Card Bento Summary Strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="mx-auto mb-5 max-w-[1500px] grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* 1. Total SKUs */}
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={cn(
              "nx-glass-card p-5 text-left transition-all hover:-translate-y-0.5 flex flex-col justify-between gap-2.5",
              filterStatus === 'ALL' && "ring-2 ring-slate-900/20"
            )}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-semibold text-slate-600">Total SKUs</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/8 text-slate-700 border border-slate-900/10">
                Active
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 w-full">
              <span className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                {totalCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-500">รายการ</span>
            </div>
          </button>

          {/* 2. Healthy (OK) */}
          <button
            type="button"
            onClick={() => setFilterStatus('OK')}
            className={cn(
              "nx-glass-card p-5 text-left transition-all hover:-translate-y-0.5 flex flex-col justify-between gap-2.5",
              filterStatus === 'OK' && "ring-2 ring-emerald-500/45"
            )}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-semibold text-slate-600">Healthy (OK)</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 tabular-nums">
                {totalCount > 0 ? `${Math.round((okCount / totalCount) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 w-full">
              <span className="text-3xl font-bold text-emerald-700 tabular-nums tracking-tight">
                {okCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-slate-500">พร้อมใช้งาน</span>
            </div>
          </button>

          {/* 3. Low Stock (Amber accent) */}
          <button
            type="button"
            onClick={() => setFilterStatus('LOW')}
            className={cn(
              "nx-glass-card p-5 text-left transition-all hover:-translate-y-0.5 flex flex-col justify-between gap-2.5",
              filterStatus === 'LOW' && "ring-2 ring-amber-500/50"
            )}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-semibold text-slate-600">Low Stock</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/25">
                Reorder
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 w-full">
              <span className="text-3xl font-bold text-amber-600 tabular-nums tracking-tight">
                {lowCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-amber-700/80">ต่ำกว่า Min</span>
            </div>
          </button>

          {/* 4. Out / Expiring (Rose accent) */}
          <button
            type="button"
            onClick={() => setFilterStatus(outExpiringFilterKey)}
            className={cn(
              "nx-glass-card p-5 text-left transition-all hover:-translate-y-0.5 flex flex-col justify-between gap-2.5",
              (filterStatus === 'OUT_EXPIRING' || filterStatus === 'OUT' || filterStatus === 'EXPIRING' || filterStatus === 'EXPIRED') && "ring-2 ring-rose-500/45"
            )}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-semibold text-slate-600">Out / Expiring</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/12 text-rose-700 border border-rose-500/25 tabular-nums">
                Out {outCount} · Exp {expiringCount}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 w-full">
              <span className="text-3xl font-bold text-rose-600 tabular-nums tracking-tight">
                {outOrExpiringCount.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-rose-700/80">ต้องรีบจัดการ</span>
            </div>
          </button>
        </motion.div>

        {/* Search + Barcode/PDA Scan Bar + Segmented Pill Filters */}
        <motion.div
             initial={{ opacity: 0, y: 12 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.05 }}
             className="mx-auto mb-6 max-w-[1500px] nx-glass-card p-4 space-y-3.5"
         >
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 relative flex items-center gap-2.5">
                  <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                         type="text"
                         placeholder={t('search_placeholder')}
                         value={search}
                         onChange={e => setSearch(e.target.value)}
                         className="w-full pl-10 pr-28 py-2.5 bg-white/85 border border-white/90 rounded-full text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {search && (
                          <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                            aria-label="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowCamScan(true)}
                          title="สแกนบาร์โค้ดสินค้า"
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-400" />
                          <span>สแกน</span>
                        </button>
                      </div>
                  </div>
                  <span className="px-4 py-2.5 bg-white/75 border border-white/90 rounded-full text-slate-700 text-xs font-semibold whitespace-nowrap tabular-nums">
                      {search ? `ค้นพบ ${filtered.length.toLocaleString()} รายการ` : `ทั้งหมด ${filtered.length.toLocaleString()} รายการ`}
                  </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                    value={filterMovement}
                    onChange={e => setFilterMovement(e.target.value)}
                    className="px-4 py-2.5 bg-white/80 border border-white/90 rounded-full text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                >
                    <option value="ALL">{t('filter_all_movements')}</option>
                    <option value="Fast Moving">{t('filter_fast_moving')}</option>
                    <option value="Normal Moving">{t('filter_normal_moving')}</option>
                    <option value="Slow Moving">{t('filter_slow_moving')}</option>
                    <option value="Deadstock">{t('filter_deadstock')}</option>
                </select>

                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={cn(
                    "px-4 py-2.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all",
                    showInactive
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white/80 text-slate-600 border-white/90 hover:text-slate-900 hover:bg-white shadow-xs"
                  )}
                >
                    {showInactive ? t('show_active_only') : t('show_inactive')}
                </button>
              </div>
            </div>

            {/* Segmented Status Pill Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {statusPills.map((pill) => {
                const isActive = filterStatus === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setFilterStatus(pill.key)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border",
                      isActive
                        ? pill.key === 'LOW' || pill.key === 'OUT' || pill.key === 'EXPIRED'
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white/70 text-slate-600 border-white/90 hover:bg-white hover:text-slate-900"
                    )}
                  >
                    <span>{pill.label}</span>
                    {typeof pill.count === 'number' && (
                      <span className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums",
                        isActive ? "bg-white/20 text-white" : "bg-slate-900/8 text-slate-700"
                      )}>
                        {pill.count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
        </motion.div>

        {/* High-Legibility Frosted SKU Table */}
        {loading ? (
            <div className="mx-auto max-w-[1500px] nx-glass-card !rounded-[24px] p-5 space-y-3">
               <Skeleton className="h-10 w-full rounded-xl bg-white/70" />
               {[...Array(8)].map((_, i) => (
                   <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/50" />
               ))}
            </div>
        ) : filtered.length > 0 ? (
            <div className="mx-auto max-w-[1500px] nx-glass-card !rounded-[24px] overflow-hidden">
              <div className="overflow-x-auto max-h-[calc(100vh-290px)]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur-md border-b border-slate-200/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4 pl-5">สินค้า / SKU</th>
                      <th className="py-3.5 px-4">{t('col_category')}</th>
                      <th className="py-3.5 px-4">พิกัด &amp; Lot / Exp</th>
                      <th className="py-3.5 px-4 text-right">{t('label_stock')}</th>
                      <th className="py-3.5 px-4 text-right">ราคา</th>
                      <th className="py-3.5 px-4 text-center">{t('col_status')}</th>
                      <th className="py-3.5 px-4 pr-5 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/50 text-sm">
                    {filtered.map((product) => {
                      const status = getStatus(product);
                      const expTime = product.expiryDate ? new Date(product.expiryDate).getTime() : null;
                      const isExpired = expTime !== null && expTime < Date.now();
                      const isExpiring = expTime !== null && !isExpired && (expTime - Date.now() <= 30 * 86400000);

                      return (
                        <tr
                          key={product.id}
                          className="group hover:bg-emerald-50/40 transition-colors"
                        >
                          {/* Product Thumbnail + Name + SKU */}
                          <td className="py-3.5 px-4 pl-5">
                            <div className="flex items-center gap-3 min-w-[230px]">
                              <div className="relative w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 shrink-0 overflow-hidden group/img">
                                {product.image ? (
                                  <>
                                    <img
                                      src={`/api/proxy/image?url=${encodeURIComponent(product.image)}`}
                                      alt={product.name}
                                      className="w-full h-full object-cover cursor-zoom-in"
                                      onClick={() => setZoomedImage(product.image)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setZoomedImage(product.image)}
                                      className="hidden md:flex absolute inset-0 bg-slate-900/50 text-white items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                      title="ขยายรูปภาพ"
                                    >
                                      <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/inventory/stock-card?search=${encodeURIComponent(product.name)}&sku=${encodeURIComponent(product.id || '')}`}
                                  className="font-semibold text-slate-900 hover:text-emerald-600 transition-colors line-clamp-1"
                                  title={product.name}
                                >
                                  {product.name}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[11px] text-slate-500">{product.id}</span>
                                  {product.movementStatus && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium">
                                      {product.movementStatus}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/80 border border-slate-200/70 text-slate-700 text-xs font-medium max-w-[140px] truncate" title={product.category}>
                              {product.category || '-'}
                            </span>
                          </td>

                          {/* Location + Lot / Expiry */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-700">
                                <MapPin className="w-3 h-3 text-sky-600 shrink-0" />
                                {product.location || '-'}
                              </span>
                              {(product.lotNo || product.expiryDate) && (
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  {product.lotNo && (
                                    <span className="font-mono text-slate-500">Lot: {product.lotNo}</span>
                                  )}
                                  {product.expiryDate && (
                                    <span className={cn(
                                      "font-mono font-semibold px-1.5 py-0.5 rounded-md text-[10px]",
                                      isExpired
                                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                                        : isExpiring
                                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    )}>
                                      Exp: {product.expiryDate}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Stock & Min / Reserved */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className={cn(
                                "text-base font-bold tabular-nums",
                                product.stock <= 0
                                  ? "text-rose-600"
                                  : product.stock <= product.minStock
                                  ? "text-amber-600"
                                  : "text-slate-900"
                              )}>
                                {product.stock.toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-400 tabular-nums">
                                {t('label_min')} {product.minStock}
                              </span>
                              {!!product.reserved && (
                                <span
                                  className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md mt-1 tabular-nums"
                                  title="สต็อกถูกตัดจริงตอนส่งออก (SHIPPED) — ระหว่างนี้ออเดอร์ที่เปิดอยู่จองไว้"
                                >
                                  จอง {product.reserved.toLocaleString()} · พร้อม {(product.available ?? 0).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-semibold text-slate-800 tabular-nums text-xs">
                              ฿{product.price.toLocaleString()}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap",
                              status.badge
                            )}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                              {status.label}
                            </span>
                          </td>

                          {/* Row Action Buttons */}
                          <td className="py-3.5 px-4 pr-5 text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <Link
                                href={`/inventory/print-labels?sku=${product.id}&name=${encodeURIComponent(product.name)}&price=${product.price}&code=${encodeURIComponent(product.location || product.id)}&stock=${product.stock}&location=${encodeURIComponent(product.location || '')}`}
                                target="_blank"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                title="พิมพ์บาร์โค้ด"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedProductForLots(product);
                                }}
                                className="h-8 px-2 inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50/70 text-sky-700 hover:bg-sky-100 text-[11px] font-semibold transition-colors"
                                title="ตรวจสอบ Lot & FEFO"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Lots</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedProductForTrace(product);
                                }}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50/70 text-rose-600 hover:bg-rose-100 transition-colors"
                                title="สืบค้นย้อนกลับ & เรียกคืนล็อต (Traceability/Recall)"
                              >
                                <GitBranch className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedProductForSwap(product);
                                }}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100 transition-colors"
                                title="สลับพิกัดจัดเก็บ (1-Click Location Swap)"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedProductForUom(product);
                                }}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                title="ตั้งค่าหน่วยบรรจุ (ชิ้น/ลัง/พาเลท)"
                              >
                                <Boxes className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => openEditModal(product, e)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                                title="แก้ไขสินค้า"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
        ) : null}

        {/* Zoom Modal */}
        <AnimatePresence>
            {zoomedImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setZoomedImage(null)}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 cursor-zoom-out"
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
                            className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 text-white rounded-full p-2 transition-colors z-50 backdrop-blur-md"
                        >
                            <X className="w-7 h-7" />
                        </button>
                        <div className="w-full h-full p-4 flex items-center justify-center overflow-auto" onClick={() => setZoomedImage(null)}>
                            <img
                                src={`/api/proxy/image?url=${encodeURIComponent(zoomedImage)}`}
                                alt="Zoomed"
                                className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl cursor-default"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {filtered.length === 0 && !loading && (
            <div className="mx-auto max-w-[1500px] flex flex-col items-center justify-center py-16 text-center nx-glass-card !rounded-[24px] p-8 my-6">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mb-4 text-emerald-600">
                    <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {search ? 'ไม่พบสินค้าตามคำค้นหา' : 'ยังไม่มีรายการสินค้าในสาขานี้'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mb-6">
                    {search
                        ? 'ลองปรับตัวกรองหรือคำค้นหาใหม่ หรือล้างตัวกรองทั้งหมด'
                        : 'คุณสามารถกดเพิ่มสินค้าใหม่ หรือคลิกโหลดข้อมูลตัวอย่างเพื่อทดสอบระบบจัดเก็บ, คิวงาน, และการจัดการ Lot / FEFO ได้ทันที'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>เพิ่มสินค้าใหม่</span>
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-all shadow-xs"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>นำเข้าไฟล์ Excel / CSV</span>
                    </button>
                    <button
                        onClick={seedDemoProducts}
                        disabled={seeding}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100 transition-all shadow-xs disabled:opacity-50"
                    >
                        <RefreshCcw className={cn("w-4 h-4 text-amber-600", seeding && "animate-spin")} />
                        <span>{seeding ? 'กำลังสร้างข้อมูล...' : 'โหลดสินค้าตัวอย่างพร้อม FEFO Lots (Demo)'}</span>
                    </button>
                    <button
                        onClick={() => setShowGlobalLotsModal(true)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-all shadow-xs"
                    >
                        เปิดหน้าต่าง Lots &amp; FEFO
                    </button>
                    {(search || filterStatus !== 'ALL' || filterMovement !== 'ALL') && (
                        <button
                            onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterMovement('ALL'); }}
                            className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 transition-all"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Product CRUD Modal */}
        <ProductModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            product={editingProduct}
            onSuccess={fetchData}
            onOpenImport={() => {
                setIsModalOpen(false);
                setIsImportModalOpen(true);
            }}
        />

        {/* Batch Product Import Modal (Excel / CSV) */}
        <ProductImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
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

        {/* Global FEFO Lots Modal */}
        <LotBreakdownModal
            isOpen={showGlobalLotsModal}
            onClose={() => setShowGlobalLotsModal(false)}
            allProducts={products}
            onRefresh={fetchData}
        />

        {/* Single Product FEFO Lots Modal */}
        <LotBreakdownModal
            isOpen={!!selectedProductForLots}
            onClose={() => setSelectedProductForLots(null)}
            product={selectedProductForLots}
            allProducts={products}
            onRefresh={fetchData}
        />

        {/* 1-Click Location Swap & Relocation Modal */}
        <LocationSwapModal
            isOpen={!!selectedProductForSwap}
            onClose={() => setSelectedProductForSwap(null)}
            sourceProduct={selectedProductForSwap}
            allProducts={products}
            onSwapSuccess={fetchData}
        />

        {/* Pack Hierarchy (UOM) Modal */}
        <UomModal
            isOpen={!!selectedProductForUom}
            onClose={() => setSelectedProductForUom(null)}
            product={selectedProductForUom}
            onRefresh={fetchData}
        />

        {/* Lot Traceability / Recall Modal */}
        <LotTraceModal
            isOpen={!!selectedProductForTrace}
            onClose={() => setSelectedProductForTrace(null)}
            product={selectedProductForTrace}
        />

        {/* Stock History Import (migration) */}
        <HistoryImportModal
            isOpen={isHistoryImportOpen}
            onClose={() => setIsHistoryImportOpen(false)}
            onSuccess={fetchData}
        />
    </div>
  );
}
