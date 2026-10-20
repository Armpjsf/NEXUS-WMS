'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
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
  WarehouseBin,
} from '@/lib/warehouseMap';
import Warehouse3DViewer from '@/components/warehouse/Warehouse3DViewer';
import WarehouseWizardModal from '@/components/warehouse/WarehouseWizardModal';
import WarehouseBatchLabelModal from '@/components/warehouse/WarehouseBatchLabelModal';
import { toast } from 'react-hot-toast';

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

function WarehouseMapContent() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get('branchId') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View Controls
  const [selectedZoneId, setSelectedZoneId] = useState<string>('A');
  const [heatmapMode, setHeatmapMode] = useState<'STOCK' | 'VELOCITY'>('STOCK');
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [layout3D, setLayout3D] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBin, setSelectedBin] = useState<WarehouseBin | null>(null);
  const [swapProduct, setSwapProduct] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [generatedBinsList, setGeneratedBinsList] = useState<string[]>([]);

  // Compute all bin codes for label printing
  const allBinsList = useMemo(() => {
    if (generatedBinsList.length > 0) return generatedBinsList;
    if (!layout3D?.racks) return [];
    const list: string[] = [];
    layout3D.racks.forEach((rack: any) => {
      for (let bay = 1; bay <= (rack.bays || 5); bay++) {
        for (let lvl = 1; lvl <= (rack.levels || 4); lvl++) {
          list.push(`${rack.zoneCode}-${String(rack.rackCode).replace(/^[A-Z]-/, '')}-${String(bay).padStart(2, '0')}-${String(lvl).padStart(2, '0')}`.toUpperCase());
        }
      }
    });
    return list;
  }, [layout3D, generatedBinsList]);

  // Save current 3D layout to API
  const handleSaveLayout = async () => {
    if (!layout3D) return;
    setIsSavingLayout(true);
    try {
      const res = await fetch(getApiUrl('/api/warehouse/layout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId || 'MAIN',
          name: layout3D.name || 'คลังสินค้าหลัก',
          widthM: layout3D.widthM || 60,
          lengthM: layout3D.lengthM || 80,
          heightM: layout3D.heightM || 12,
          racks: layout3D.racks || [],
        }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success('บันทึกผังคลังสินค้า 3D สำเร็จเรียบร้อยแล้ว');
      } else {
        toast.error(data?.error || 'ไม่สามารถบันทึกผังคลังได้');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSavingLayout(false);
    }
  };

  // Apply Wizard layout
  const handleApplyWizard = async (newLayout: any, bins: string[]) => {
    setLayout3D(newLayout);
    setGeneratedBinsList(bins);
    setIsSavingLayout(true);
    try {
      const res = await fetch(getApiUrl('/api/warehouse/layout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLayout),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(`สร้างผังคลัง 3D สำเร็จ! รวมความจุ ${bins.length.toLocaleString()} โลเคชัน`);
      }
    } catch {
      toast.error('ไม่สามารถบันทึกผังคลังได้');
    } finally {
      setIsSavingLayout(false);
    }
  };

  // Fetch Real Products and Transactions from API / Cache
  const fetchData = async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const prodUrl = getApiUrl(`/api/products${branchId ? `?branchId=${branchId}` : ''}`);
        const transUrl = getApiUrl(`/api/transactions?limit=500${branchId ? `&branchId=${branchId}` : ''}`);

        const [prodRes, transRes] = await Promise.all([
          fetch(prodUrl).catch(() => null),
          fetch(transUrl).catch(() => null),
        ]);

        if (prodRes && prodRes.ok) {
          const prodData = await prodRes.json();
          if (Array.isArray(prodData) && prodData.length > 0) {
            setProducts(prodData);
          } else {
            const cached = await db.products.toArray();
            if (cached.length > 0) setProducts(cached);
          }
        } else {
          const cached = await db.products.toArray();
          if (cached.length > 0) setProducts(cached);
        }

        if (transRes && transRes.ok) {
          const transData = await transRes.json();
          if (transData?.transactions && Array.isArray(transData.transactions)) {
            setTransactions(transData.transactions);
          }
        }
      } else {
        const cached = await db.products.toArray();
        if (cached.length > 0) setProducts(cached);
      }
    } catch (e) {
      console.error('Failed to load map data:', e);
      const cached = await db.products.toArray();
      if (cached.length > 0) setProducts(cached);
    } finally {
              const layoutUrl = getApiUrl('/api/warehouse/layout?branchId=' + (branchId || 'MAIN'));
        fetch(layoutUrl).then(r => r.json()).then(res => {
          if (res?.success && res.data) setLayout3D(res.data);
        }).catch(() => {});
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branchId]);

  // Compute Warehouse Map Data
  const { zones, unassignedProducts, stats } = useMemo(() => {
    return buildWarehouseMap(products, transactions);
  }, [products, transactions]);

  // Set default zone if available
  useEffect(() => {
    if (zones.length > 0 && !zones.some(z => z.zoneId === selectedZoneId)) {
      setSelectedZoneId(zones[0].zoneId);
    }
  }, [zones, selectedZoneId]);

  const activeZone = useMemo(() => {
    return zones.find(z => z.zoneId === selectedZoneId) || zones[0];
  }, [zones, selectedZoneId]);

  // Highlight matches from Search
  const matchingBinCodes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const matched = new Set<string>();

    zones.forEach(z => {
      z.aisles.forEach(a => {
        a.racks.forEach(r => {
          r.bins.forEach(b => {
            if (
              b.binCode.toLowerCase().includes(q) ||
              b.products.some(
                p =>
                  p.name.toLowerCase().includes(q) ||
                  p.id.toLowerCase().includes(q) ||
                  p.category.toLowerCase().includes(q)
              )
            ) {
              matched.add(b.binCode);
            }
          });
        });
      });
    });

    return matched;
  }, [zones, searchQuery]);

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
                  2D Warehouse Interactive Map
                </h1>
                <p className="text-sm text-[#8a92a6] mt-0.5">
                  ผังคลังสินค้าจำลองเสมือนจริง • แผนผังชั้นวาง (Zone & Rack Heatmap) • จัดสรรพิกัดอัตโนมัติจากสต็อกจริง
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/slotting"
                className="px-3.5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                คำแนะนำ ABC Slotting
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

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-teal-500/10 text-teal-600 rounded-xl border border-teal-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">
                สต็อกจริงในคลัง
              </span>
              <span className="text-lg font-black text-[#dee2ec] font-mono">
                {stats.totalWarehouseStock.toLocaleString()} ชิ้น
              </span>
              <span className="text-[10px] text-teal-600 block font-bold">
                ({products.length} รายการสินค้า)
              </span>
            </div>
          </div>

          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">
                อัตราการใช้งาน (Occupancy)
              </span>
              <span className="text-lg font-black text-emerald-600 font-mono">
                {stats.occupancyRate}%
              </span>
              <span className="text-[10px] text-[#8a92a6] block">
                {stats.occupiedBins} จาก {stats.totalBins} ช่อง
              </span>
            </div>
          </div>

          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">
                สต็อกเหลือน้อย
              </span>
              <span className="text-lg font-black text-amber-600 font-mono">
                {stats.lowStockBins} ช่อง
              </span>
              <span className="text-[10px] text-[#8a92a6] block">ต่ำกว่าจุด Safety Stock</span>
            </div>
          </div>

          <div className="bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8a92a6] font-bold uppercase tracking-wider block">
                พื้นที่จัดสรร
              </span>
              <span className="text-lg font-black text-blue-600 font-mono">
                {zones.length} โซน • {stats.totalRacks} แร็ค
              </span>
              <span className="text-[10px] text-blue-600 block font-bold">จัดเรียงตาม ABC หมุนเวียน</span>
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm">
          {/* Zone Selector Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {zones.map(z => {
              const isSelected = z.zoneId === selectedZoneId;
              return (
                <button
                  key={z.zoneId}
                  onClick={() => setSelectedZoneId(z.zoneId)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap',
                    isSelected
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                      : 'bg-[#252a32] hover:bg-[#30353d] text-[#d1c6ab]'
                  )}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {z.name}
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono',
                      isSelected ? 'bg-teal-700 text-teal-100' : 'bg-[#30353d] text-[#d1c6ab]'
                    )}
                  >
                    {z.totalStock.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search SKU and Heatmap Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-[#8a92a6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา SKU หรือชื่อสินค้าเพื่อชี้เป้า..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl text-xs outline-none focus:border-teal-500 focus:bg-[#171c23] transition-colors"
              />
            </div>

                        {/* View Mode 3D / 2D Toggle */}
            <div className="flex items-center bg-[#252a32] p-1 rounded-xl border border-[#30353d]">
              <button
                onClick={() => setViewMode('3D')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  viewMode === '3D' ? 'bg-[#facc15] text-[#1b1600] shadow-md shadow-[#facc15]/20 font-black' : 'text-[#8a92a6]'
                )}
              >
                <Box className="w-3.5 h-3.5" /> 3D Digital Twin
              </button>
              <button
                onClick={() => setViewMode('2D')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  viewMode === '2D' ? 'bg-[#171c23] text-[#dee2ec] shadow-sm' : 'text-[#8a92a6]'
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> 2D ผังแบน
              </button>
            </div>

            {/* Heatmap Toggle */}
            <div className="flex items-center bg-[#252a32] p-1 rounded-xl border border-[#30353d]">
              <button
                onClick={() => setHeatmapMode('STOCK')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                  heatmapMode === 'STOCK' ? 'bg-[#171c23] text-[#dee2ec] shadow-sm' : 'text-[#8a92a6]'
                )}
              >
                <Layers className="w-3.5 h-3.5" /> ระดับสต็อก
              </button>
              <button
                onClick={() => setHeatmapMode('VELOCITY')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                  heatmapMode === 'VELOCITY' ? 'bg-orange-500 text-white shadow-sm' : 'text-[#8a92a6]'
                )}
              >
                <Flame className="w-3.5 h-3.5" /> ABC หมุนเวียน
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-2 text-xs text-[#d1c6ab]">
          <span className="font-bold text-[#d1c6ab]">สัญลักษณ์สี:</span>
          {heatmapMode === 'STOCK' ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span>สต็อกปกติ (Normal)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>สต็อกต่ำ (Low Stock)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-rose-500" />
                <span>สต็อกหมด (Empty)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-300" />
                <span>ช่องว่างพร้อมเก็บ</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>Class A (Fast Moving หยิบบ่อยมาก)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Class B (Medium Moving หยิบปานกลาง)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Class C (Slow Moving)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-400" />
                <span>Class D (Deadstock ไม่เคลื่อนไหว)</span>
              </div>
            </>
          )}
        </div>

                {/* 3D Visual Warehouse Digital Twin */}
        {viewMode === '3D' && layout3D && (
          <Warehouse3DViewer
            layout={layout3D}
            products={products}
            heatmapMode={heatmapMode === 'VELOCITY' ? 'VELOCITY' : 'STOCK'}
            branchName={layout3D.name || 'คลังสินค้าหลัก'}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
            onOpenWizard={() => setIsWizardOpen(true)}
            onOpenLabelModal={() => setIsLabelModalOpen(true)}
            onSaveLayout={handleSaveLayout}
            isSaving={isSavingLayout}
            onUpdateLayout={(newLayout) => setLayout3D(newLayout)}
            onSelectBin={(binCode, binData) => {
              // Open modal if bin found
              const foundBin = zones.flatMap(z => z.aisles).flatMap(a => a.racks).flatMap(r => r.bins).find(b => b.binCode === binCode);
              if (foundBin) setSelectedBin(foundBin);
            }}
          />
        )}

        {/* 2D Interactive Warehouse Floor Layout */}
        <div className={cn("bg-[#171c23] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#30353d] text-[#dee2ec] min-h-[500px]", viewMode === '3D' && 'hidden')}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 text-teal-400">
                <MapPin className="w-5 h-5" />
                {activeZone?.name}
              </h2>
              <p className="text-xs text-[#8a92a6] mt-0.5">
                คลิกที่ชั้นวาง (Rack / Bin) เพื่อดูสต็อกสินค้าและรายละเอียดภายในช่อง
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#8a92a6] block">จำนวนสต็อกในโซนนี้:</span>
              <span className="text-xl font-mono font-black text-teal-300">
                {activeZone?.totalStock.toLocaleString()} ชิ้น
              </span>
            </div>
          </div>

          {/* Aisles & Racks Grid */}
          <div className="space-y-8">
            {activeZone?.aisles.map(aisle => (
              <div key={aisle.aisleNumber} className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#8a92a6] border-b border-slate-800/80 pb-1 font-mono">
                  <span className="bg-slate-800 px-3 py-1 rounded-md font-bold text-slate-300">
                    ทางเดินซอย (Aisle {aisle.aisleNumber})
                  </span>
                  <span>
                    {aisle.racks.length} แร็ค • สต็อกรวม {aisle.totalStock.toLocaleString()}
                  </span>
                </div>

                {/* Racks Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {aisle.racks.map(rack => (
                    <div key={rack.rackNumber} className="space-y-2">
                      {rack.bins.map(bin => {
                        const isMatched = matchingBinCodes.has(bin.binCode);
                        const isSelected = selectedBin?.binCode === bin.binCode;

                        // Color coding
                        let bgClass = 'bg-slate-800/90 border-slate-700';
                        let badgeColor = 'bg-slate-700 text-slate-300';

                        if (heatmapMode === 'STOCK') {
                          if (bin.totalStock === 0 && bin.products.length > 0) {
                            bgClass = 'bg-rose-950/80 border-rose-600 text-rose-200';
                            badgeColor = 'bg-rose-600 text-white';
                          } else if (bin.status === 'LOW_STOCK') {
                            bgClass = 'bg-amber-950/80 border-amber-600 text-amber-200';
                            badgeColor = 'bg-amber-500 text-[#dee2ec]';
                          } else if (bin.totalStock > 0) {
                            bgClass = 'bg-emerald-950/80 border-emerald-600 text-emerald-200';
                            badgeColor = 'bg-emerald-600 text-white';
                          }
                        } else {
                          // Velocity Heatmap
                          if (bin.dominantVelocityClass === 'A') {
                            bgClass = 'bg-red-950/80 border-red-500 text-red-200';
                            badgeColor = 'bg-red-500 text-white';
                          } else if (bin.dominantVelocityClass === 'B') {
                            bgClass = 'bg-amber-950/80 border-amber-500 text-amber-200';
                            badgeColor = 'bg-amber-500 text-[#dee2ec]';
                          } else if (bin.dominantVelocityClass === 'C') {
                            bgClass = 'bg-blue-950/80 border-blue-500 text-blue-200';
                            badgeColor = 'bg-blue-600 text-white';
                          }
                        }

                        return (
                          <motion.button
                            key={bin.binCode}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedBin(bin)}
                            className={cn(
                              'w-full p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[90px]',
                              bgClass,
                              isMatched && 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30 scale-[1.03]',
                              isSelected && 'ring-2 ring-teal-400 bg-slate-800'
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-mono font-black text-xs text-white">
                                {bin.binCode}
                              </span>
                              <span
                                className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px] font-mono font-black',
                                  badgeColor
                                )}
                              >
                                {heatmapMode === 'VELOCITY'
                                  ? `Class ${bin.dominantVelocityClass}`
                                  : `${bin.totalStock} ชิ้น`}
                              </span>
                            </div>

                            <div className="mt-2 text-[11px] truncate w-full">
                              {bin.products.length === 0 ? (
                                <span className="text-[#8a92a6] italic">ช่องว่าง</span>
                              ) : (
                                <div className="truncate text-slate-300">
                                  <span className="font-bold">{bin.products[0].name}</span>
                                  {bin.products.length > 1 && (
                                    <span className="text-[#8a92a6] ml-1">
                                      (+{bin.products.length - 1})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-[#8a92a6] mt-1">
                              <span className="font-mono">{bin.products.length} SKUs</span>
                              {isMatched && (
                                <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                                  <Sparkles className="w-3 h-3" /> พบสินค้า
                                </span>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Bin Details Drawer Modal */}
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
                      <h3 className="font-black text-lg text-[#dee2ec] font-mono">
                        พิกัด: {selectedBin.binCode}
                      </h3>
                      <p className="text-xs text-[#8a92a6]">
                        โซน {selectedBin.zone} • ซอย {selectedBin.aisle} • แร็ค {selectedBin.rack}
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
                    <span className="text-[10px] text-[#8a92a6] font-bold block uppercase">
                      จำนวนสต็อกรวม
                    </span>
                    <span className="text-lg font-black font-mono text-teal-600">
                      {selectedBin.totalStock.toLocaleString()} ชิ้น
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8a92a6] font-bold block uppercase">
                      ความถี่หมุนเวียน (ABC)
                    </span>
                    <span className="text-lg font-black font-mono text-[#dee2ec]">
                      Class {selectedBin.dominantVelocityClass}
                    </span>
                  </div>
                </div>

                {/* Products List in this Bin */}
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
                        className="p-3 bg-[#1b2027] hover:bg-teal-500/10/50 rounded-xl border border-[#30353d] flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-[#dee2ec]">{p.name}</div>
                          <div className="text-[11px] text-[#8a92a6] flex items-center gap-2 mt-0.5">
                            <span>หมวด: {p.category}</span>
                            <span>•</span>
                            <span className="font-mono text-orange-600 font-bold">
                              ABC: Class {p.velocityClass}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono">
                            <span
                              className={cn(
                                'text-sm font-black',
                                p.stock <= p.minStock ? 'text-amber-600' : 'text-[#dee2ec]'
                              )}
                            >
                              {p.stock.toLocaleString()} {p.unit}
                            </span>
                            <span className="block text-[10px] text-[#8a92a6]">
                              Min: {p.minStock}
                            </span>
                          </div>
                          <button
                            onClick={() => setSwapProduct({ id: p.id, name: p.name, sku: (p as any).sku || p.id, location: selectedBin.binCode, stock: p.stock })}
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
                    href={`/barcode/thermal-labels?bin=${selectedBin.binCode}`}
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

        {/* 1-Click Location Swap Modal */}
        <WarehouseWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          branchId={branchId || 'MAIN'}
          branchName={layout3D?.name || 'คลังสินค้าหลัก'}
          onApplyLayout={handleApplyWizard}
        />

        <WarehouseBatchLabelModal
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
          branchName={layout3D?.name || 'คลังสินค้าหลัก'}
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
