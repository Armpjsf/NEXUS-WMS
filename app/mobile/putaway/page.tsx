'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Scan,
  MapPin,
  CheckCircle2,
  Package,
  Layers,
  Search,
  Volume2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import BinQuickSelect from '@/components/stock/BinQuickSelect';
import { speakPutawayLocation, triggerHaptic } from '@/lib/voiceAssistant';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { errorMessage } from '@/lib/errors';

interface PutawayTask {
  id: string;
  task_type: string;
  priority: number;
  product_name?: string;
  sku?: string;
  requested_qty?: number;
  source_location?: string;
  target_location?: string;
  status?: string;
}

interface RecommendationInfo {
  recommendedLocation: string;
  ruleApplied: string;
  reason: string;
  fromBin?: string;
  isCrossDock?: boolean;
}

export default function MobilePutawayPage() {
  const [step, setStep] = useState<'SCAN_ITEM' | 'CONFIRM_LOCATION' | 'DONE'>('SCAN_ITEM');
  const [products, setProducts] = useState<any[]>([]);
  const [putawayTasks, setPutawayTasks] = useState<PutawayTask[]>([]);
  const [loadingProds, setLoadingProds] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Product, Task & Bin state
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [fromBin, setFromBin] = useState('RCV-DOCK');
  const [targetBin, setTargetBin] = useState('');
  const [putawayQty, setPutawayQty] = useState<number>(1);
  const [lotNumber, setLotNumber] = useState('');
  const [recommendation, setRecommendation] = useState<RecommendationInfo | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  // Camera Scanner modal
  const [cameraMode, setCameraMode] = useState<'ITEM' | 'LOC' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadingProds(true);
      const [prodRes, taskRes] = await Promise.all([
        fetch(getApiUrl('/api/products'), { cache: 'no-store' }),
        fetch(getApiUrl('/api/tasks?type=PUTAWAY'), { cache: 'no-store' }),
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        if (Array.isArray(data)) setProducts(data);
      }

      if (taskRes.ok) {
        const tData = await taskRes.json();
        const pending = (tData.data || []).filter(
          (t: PutawayTask) => t.task_type === 'PUTAWAY' && t.status !== 'COMPLETED'
        );
        setPutawayTasks(pending);
      }
    } catch (err) {
      console.error('Failed to load putaway data:', err);
    } finally {
      setLoadingProds(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchSmartRecommendation = useCallback(async (sku: string, qty: number, preferredTarget?: string, preferredFrom?: string) => {
    setLoadingRec(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/putaway/recommend?sku=${encodeURIComponent(sku)}&qty=${encodeURIComponent(String(qty))}`),
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        const rec = json.data;
        if (rec) {
          setRecommendation(rec);
          if (!preferredFrom && (rec.fromBin || json.fromBin)) {
            setFromBin(rec.fromBin || json.fromBin);
          }
          if (!preferredTarget && rec.recommendedLocation) {
            setTargetBin(rec.recommendedLocation);
          }
        }
      }
    } catch (err) {
      console.warn('Putaway recommendation lookup failed:', err);
    } finally {
      setLoadingRec(false);
    }
  }, []);

  const handleSelectItem = (p: any, opts?: { taskId?: string; qty?: number; from?: string; to?: string }) => {
    const sku = p.sku || p.id || p.name;
    const initialQty = opts?.qty && opts.qty > 0 ? opts.qty : 1;
    const initialFrom = opts?.from || (p.location && p.location !== 'Unassigned' && p.location !== '-' ? p.location : 'RCV-DOCK');
    const initialTo =
      opts?.to && opts.to !== 'Unassigned' && opts.to !== '-'
        ? opts.to
        : p.location && p.location !== 'Unassigned' && p.location !== '-' && p.location !== 'RCV-DOCK'
          ? p.location
          : 'A-01-01';

    setSelectedProduct(p);
    setSelectedTaskId(opts?.taskId || null);
    setFromBin(initialFrom);
    setTargetBin(initialTo);
    setPutawayQty(initialQty);
    setRecommendation(null);
    setCameraMode(null);
    setStep('CONFIRM_LOCATION');
    triggerHaptic('success');
    toast.success(`เลือกสินค้า: ${p.name}`);

    fetchSmartRecommendation(sku, initialQty, opts?.to, opts?.from);
  };

  const handleSelectTask = (task: PutawayTask) => {
    const q = (task.sku || task.product_name || '').toLowerCase();
    const matchedProd = products.find(
      p =>
        (p.sku || '').toLowerCase() === q ||
        (p.id || '').toLowerCase() === q ||
        (p.name || '').toLowerCase() === q
    ) || {
      id: task.sku || task.product_name,
      sku: task.sku || task.product_name,
      name: task.product_name || task.sku || 'สินค้ารอจัดเก็บ',
      stock: task.requested_qty || 1,
      location: task.source_location || 'RCV-DOCK',
      unit: 'ชิ้น',
    };

    handleSelectItem(matchedProd, {
      taskId: task.id,
      qty: Number(task.requested_qty || 1),
      from: task.source_location || 'RCV-DOCK',
      to: task.target_location || undefined,
    });
  };

  const handleScanBarcode = (code: string) => {
    const q = code.trim().toLowerCase();
    if (step === 'SCAN_ITEM') {
      // Check pending putaway task first
      const taskMatch = putawayTasks.find(
        t => (t.sku || '').toLowerCase() === q || (t.product_name || '').toLowerCase() === q
      );
      if (taskMatch) {
        playScannerAudio('success');
        handleSelectTask(taskMatch);
        return;
      }

      const match = products.find(
        p =>
          (p.sku || '').toLowerCase() === q ||
          (p.id || '').toLowerCase() === q ||
          (p.barcode || '').toLowerCase() === q ||
          (p.name || '').toLowerCase() === q
      );
      if (match) {
        playScannerAudio('success');
        handleSelectItem(match);
      } else {
        playScannerAudio('error');
        triggerHaptic('error');
        toast.error(`ไม่พบสินค้ารหัส "${code}" ในระบบ`);
      }
    } else if (step === 'CONFIRM_LOCATION') {
      const scannedLoc = code.trim().toUpperCase();
      setTargetBin(scannedLoc);
      setCameraMode(null);
      playScannerAudio('success');
      triggerHaptic('success');
      speakPutawayLocation(scannedLoc);
      toast.success(`เลือกพิกัด: ${scannedLoc}`);
    }
  };

  usePdaScanner({
    onScan: handleScanBarcode,
    enabled: !cameraMode,
    playSound: false,
  });

  const handleConfirmPutaway = async () => {
    if (!selectedProduct) return;
    if (!targetBin.trim()) {
      toast.error('กรุณาระบุพิกัดจัดเก็บ (Bin)');
      return;
    }
    if (putawayQty <= 0) {
      toast.error('จำนวนจัดเก็บต้องมากกว่า 0');
      return;
    }

    setSubmitting(true);
    try {
      const sku = selectedProduct.sku || selectedProduct.id || selectedProduct.name;
      const res = await fetch(getApiUrl('/api/putaway/recommend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          fromBin: fromBin.trim() || 'RCV-DOCK',
          toBin: targetBin.trim().toUpperCase(),
          qty: putawayQty,
          taskId: selectedTaskId || undefined,
          lotNo: lotNumber.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ย้ายพิกัดจัดเก็บไม่สำเร็จ');
      }

      triggerHaptic('success');
      toast.success(`ย้ายพิกัด ${selectedProduct.name} → ${targetBin.toUpperCase()} เรียบร้อย!`);
      setStep('DONE');
      loadData();
    } catch (err) {
      triggerHaptic('error');
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการจัดเก็บ');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products
    .filter(p => {
      if (!searchQuery.trim()) return false;
      const q = searchQuery.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl px-4 py-3 border-b border-white/85 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <Link
            href="/mobile"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold tracking-wide flex items-center gap-2 text-slate-900 truncate">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <span className="truncate">จัดเก็บขึ้นชั้น (Putaway)</span>
          </h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all"
              title="รีเฟรชคิวงาน"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProds ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setCameraMode(step === 'SCAN_ITEM' ? 'ITEM' : 'LOC')}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-95 transition-all"
              title="เปิดกล้องสแกน"
            >
              <Scan className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {step === 'SCAN_ITEM' && (
          <div className="space-y-4">
            {/* Pending Putaway Tasks Queue */}
            <div className="nx-glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-slate-900 truncate">
                      คิวงานรอจัดเก็บขึ้นชั้น (Pending Putaway Queue)
                    </h3>
                    <p className="text-[11px] text-slate-600 truncate">
                      แตะเลือกรายการที่รับเข้าแล้วเพื่อย้ายจากจุดพักขึ้นชั้นวาง
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums shrink-0">
                  {putawayTasks.length} งาน
                </span>
              </div>

              {putawayTasks.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 text-center text-xs text-slate-500">
                  ไม่มีคิวงานค้างในระบบ — สามารถสแกนหรือค้นหาสินค้าด้านล่างเพื่อย้ายช่องจัดเก็บได้ทันที
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {putawayTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleSelectTask(task)}
                      className="w-full min-h-[48px] text-left p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 active:scale-[0.99] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {task.product_name || task.sku}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5 mt-0.5 tabular-nums">
                          <span>{task.source_location || 'RCV-DOCK'}</span>
                          <ArrowRight className="w-3 h-3 text-emerald-600" />
                          <span className="font-bold text-emerald-700">{task.target_location || 'AI แนะนำ'}</span>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold font-mono tabular-nums shrink-0">
                        {task.requested_qty || 1} ชิ้น
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="nx-glass-card p-5 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <Package className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">ขั้นตอนที่ 1: สแกนหรือเลือกสินค้า</h2>
                <p className="text-xs text-slate-600 mt-1">
                  ยิงบาร์โค้ดสินค้าที่ต้องการย้ายขึ้นชั้นวาง (ย้าย Bin โดยไม่บวกสต็อกซ้ำ)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCameraMode('ITEM')}
                className="w-full min-h-[48px] py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Scan className="w-5 h-5" />
                <span>เปิดกล้องสแกนบาร์โค้ดสินค้า</span>
              </button>
            </div>

            {/* Manual Search Box */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาชื่อ หรือ SKU สินค้า..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-white/90 border border-slate-200/80 rounded-full text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>

              {/* Search Results */}
              {filteredProducts.length > 0 && (
                <div className="nx-glass-card divide-y divide-slate-200/70 overflow-hidden">
                  {filteredProducts.map(p => (
                    <div
                      key={p.id || p.sku || p.name}
                      onClick={() => handleSelectItem(p)}
                      className="p-3.5 hover:bg-emerald-50/50 cursor-pointer flex items-center justify-between transition-colors min-h-[48px]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                          <span>SKU: {p.sku || p.id}</span>
                          {p.location && (
                            <span className="flex items-center gap-0.5 text-emerald-700 font-semibold">
                              <MapPin className="w-3 h-3" /> {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-700 tabular-nums shrink-0">
                        {p.stock ?? 0} {p.unit || 'ชิ้น'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'CONFIRM_LOCATION' && selectedProduct && (
          <div className="space-y-4">
            {/* Selected Product Banner */}
            <div className="nx-glass-card p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                สินค้าที่กำลังจัดเก็บขึ้นชั้น (Relocate Bin):
              </span>
              <div className="text-base font-black text-slate-900 leading-tight">
                {selectedProduct.name}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span className="font-mono">SKU: {selectedProduct.sku || selectedProduct.id}</span>
                <span className="tabular-nums">
                  สต็อกรวมคงเดิม:{' '}
                  <strong className="text-slate-900 font-mono font-black">
                    {selectedProduct.stock ?? 0}
                  </strong>{' '}
                  {selectedProduct.unit || 'ชิ้น'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70 text-xs">
                <span className="text-slate-600 font-medium">ย้ายจากพิกัดต้นทาง:</span>
                <input
                  type="text"
                  value={fromBin}
                  onChange={e => setFromBin(e.target.value.toUpperCase())}
                  className="px-3 py-1.5 rounded-full bg-white/90 border border-slate-200 font-mono font-bold text-slate-900 text-xs w-32 uppercase text-center"
                />
              </div>
            </div>

            {/* AI Putaway Recommendation Banner */}
            {(loadingRec || recommendation) && (
              <div className="nx-glass-card p-3.5 bg-emerald-50/90 border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    AI แนะนำพิกัดจัดเก็บ (Directed Putaway)
                  </span>
                  {recommendation?.recommendedLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetBin(recommendation.recommendedLocation);
                        speakPutawayLocation(recommendation.recommendedLocation);
                      }}
                      className="px-3 py-1 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold shadow-xs active:scale-95"
                    >
                      ใช้ {recommendation.recommendedLocation}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {loadingRec ? 'กำลังคำนวณพิกัดที่เหมาะสม...' : recommendation?.reason}
                </p>
              </div>
            )}

            {/* Putaway Bin Selection Section (Dark Accent Readout Card) */}
            <div className="nx-dark-accent-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-emerald-300" />
                  <span>พิกัดจัดเก็บปลายทาง (Target Bin):</span>
                </div>
                <button
                  type="button"
                  onClick={() => speakPutawayLocation(targetBin || 'A-01')}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full bg-white/10 border border-white/15 text-emerald-300 hover:bg-white/20"
                  title="ฟังเสียงพิกัด"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Big Bin Readout & Manual Override */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={targetBin}
                  onChange={e => setTargetBin(e.target.value.toUpperCase())}
                  placeholder="เช่น A-01-01"
                  className="flex-1 min-h-[52px] px-4 py-3 text-center text-2xl font-black font-mono tracking-wider bg-white/10 border border-white/20 rounded-2xl text-amber-300 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 uppercase tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setCameraMode('LOC')}
                  className="min-h-[52px] min-w-[52px] p-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center active:scale-95 shadow-md"
                  title="สแกนบาร์โค้ดชั้นวาง"
                >
                  <Scan className="w-5 h-5" />
                </button>
              </div>

              {/* BinQuickSelect for Consolidation or picking existing bin */}
              <div className="p-3 rounded-2xl bg-white/95 text-slate-900">
                <BinQuickSelect
                  sku={selectedProduct.sku || selectedProduct.id}
                  selectedBin={targetBin}
                  onSelectBin={bin => {
                    setTargetBin(bin);
                    speakPutawayLocation(bin);
                  }}
                  mode="putaway"
                  theme="light"
                  label="พิกัดที่มีสินค้านี้อยู่แล้ว (แตะเพื่อรวมกอง Consolidation):"
                />
              </div>
            </div>

            {/* Quantity to Putaway */}
            <div className="nx-glass-card p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                จำนวนที่ย้ายขึ้นชั้นวาง ({selectedProduct.unit || 'ชิ้น'}):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPutawayQty(Math.max(1, putawayQty - 1))}
                  className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-lg text-slate-700 flex items-center justify-center active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={putawayQty}
                  onChange={e => setPutawayQty(Math.max(1, Number(e.target.value) || 1))}
                  className="flex-1 h-12 py-2 text-center text-xl font-black font-mono bg-white/90 border border-slate-200 rounded-2xl text-slate-900 tabular-nums focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setPutawayQty(putawayQty + 1)}
                  className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-black text-lg text-emerald-700 flex items-center justify-center active:scale-95"
                >
                  +
                </button>
              </div>

              {/* Quick increment buttons */}
              <div className="flex gap-2">
                {[5, 10, 20, 50].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPutawayQty(prev => prev + amt)}
                    className="flex-1 min-h-[40px] py-1.5 rounded-full bg-white/90 border border-slate-200 hover:bg-slate-100 text-xs font-bold font-mono text-slate-700 tabular-nums"
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Optional Lot No */}
              <div className="pt-2 border-t border-slate-200/70">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  เลข Lot / Batch (ถ้ามี):
                </label>
                <input
                  type="text"
                  placeholder="เช่น LOT-2026-09"
                  value={lotNumber}
                  onChange={e => setLotNumber(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs font-mono bg-white/90 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setStep('SCAN_ITEM')}
                className="w-1/3 min-h-[48px] py-3 bg-white/90 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-full font-bold text-xs active:scale-95 transition-all"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={handleConfirmPutaway}
                disabled={submitting}
                className="flex-1 min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันจัดเก็บขึ้นพิกัด</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'DONE' && selectedProduct && (
          <div className="nx-glass-card mt-6 p-6 border-2 border-emerald-200 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-slate-900">จัดเก็บสินค้าขึ้นชั้นสำเร็จ!</div>
              <p className="text-xs text-slate-600">
                ย้ายสินค้าจากพิกัดพักสินค้าเข้าสู่ชั้นวางเรียบร้อยแล้ว โดยไม่นับสต็อกซ้ำ
              </p>
            </div>

            <div className="p-4 bg-white/85 rounded-2xl border border-slate-200/80 text-left text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">สินค้า:</span>
                <span className="font-bold text-slate-900 truncate">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">ย้ายจากพิกัด:</span>
                <span className="font-mono font-bold text-slate-700">{fromBin}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">พิกัดจัดเก็บ (Bin):</span>
                <span className="font-mono font-black text-emerald-700 text-sm">{targetBin}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">จำนวนที่จัดเก็บ:</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {putawayQty} {selectedProduct.unit || 'ชิ้น'}
                </span>
              </div>
              {lotNumber && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Lot:</span>
                  <span className="font-mono text-slate-700">{lotNumber}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setStep('SCAN_ITEM');
                setSelectedProduct(null);
                setSelectedTaskId(null);
                setTargetBin('');
                setPutawayQty(1);
                setLotNumber('');
                setSearchQuery('');
              }}
              className="w-full min-h-[48px] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              จัดเก็บชิ้นถัดไป
            </button>
          </div>
        )}
      </div>

      {cameraMode && (
        <CameraScannerModal
          isOpen={!!cameraMode}
          onClose={() => setCameraMode(null)}
          onScan={handleScanBarcode}
          title={cameraMode === 'ITEM' ? 'สแกนบาร์โค้ดสินค้า' : 'สแกนบาร์โค้ดพิกัดชั้นวาง (Bin)'}
          description={
            cameraMode === 'ITEM'
              ? 'เล็งกล้องไปที่บาร์โค้ดหรือ QR Code สินค้า'
              : 'เล็งกล้องไปที่ป้ายพิกัดช่องหรือเชลฟ์'
          }
        />
      )}

      <MobileNav />
    </div>
  );
}
