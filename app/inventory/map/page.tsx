'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import {
  ArrowLeft,
  LayoutGrid,
  MapPin,
  Search,
  RefreshCw,
  Box,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Printer,
  X,
  ArrowLeftRight,
  Wand2,
  PencilRuler,
  ScanSearch,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { LocationSwapModal } from '@/components/LocationSwapModal';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { db } from '@/lib/db';
import {
  buildWarehouseMap,
  stockRowsFromProducts,
  BinStockRow,
  MapBin,
  LooseStock,
} from '@/lib/warehouseMap';
import {
  WarehouseLayout,
  listLayoutBins,
  validateLayout,
  inferLayoutFromBinCodes,
} from '@/lib/warehouseLayout';
import Warehouse3DViewer from '@/components/warehouse/Warehouse3DViewer';
import Warehouse2DPlan from '@/components/warehouse/Warehouse2DPlan';
import WarehouseWizardModal from '@/components/warehouse/WarehouseWizardModal';
import WarehouseBatchLabelModal from '@/components/warehouse/WarehouseBatchLabelModal';
import { toast } from 'react-hot-toast';

type LayoutState = WarehouseLayout & { saved?: boolean; legacyFrom?: string | null };

export default function WarehouseMapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#1b2027]">
          <div className="text-[#8a92a6] font-bold text-sm flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
            กำลังโหลดแผนผังคลังสินค้า...
          </div>
        </div>
      }
    >
      <WarehouseMapContent />
    </Suspense>
  );
}

/**
 * Branch the map is for. The sidebar BranchSelector puts ?branchId= in the URL;
 * without it the selector shows URT (or the first branch), so do the same.
 */
function useMapBranch(): string | null {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get('branchId') || '';
  const [fallback, setFallback] = useState<string | null>(null);

  useEffect(() => {
    if (fromUrl) return;
    let cancelled = false;
    fetch(getApiUrl('/api/branches'))
      .then(r => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (cancelled) return;
        const ids = Array.isArray(list) ? list.map(b => b.id || b.code).filter(Boolean) : [];
        setFallback(ids.includes('URT') ? 'URT' : ids[0] || 'MAIN');
      })
      .catch(() => !cancelled && setFallback('MAIN'));
    return () => { cancelled = true; };
  }, [fromUrl]);

  return fromUrl || fallback;
}

function toModalBin(loose: LooseStock): MapBin {
  return {
    binCode: loose.binCode,
    rackCode: '',
    zoneCode: '',
    bay: 0,
    level: 0,
    products: loose.products,
    totalStock: loose.totalStock,
    status: loose.totalStock > 0 ? 'NORMAL' : 'EMPTY',
    velocityClass: 'D',
  };
}

function WarehouseMapContent() {
  const branchId = useMapBranch();

  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stockRows, setStockRows] = useState<BinStockRow[]>([]);
  const [layout, setLayout] = useState<LayoutState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  // View Controls
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [heatmapMode, setHeatmapMode] = useState<'STOCK' | 'VELOCITY'>('STOCK');
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('2D');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<MapBin | null>(null);
  const [swapProduct, setSwapProduct] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [showOrphans, setShowOrphans] = useState(true);

  const updateLayout = useCallback((next: LayoutState) => {
    setLayout(next);
    setDirty(true);
  }, []);

  const saveLayout = async (toSave: LayoutState | null = layout) => {
    if (!toSave || !branchId) return;
    const problems = validateLayout(toSave.racks);
    if (problems.length) {
      toast.error(problems[0], { duration: 6000 });
      return;
    }
    setIsSavingLayout(true);
    try {
      const res = await fetch(getApiUrl('/api/warehouse/layout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          name: toSave.name,
          widthM: toSave.widthM,
          lengthM: toSave.lengthM,
          heightM: toSave.heightM,
          racks: toSave.racks,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        toast.success(data.message || 'บันทึกผังคลังเรียบร้อย');
        if (data.warning) toast(data.warning, { icon: '⚠️', duration: 8000 });
        setLayout({ ...toSave, branchId, saved: true, legacyFrom: null });
        setDirty(false);
      } else {
        toast.error(data?.error || 'ไม่สามารถบันทึกผังคลังได้', { duration: 6000 });
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleApplyWizard = async (newLayout: any) => {
    const next: LayoutState = { ...newLayout, branchId: branchId || newLayout.branchId };
    setLayout(next);
    await saveLayout(next);
  };

  const fetchData = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    const loadCachedProducts = async () => {
      const cached = await db.products.toArray().catch(() => []);
      if (cached.length > 0) setProducts(cached);
    };
    try {
      const [prodRes, transRes, layoutRes, stockRes] = await Promise.all([
        fetch(getApiUrl('/api/products')).catch(() => null),
        fetch(getApiUrl('/api/transactions?limit=500')).catch(() => null),
        fetch(getApiUrl(`/api/warehouse/layout?branchId=${encodeURIComponent(branchId)}`)).catch(() => null),
        fetch(getApiUrl('/api/warehouse/bin-stock')).catch(() => null),
      ]);

      let prods: any[] = [];
      if (prodRes?.ok) {
        const data = await prodRes.json();
        if (Array.isArray(data)) prods = data;
      }
      if (prods.length > 0) setProducts(prods);
      else await loadCachedProducts();

      if (transRes?.ok) {
        const data = await transRes.json();
        if (Array.isArray(data?.transactions)) setTransactions(data.transactions);
      }

      if (layoutRes?.ok) {
        const data = await layoutRes.json();
        if (data?.success && data.data) {
          setLayout(data.data);
          setDirty(false);
        }
      }

      let rows: BinStockRow[] = [];
      if (stockRes?.ok) {
        const data = await stockRes.json();
        if (data?.success && Array.isArray(data.rows)) rows = data.rows;
      }
      // stock_locations not migrated / empty → fall back to products.location
      setStockRows(rows.length > 0 ? rows : stockRowsFromProducts(prods));
    } catch (e) {
      console.error('Failed to load map data:', e);
      await loadCachedProducts();
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const effectiveStockRows = useMemo(
    () => (stockRows.length > 0 ? stockRows : stockRowsFromProducts(products)),
    [stockRows, products],
  );

  const map = useMemo(
    () => buildWarehouseMap(layout?.racks || [], effectiveStockRows, products, transactions),
    [layout, effectiveStockRows, products, transactions],
  );
  const { zones, stats, orphans, unassigned } = map;

  useEffect(() => {
    if (zoneFilter !== 'ALL' && !zones.some(z => z.zoneCode === zoneFilter)) setZoneFilter('ALL');
  }, [zones, zoneFilter]);

  const allBinsList = useMemo(() => listLayoutBins(layout?.racks || []).map(b => b.binCode), [layout]);

  // Same per-bin stock for the 3D twin.
  const binStock3D = useMemo(() => {
    const m = new Map<string, { products: any[]; totalStock: number; velocityClass: string; status: string }>();
    map.binIndex.forEach((bin, code) => {
      if (bin.totalStock <= 0) return;
      m.set(code, {
        totalStock: bin.totalStock,
        velocityClass: bin.velocityClass,
        status: bin.status,
        products: bin.products.map(p => ({ id: p.id, sku: p.id, name: p.name, stock: p.stock, unit: p.unit })),
      });
    });
    return m;
  }, [map]);

  const matchingBinCodes = useMemo(() => {
    const matched = new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matched;
    map.binIndex.forEach((bin, code) => {
      if (
        code.toLowerCase().includes(q) ||
        bin.products.some(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      ) {
        matched.add(code);
      }
    });
    return matched;
  }, [map, searchQuery]);

  // Stock that matches the search but sits in a bin the layout doesn't contain.
  const outsideMatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [] as string[];
    return [...map.orphans, ...(map.unassigned ? [map.unassigned] : [])]
      .filter(o => o.binCode.toLowerCase().includes(q) || o.products.some(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)))
      .map(o => o.binCode);
  }, [map, searchQuery]);

  // Jump to the first rack holding a search hit.
  useEffect(() => {
    if (matchingBinCodes.size === 0) return;
    const first = map.binIndex.get(Array.from(matchingBinCodes)[0]);
    if (first) setSelectedRackCode(first.rackCode);
  }, [matchingBinCodes, map]);

  const handleInferLayout = () => {
    const codes = Array.from(new Set(effectiveStockRows.map(r => r.binCode)));
    if (codes.length === 0) {
      toast.error('ยังไม่มีโลเคชันที่มีสต็อกให้ใช้สร้างผัง');
      return;
    }
    if ((layout?.racks.length || 0) > 0 && !window.confirm('สร้างผังใหม่จากโลเคชันที่มีสต็อกอยู่จริง แทนผังปัจจุบัน?\n(ยังไม่บันทึกจนกว่าจะกด "บันทึกผัง")')) {
      return;
    }
    const { layout: inferred, matched, unmatched } = inferLayoutFromBinCodes(codes, {
      branchId: branchId || 'MAIN',
      name: layout?.name,
      heightM: layout?.heightM,
    });
    updateLayout({ ...inferred, saved: layout?.saved, legacyFrom: layout?.legacyFrom });
    setSelectedRackCode(null);
    toast.success(`ร่างผัง ${inferred.racks.length} แร็กจาก ${matched} โลเคชัน — ตรวจ/จัดตำแหน่งแล้วกด "บันทึกผัง"`, { duration: 7000 });
    if (unmatched.length) {
      toast(`อ่านรูปแบบไม่ได้ ${unmatched.length} รหัส เช่น ${unmatched.slice(0, 3).join(', ')} — เพิ่มเป็นแร็กเองได้ในโหมดแก้ไข 3D`, { icon: 'ℹ️', duration: 9000 });
    }
  };

  const openEditor = () => {
    setViewMode('3D');
    setIsEditMode(true);
  };

  const rackCount = layout?.racks.length || 0;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 bg-[#1b2027]">
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[1.75rem] border border-teal-500/30 bg-[#171c23] p-6 shadow-xl shadow-teal-900/5 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/inventory"
                className="p-3 bg-teal-500/10 hover:bg-teal-500/20 rounded-xl border border-teal-500/30 text-teal-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#dee2ec] flex items-center gap-2.5">
                  <LayoutGrid className="w-8 h-8 text-teal-600" />
                  ผังคลังสินค้า
                </h1>
                <p className="text-sm text-[#8a92a6] mt-0.5">
                  {layout?.name || 'คลังสินค้า'} • สาขา <span className="font-mono font-bold text-teal-400">{branchId || '…'}</span> • สต็อกจริงรายช่องจากโลเคชัน
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleInferLayout}
                className="px-3.5 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="ร่างผังจากรหัสโลเคชันที่มีสต็อกอยู่จริง"
              >
                <ScanSearch className="w-4 h-4" />
                สร้างผังจากโลเคชันจริง
              </button>
              <button
                onClick={openEditor}
                className="px-3.5 py-2.5 bg-[#facc15]/10 hover:bg-[#facc15]/20 text-[#facc15] border border-[#facc15]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <PencilRuler className="w-4 h-4" />
                แก้ไขผัง
              </button>
              <Link
                href="/admin/slotting"
                className="px-3.5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                ABC Slotting
              </Link>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 bg-[#171c23] hover:bg-[#1b2027] text-[#d1c6ab] rounded-xl border border-[#30353d] shadow-sm transition-all"
                title="รีเฟรชข้อมูลผัง"
              >
                <RefreshCw className={cn('w-4 h-4 text-teal-600', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </header>

        {/* Layout status banners */}
        {layout?.legacyFrom && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              สาขา <b className="font-mono">{branchId}</b> ยังไม่มีผังของตัวเอง — กำลังแสดงผังเดิมที่บันทึกไว้ก่อนแยกสาขา (<span className="font-mono">{layout.legacyFrom}</span>).
              กด &quot;บันทึกผัง&quot; เพื่อเก็บเป็นผังของสาขานี้
            </span>
          </div>
        )}
        {dirty && (
          <div className="rounded-2xl border border-[#facc15]/40 bg-[#facc15]/10 px-4 py-3 text-xs text-[#facc15] flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> ผังมีการแก้ไขที่ยังไม่บันทึก
            </span>
            <button
              onClick={() => saveLayout()}
              disabled={isSavingLayout}
              className="px-3 py-1.5 rounded-lg bg-[#facc15] text-[#1b1600] font-black disabled:opacity-50"
            >
              {isSavingLayout ? 'กำลังบันทึก...' : 'บันทึกผัง'}
            </button>
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-teal-500/10 text-teal-600 rounded-xl border border-teal-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">สต็อกที่อยู่ในผัง</span>
              <span className="text-lg font-black text-[#dee2ec] font-mono">{stats.mappedStock.toLocaleString()} ชิ้น</span>
              <span className="text-[10px] text-teal-600 block font-bold">
                จากทั้งหมด {stats.totalWarehouseStock.toLocaleString()} ชิ้น
              </span>
            </div>
          </div>

          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">อัตราการใช้ช่อง</span>
              <span className="text-lg font-black text-emerald-600 font-mono">{stats.occupancyRate}%</span>
              <span className="text-[10px] text-[#8a92a6] block">
                {stats.occupiedBins.toLocaleString()} จาก {stats.totalBins.toLocaleString()} ช่อง
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowOrphans(v => !v)}
            className={cn(
              'text-left bg-[#171c23] p-4 rounded-2xl border shadow-sm flex items-center gap-3 transition-colors',
              orphans.length > 0 ? 'border-amber-500/40 hover:border-amber-400' : 'border-[#30353d]',
            )}
          >
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">โลเคชันที่ไม่อยู่ในผัง</span>
              <span className="text-lg font-black text-amber-600 font-mono">{orphans.length.toLocaleString()} รหัส</span>
              <span className="text-[10px] text-[#8a92a6] block">
                {stats.orphanStock.toLocaleString()} ชิ้น{stats.unassignedStock > 0 && ` • ไม่ระบุที่ ${stats.unassignedStock.toLocaleString()}`}
              </span>
            </div>
          </button>

          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">โครงสร้างผัง</span>
              <span className="text-lg font-black text-blue-600 font-mono">
                {zones.length} โซน • {stats.totalRacks} แร็ก
              </span>
              <span className="text-[10px] text-amber-500 block font-bold">
                {stats.lowStockBins > 0 ? `${stats.lowStockBins} ช่องสต็อกต่ำ` : ' '}
              </span>
            </div>
          </div>
        </div>

        {/* Stock the layout doesn't cover */}
        {showOrphans && (orphans.length > 0 || unassigned) && (
          <div className="bg-[#171c23] rounded-2xl border border-amber-500/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-amber-300">โลเคชันที่มีสต็อกแต่ยังไม่อยู่ในผัง</h3>
              <span className="text-[11px] text-[#8a92a6]">
                เพิ่มแร็ก/ปรับรูปแบบรหัสโลเคชันให้ตรงป้ายจริง หรือกด &quot;สร้างผังจากโลเคชันจริง&quot;
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {unassigned && (
                <button
                  onClick={() => setSelectedBin(toModalBin(unassigned))}
                  className="px-2.5 py-1 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-200 text-[11px] font-mono"
                >
                  ไม่ระบุที่ • {unassigned.totalStock.toLocaleString()}
                </button>
              )}
              {orphans.map(o => (
                <button
                  key={o.binCode}
                  onClick={() => setSelectedBin(toModalBin(o))}
                  className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-100 text-[11px] font-mono hover:border-amber-400"
                >
                  {o.binCode} • {o.totalStock.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {[{ zoneCode: 'ALL', totalStock: stats.mappedStock }, ...zones].map(z => {
              const isSelected = z.zoneCode === zoneFilter;
              return (
                <button
                  key={z.zoneCode}
                  onClick={() => setZoneFilter(z.zoneCode)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap',
                    isSelected ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20' : 'bg-[#252a32] hover:bg-[#30353d] text-[#d1c6ab]',
                  )}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {z.zoneCode === 'ALL' ? 'ทุกโซน' : `โซน ${z.zoneCode}`}
                  <span className={cn('ml-1 px-1.5 rounded text-[10px] font-mono', isSelected ? 'bg-teal-700 text-teal-100' : 'bg-[#30353d] text-[#d1c6ab]')}>
                    {z.totalStock.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem] md:w-64">
              <Search className="w-4 h-4 text-[#8a92a6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา SKU / ชื่อสินค้า / โลเคชัน..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-28 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-xs outline-none focus:border-teal-500 focus:bg-[#171c23] transition-colors"
              />
              {searchQuery.trim() && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap',
                      matchingBinCodes.size > 0 ? 'bg-cyan-500/15 text-cyan-600' : 'bg-rose-500/15 text-rose-500',
                    )}
                    title={outsideMatches.length ? `อยู่นอกผัง: ${outsideMatches.slice(0, 10).join(', ')}` : undefined}
                  >
                    {matchingBinCodes.size > 0
                      ? `พบ ${matchingBinCodes.size} ช่อง`
                      : outsideMatches.length > 0
                        ? `นอกผัง ${outsideMatches.length}`
                        : 'ไม่พบ'}
                  </span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-600"
                    aria-label="ล้างคำค้น"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center bg-[#252a32] p-1 rounded-xl border border-[#30353d]">
              <button
                onClick={() => setViewMode('2D')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  viewMode === '2D' ? 'bg-teal-600 text-white shadow-sm' : 'text-[#8a92a6]',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> 2D ผังพื้น
              </button>
              <button
                onClick={() => setViewMode('3D')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  viewMode === '3D' ? 'bg-[#facc15] text-[#1b1600] shadow-md shadow-[#facc15]/20 font-black' : 'text-[#8a92a6]',
                )}
              >
                <Box className="w-3.5 h-3.5" /> 3D
              </button>
            </div>

            <div className="flex items-center bg-[#252a32] p-1 rounded-xl border border-[#30353d]">
              <button
                onClick={() => setHeatmapMode('STOCK')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                  heatmapMode === 'STOCK' ? 'bg-[#171c23] text-[#dee2ec] shadow-sm' : 'text-[#8a92a6]',
                )}
              >
                <Layers className="w-3.5 h-3.5" /> สต็อก
              </button>
              <button
                onClick={() => setHeatmapMode('VELOCITY')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                  heatmapMode === 'VELOCITY' ? 'bg-orange-500 text-white shadow-sm' : 'text-[#8a92a6]',
                )}
              >
                <Flame className="w-3.5 h-3.5" /> ABC
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-2 text-xs text-[#d1c6ab]">
          <span className="font-bold text-[#d1c6ab]">สัญลักษณ์สี:</span>
          {heatmapMode === 'STOCK' ? (
            <>
              <Legend color="bg-emerald-500" label="มีสต็อก" />
              <Legend color="bg-amber-500" label="สินค้าต่ำกว่า Min" />
              <Legend color="bg-slate-600" label="ช่องว่าง" />
              <Legend color="bg-cyan-400" label="ตรงกับที่ค้นหา" />
            </>
          ) : (
            <>
              <Legend color="bg-red-500" label="Class A หยิบบ่อยมาก" />
              <Legend color="bg-amber-500" label="Class B" />
              <Legend color="bg-blue-500" label="Class C" />
              <Legend color="bg-purple-500" label="Class D ไม่มียอดจ่าย" />
              <Legend color="bg-slate-600" label="ช่องว่าง" />
            </>
          )}
        </div>

        {/* Empty state: branch has no racks yet */}
        {!loading && rackCount === 0 && (
          <div className="bg-[#171c23] rounded-3xl border border-dashed border-teal-500/40 p-8 text-center space-y-4">
            <LayoutGrid className="w-10 h-10 text-teal-500 mx-auto" />
            <div>
              <h2 className="text-lg font-black text-[#dee2ec]">สาขานี้ยังไม่มีผังคลัง</h2>
              <p className="text-xs text-[#8a92a6] mt-1">
                เริ่มจากรหัสโลเคชันที่มีสต็อกอยู่จริง ({(orphans.length + (unassigned ? 1 : 0)).toLocaleString()} รหัส) หรือใช้ตัวช่วยสร้างผังแบบกำหนดเอง
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={handleInferLayout}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-1.5"
              >
                <ScanSearch className="w-4 h-4" /> สร้างผังจากโลเคชันจริง
              </button>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#252a32] hover:bg-[#30353d] border border-[#30353d] text-[#dee2ec] text-xs font-bold flex items-center gap-1.5"
              >
                <Wand2 className="w-4 h-4 text-[#facc15]" /> ตัวช่วยสร้างผัง
              </button>
            </div>
          </div>
        )}

        {/* 3D Digital Twin (also the layout editor) */}
        {viewMode === '3D' && layout && (
          <Warehouse3DViewer
            key={branchId || 'MAIN'}
            layout={layout}
            products={products}
            binStock={binStock3D}
            highlightBinCodes={matchingBinCodes}
            heatmapMode={heatmapMode === 'VELOCITY' ? 'VELOCITY' : 'STOCK'}
            branchName={layout.name || 'คลังสินค้า'}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
            onOpenWizard={() => setIsWizardOpen(true)}
            onOpenLabelModal={() => setIsLabelModalOpen(true)}
            onSaveLayout={() => saveLayout()}
            isSaving={isSavingLayout}
            onUpdateLayout={next => updateLayout({ ...layout, ...next })}
            onSelectBin={binCode => {
              const bin = map.binIndex.get(binCode);
              if (bin) setSelectedBin(bin);
            }}
          />
        )}

        {/* 2D floor plan + rack elevation */}
        {viewMode === '2D' && layout && rackCount > 0 && (
          <div className="bg-[#171c23] rounded-3xl p-4 sm:p-6 shadow-2xl border border-[#30353d] text-[#dee2ec]">
            <Warehouse2DPlan
              layout={layout}
              map={map}
              heatmapMode={heatmapMode}
              matchingBinCodes={matchingBinCodes}
              zoneFilter={zoneFilter}
              selectedRackCode={selectedRackCode}
              onSelectRack={setSelectedRackCode}
              onSelectBin={setSelectedBin}
            />
          </div>
        )}

        {/* Selected Bin Details */}
        <AnimatePresence>
          {selectedBin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedBin(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#171c23] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#30353d] space-y-5 text-[#dee2ec]"
              >
                <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-teal-500/10 text-teal-600 rounded-xl">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-[#dee2ec] font-mono">พิกัด: {selectedBin.binCode}</h3>
                      <p className="text-xs text-[#8a92a6]">
                        {selectedBin.rackCode
                          ? `โซน ${selectedBin.zoneCode} • แร็ก ${selectedBin.rackCode} • ช่อง ${selectedBin.bay} • ชั้น ${selectedBin.level}`
                          : 'ไม่อยู่ในผังคลังของสาขานี้'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBin(null)}
                    className="p-2 hover:bg-[#252a32] rounded-xl text-[#8a92a6] hover:text-[#d1c6ab]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-[#1b2027] p-3 rounded-2xl border border-[#30353d]">
                  <div>
                    <span className="text-[10px] text-[#8a92a6] font-bold block uppercase">สต็อกในช่องนี้</span>
                    <span className="text-lg font-black font-mono text-teal-600">{selectedBin.totalStock.toLocaleString()} ชิ้น</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8a92a6] font-bold block uppercase">ความถี่หมุนเวียน (ABC)</span>
                    <span className="text-lg font-black font-mono text-[#dee2ec]">Class {selectedBin.velocityClass}</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <span className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider block">
                    รายการสินค้าในช่องนี้ ({selectedBin.products.length} รายการ):
                  </span>

                  {selectedBin.products.length === 0 ? (
                    <div className="p-4 bg-[#1b2027] rounded-xl text-center text-[#8a92a6] text-xs">
                      ไม่มีสินค้าในช่องนี้ (ช่องว่างพร้อมจัดเก็บ)
                    </div>
                  ) : (
                    selectedBin.products.map(p => (
                      <div
                        key={p.id}
                        className="p-3 bg-[#1b2027] rounded-xl border border-[#30353d] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#dee2ec] truncate">{p.name}</div>
                          <div className="text-[11px] text-[#8a92a6] flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{p.id}</span>
                            <span>•</span>
                            <span className="font-mono text-orange-500 font-bold">Class {p.velocityClass}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right font-mono">
                            <span className={cn('text-sm font-black', p.totalStock <= p.minStock ? 'text-amber-500' : 'text-[#dee2ec]')}>
                              {p.stock.toLocaleString()} {p.unit}
                            </span>
                            <span className="block text-[10px] text-[#8a92a6]">
                              รวมทุกช่อง {p.totalStock.toLocaleString()} • Min {p.minStock}
                            </span>
                          </div>
                          <button
                            onClick={() => setSwapProduct({ id: p.id, name: p.name, sku: p.id, location: selectedBin.binCode, stock: p.stock })}
                            className="px-2 py-1 bg-[#1b2027] hover:bg-[#facc15] hover:text-[#1b1600] text-[#facc15] border border-[#facc15]/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                            title="สลับพิกัดสินค้านี้"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span>สลับที่</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-[#30353d] flex items-center justify-between">
                  <Link
                    href={`/barcode/thermal-labels?bin=${encodeURIComponent(selectedBin.binCode)}`}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> พิมพ์ป้ายพิกัด 100x50 mm
                  </Link>
                  <button
                    onClick={() => setSelectedBin(null)}
                    className="px-4 py-2 bg-[#252a32] hover:bg-[#30353d] text-[#d1c6ab] font-bold rounded-xl text-xs transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <WarehouseWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          branchId={branchId || 'MAIN'}
          branchName={layout?.name || 'คลังสินค้าหลัก'}
          onApplyLayout={handleApplyWizard}
        />

        <WarehouseBatchLabelModal
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
          branchName={layout?.name || 'คลังสินค้าหลัก'}
          bins={allBinsList}
        />

        <LocationSwapModal
          isOpen={!!swapProduct}
          onClose={() => setSwapProduct(null)}
          sourceProduct={swapProduct}
          allProducts={products}
          onSwapSuccess={() => {
            fetchData();
            setSelectedBin(null);
          }}
        />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-3 h-3 rounded', color)} />
      <span>{label}</span>
    </div>
  );
}
