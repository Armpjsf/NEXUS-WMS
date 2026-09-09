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
  XCircle,
  HelpCircle,
  ExternalLink,
  Flame,
  Activity,
  Printer,
  ChevronRight,
  X,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/db';
import {
  buildWarehouseMap,
  WarehouseZone,
  WarehouseBin,
  WarehouseRack,
  WarehouseMapStats,
} from '@/lib/warehouseMap';

export default function WarehouseMapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 font-bold text-sm flex items-center gap-2">
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBin, setSelectedBin] = useState<WarehouseBin | null>(null);

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
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 bg-slate-50">
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[1.75rem] border border-teal-200 bg-white/90 p-6 shadow-xl shadow-teal-900/5 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/inventory"
                className="p-3 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 text-teal-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
                  <LayoutGrid className="w-8 h-8 text-teal-600" />
                  2D Warehouse Interactive Map
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  ผังคลังสินค้าจำลองเสมือนจริง • แผนผังชั้นวาง (Zone & Rack Heatmap) • จัดสรรพิกัดอัตโนมัติจากสต็อกจริง
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/slotting"
                className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                คำแนะนำ ABC Slotting
              </Link>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-all"
                title="รีเฟรชข้อมูลผัง"
              >
                <RefreshCw className={cn('w-4 h-4 text-teal-600', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </header>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                สต็อกจริงในคลัง
              </span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {stats.totalWarehouseStock.toLocaleString()} ชิ้น
              </span>
              <span className="text-[10px] text-teal-600 block font-bold">
                ({products.length} รายการสินค้า)
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                อัตราการใช้งาน (Occupancy)
              </span>
              <span className="text-lg font-black text-emerald-600 font-mono">
                {stats.occupancyRate}%
              </span>
              <span className="text-[10px] text-slate-500 block">
                {stats.occupiedBins} จาก {stats.totalBins} ช่อง
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                สต็อกเหลือน้อย
              </span>
              <span className="text-lg font-black text-amber-600 font-mono">
                {stats.lowStockBins} ช่อง
              </span>
              <span className="text-[10px] text-slate-500 block">ต่ำกว่าจุด Safety Stock</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
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
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
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
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  )}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {z.name}
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono',
                      isSelected ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-600'
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
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา SKU หรือชื่อสินค้าเพื่อชี้เป้า..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-teal-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Heatmap Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setHeatmapMode('STOCK')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                  heatmapMode === 'STOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                <Layers className="w-3.5 h-3.5" /> ระดับสต็อก
              </button>
              <button
                onClick={() => setHeatmapMode('VELOCITY')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                  heatmapMode === 'VELOCITY' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'
                )}
              >
                <Flame className="w-3.5 h-3.5" /> ABC หมุนเวียน
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-2 text-xs text-slate-600">
          <span className="font-bold text-slate-700">สัญลักษณ์สี:</span>
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

        {/* 2D Interactive Warehouse Floor Layout */}
        <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 text-white min-h-[500px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-black flex items-center gap-2 text-teal-400">
                <MapPin className="w-5 h-5" />
                {activeZone?.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                คลิกที่ชั้นวาง (Rack / Bin) เพื่อดูสต็อกสินค้าและรายละเอียดภายในช่อง
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">จำนวนสต็อกในโซนนี้:</span>
              <span className="text-xl font-mono font-black text-teal-300">
                {activeZone?.totalStock.toLocaleString()} ชิ้น
              </span>
            </div>
          </div>

          {/* Aisles & Racks Grid */}
          <div className="space-y-8">
            {activeZone?.aisles.map(aisle => (
              <div key={aisle.aisleNumber} className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-1 font-mono">
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
                            badgeColor = 'bg-amber-500 text-slate-950';
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
                            badgeColor = 'bg-amber-500 text-slate-950';
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
                                <span className="text-slate-500 italic">ช่องว่าง</span>
                              ) : (
                                <div className="truncate text-slate-300">
                                  <span className="font-bold">{bin.products[0].name}</span>
                                  {bin.products.length > 1 && (
                                    <span className="text-slate-400 ml-1">
                                      (+{bin.products.length - 1})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
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
                className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-900 font-mono">
                        พิกัด: {selectedBin.binCode}
                      </h3>
                      <p className="text-xs text-slate-500">
                        โซน {selectedBin.zone} • ซอย {selectedBin.aisle} • แร็ค {selectedBin.rack}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBin(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      จำนวนสต็อกรวม
                    </span>
                    <span className="text-lg font-black font-mono text-teal-600">
                      {selectedBin.totalStock.toLocaleString()} ชิ้น
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      ความถี่หมุนเวียน (ABC)
                    </span>
                    <span className="text-lg font-black font-mono text-slate-800">
                      Class {selectedBin.dominantVelocityClass}
                    </span>
                  </div>
                </div>

                {/* Products List in this Bin */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    รายการสินค้าในช่องนี้ ({selectedBin.products.length} รายการ):
                  </span>

                  {selectedBin.products.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                      ไม่มีสินค้าในช่องนี้ (ช่องว่างพร้อมจัดเก็บ)
                    </div>
                  ) : (
                    selectedBin.products.map(p => (
                      <div
                        key={p.id}
                        className="p-3 bg-slate-50 hover:bg-teal-50/50 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>หมวด: {p.category}</span>
                            <span>•</span>
                            <span className="font-mono text-orange-600 font-bold">
                              ABC: Class {p.velocityClass}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span
                            className={cn(
                              'text-sm font-black',
                              p.stock <= p.minStock ? 'text-amber-600' : 'text-slate-900'
                            )}
                          >
                            {p.stock.toLocaleString()} {p.unit}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Min: {p.minStock}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/barcode/thermal-labels?bin=${selectedBin.binCode}`}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> พิมพ์ป้ายพิกัด 100x50 mm
                  </Link>
                  <button
                    onClick={() => setSelectedBin(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
