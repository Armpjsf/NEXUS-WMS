'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Printer,
  Sparkles,
  Barcode,
  Plus,
  Play,
  RotateCcw,
  Layers,
  MapPin,
  Trash2,
  Search,
  Volume2,
  VolumeX,
  Eye,
  Camera,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';
import {
  calculateSShapePickPath,
  generateWaveNumber,
  calculateWaveStats,
  PickWaveItem,
  PickingWave,
  parseLocation,
  buildFefoPickWaveItems,
} from '@/lib/picking';
import { speakPickInstruction, speakThai, triggerHaptic, speakScanSuccess, speakScanMismatch } from '@/lib/voiceAssistant';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';
import BinQuickSelect from '@/components/stock/BinQuickSelect';
import { errorMessage } from '@/lib/errors';

export default function WavePickingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWave, setActiveWave] = useState<PickingWave | null>(null);

  // Settings: Voice Assistant & Forklift Mode
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [forkliftMode, setForkliftMode] = useState(false);

  // New Wave Form State
  const [isCreatingWave, setIsCreatingWave] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Array<{ sku: string; qty: number; orderRef?: string; orderId?: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerName, setPickerName] = useState('Warehouse Operator');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isCompletingWave, setIsCompletingWave] = useState(false);

  // Fast Scan Bar State
  const [scanInput, setScanInput] = useState('');
  const [showWaveScanCam, setShowWaveScanCam] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Load Products
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/products'));
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to load products:', e);
      toast.error('โหลดข้อมูลสินค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Load Pending Orders
  const loadPendingOrders = async (): Promise<any[]> => {
    try {
      const res = await fetch(getApiUrl('/api/orders?limit=100'));
      if (res.ok) {
        const data = await res.json();
        const allOrders = data.orders || [];
        const pending = allOrders.filter((o: any) => o.status === 'NEW' || o.status === 'PICKING');
        setPendingOrders(pending);
        return pending;
      }
    } catch (e) {
      console.error('Failed to load pending orders:', e);
    }
    return [];
  };

  useEffect(() => {
    loadProducts();
    loadPendingOrders();
  }, []);

  // Filtered products for creating wave
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Handle Add Item to Selection
  const handleAddItemToWave = (product: any) => {
    const existing = selectedSkus.find((x) => x.sku === (product.id || product.name));
    if (existing) {
      setSelectedSkus(
        selectedSkus.map((x) => (x.sku === existing.sku ? { ...x, qty: x.qty + 1 } : x))
      );
    } else {
      setSelectedSkus([
        ...selectedSkus,
        {
          sku: product.id || product.name,
          qty: 1,
          orderRef: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        },
      ]);
    }
    triggerHaptic('success');
    toast.success(`เพิ่ม ${product.name} เข้า Wave`);
  };

  // 1-Click Load Pending Orders from Fulfillment API or Orders API or Fast-Moving items
  const loadPendingOrdersToWave = async () => {
    try {
      const toastId = toast.loading('กำลังดึงรายการออเดอร์ค้างส่ง...');
      const [res, latestPending] = await Promise.all([
        fetch(getApiUrl('/api/orders/fulfillment?action=check_pending')).catch(() => null),
        loadPendingOrders(),
      ]);
      const orderMap = new Map<string, string>();
      for (const o of latestPending) {
        if (o.orderNo && o.id) orderMap.set(o.orderNo, o.id);
        if (o.id) orderMap.set(o.id, o.id);
      }

      let found = false;

      if (res && res.ok) {
        const data = await res.json();
        if (data?.pending_tasks && data.pending_tasks.length > 0) {
          const itemsToWave = data.pending_tasks.map((task: any) => {
            const ref = task.doc_ref || task.order_no || 'Pending Order';
            return {
              sku: task.sku || task.item_name,
              qty: parseInt(task.amount || task.qty) || 1,
              orderRef: ref,
              orderId: task.order_id || orderMap.get(ref) || ref,
            };
          });
          setSelectedSkus(itemsToWave);
          setIsCreatingWave(true);
          triggerHaptic('success');
          toast.dismiss(toastId);
          toast.success(`ดึงสำเร็จ! พบ ${itemsToWave.length} รายการจากออเดอร์ค้างส่ง`);
          found = true;
        }
      }

      if (!found && latestPending.length > 0) {
        const itemsToWave: Array<{ sku: string; qty: number; orderRef?: string; orderId?: string }> = [];
        for (const ord of latestPending) {
          for (const it of ord.items || []) {
            itemsToWave.push({
              sku: it.sku || it.name,
              qty: Number(it.qty || 1),
              orderRef: ord.orderNo || ord.id,
              orderId: ord.id,
            });
          }
        }
        if (itemsToWave.length > 0) {
          setSelectedSkus(itemsToWave);
          setIsCreatingWave(true);
          triggerHaptic('success');
          toast.dismiss(toastId);
          toast.success(`ดึงสำเร็จ! พบ ${itemsToWave.length} รายการจากออเดอร์ค้างส่ง`);
          found = true;
        }
      }

      if (!found) {
        // Fallback: pick fast moving items from real products in stock
        const topProducts = products.filter((p) => (p.stock || 0) > 0).slice(0, 5);
        if (topProducts.length > 0) {
          const itemsToWave = topProducts.map((p, i) => ({
            sku: p.id || p.name,
            qty: 1,
            orderRef: `ORD-AUTO-${i + 1}`,
          }));
          setSelectedSkus(itemsToWave);
          setIsCreatingWave(true);
          triggerHaptic('success');
          toast.dismiss(toastId);
          toast.success(`ดึงสินค้าที่มีสต็อกในคลัง ${itemsToWave.length} รายการเข้า Wave`);
        } else {
          toast.dismiss(toastId);
          toast.error('ไม่พบสินค้าที่มีสต็อกในคลัง');
        }
      }
    } catch (e) {
      toast.error('ดึงออเดอร์ไม่สำเร็จ: ' + errorMessage(e));
    }
  };

  // Generate and start Wave with S-Shape calculation & Voice Prompt
  const handleStartWave = async () => {
    if (selectedSkus.length === 0) {
      toast.error('กรุณาเลือกสินค้าอย่างน้อย 1 รายการเพื่อสร้าง Wave');
      return;
    }

    const rawItems: Array<{
      id: string;
      sku: string;
      productName: string;
      requestedQty: number;
      pickedQty: number;
      location: string;
      status: 'PENDING' | 'PICKED' | 'SHORTAGE';
      orderDocNum?: string;
      orderId?: string;
      category?: string;
      unit?: string;
    }> = selectedSkus.map((item, idx) => {
      const prod = products.find((p) => p.id === item.sku || p.name === item.sku);
      const matchedOrder = pendingOrders.find(
        (o) => o.id === item.orderId || o.orderNo === item.orderRef || o.id === item.orderRef
      );
      return {
        id: `wave-item-${idx + 1}`,
        sku: item.sku,
        productName: prod?.name || item.sku,
        requestedQty: item.qty,
        pickedQty: 0,
        location: prod?.location || 'Unassigned',
        status: 'PENDING',
        orderDocNum: item.orderRef,
        orderId: item.orderId || matchedOrder?.id || item.orderRef,
        category: prod?.category || 'General',
        unit: prod?.unit || 'pcs',
      };
    });

    // Fetch Strict FEFO Lot Bins from API
    let fefoBinsBySku: Record<string, any[]> = {};
    try {
      const distinctSkus = Array.from(new Set(rawItems.map((r) => r.sku)));
      const fefoRes = await fetch(getApiUrl(`/api/lots/fefo-bins?skus=${encodeURIComponent(distinctSkus.join(','))}`));
      if (fefoRes.ok) {
        const fefoJson = await fefoRes.json();
        if (fefoJson.success && fefoJson.data) {
          fefoBinsBySku = fefoJson.data;
        }
      }
    } catch (e) {
      console.warn('FEFO bins fetch fallback:', e);
    }

    // Apply Strict FEFO Allocation & S-Shape Optimization
    const optimizedItems = buildFefoPickWaveItems(rawItems, fefoBinsBySku);

    const wave: PickingWave = {
      id: `wave-${Date.now()}`,
      waveNumber: generateWaveNumber(),
      createdAt: new Date().toLocaleTimeString('th-TH'),
      status: 'IN_PROGRESS',
      pickerName,
      items: optimizedItems,
      totalOrders: new Set(selectedSkus.map((s) => s.orderRef)).size,
      totalItems: optimizedItems.length,
      totalQty: optimizedItems.reduce((acc, x) => acc + x.requestedQty, 0),
      pickedQty: 0,
      progressPercent: 0,
    };

    setActiveWave(wave);
    setIsCreatingWave(false);
    setSelectedSkus([]);
    triggerHaptic('success');
    toast.success(`สร้าง Wave ${wave.waveNumber} สำเร็จ!`);

    // Voice prompt for the first item
    if (voiceEnabled && optimizedItems.length > 0) {
      speakThai(`เริ่มรอบการหยิบ ${wave.waveNumber}`);
      setTimeout(() => {
        speakPickInstruction(optimizedItems[0]);
      }, 1500);
    }
  };

  // Complete Wave & Update all distinct orders in activeWave to PICKED
  const handleCompleteWave = async () => {
    if (!activeWave) return;
    setIsCompletingWave(true);
    try {
      const distinctOrderIds = Array.from(
        new Set(
          activeWave.items
            .map((it: any) => {
              const ref = it.orderId || it.orderDocNum;
              if (!ref) return null;
              const matched = pendingOrders.find((o) => o.id === ref || o.orderNo === ref);
              return matched?.id || ref;
            })
            .filter((id): id is string => Boolean(id) && !id.startsWith('ORD-AUTO-'))
        )
      );

      let updatedCount = 0;
      for (const orderId of distinctOrderIds) {
        try {
          const res = await fetch(getApiUrl('/api/orders'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: orderId, status: 'PICKED' }),
          });
          if (res.ok) updatedCount++;
        } catch (err) {
          console.error(`Failed to update order ${orderId} to PICKED:`, err);
        }
      }

      await Promise.all([loadPendingOrders(), loadProducts()]);
      triggerHaptic('success');
      toast.success(
        updatedCount > 0
          ? `🎉 บันทึกการหยิบครบถ้วน และส่งต่อ ${updatedCount} ออเดอร์ไปจุดแพ็กเรียบร้อย!`
          : '🎉 บันทึกการหยิบครบถ้วนเรียบร้อย!'
      );
      setActiveWave(null);
    } catch (e) {
      toast.error('บันทึกผล Wave ไม่สำเร็จ: ' + errorMessage(e));
    } finally {
      setIsCompletingWave(false);
    }
  };

  // Quick Pick Action with Voice Progression
  const handlePickItem = (itemId: string, qtyToPick?: number) => {
    if (!activeWave) return;
    const target = activeWave.items.find((x) => x.id === itemId);
    if (target && target.expiryRisk === 'EXPIRED') {
      toast.error('❌ กฎ FEFO ล็อก: ไม่อนุญาตให้หยิบสินค้าล็อตที่หมดอายุแล้วเด็ดขาด!');
      triggerHaptic('error');
      if (voiceEnabled) speakThai('ห้ามหยิบ สินค้าล็อตนี้หมดอายุแล้ว');
      return;
    }

    setActiveWave((prev) => {
      if (!prev) return null;
      const updatedItems = prev.items.map((item) => {
        if (item.id === itemId) {
          const newPicked = qtyToPick !== undefined ? qtyToPick : item.requestedQty;
          return {
            ...item,
            pickedQty: newPicked,
            status: (newPicked >= item.requestedQty ? 'PICKED' : 'PENDING') as 'PENDING' | 'PICKED' | 'SHORTAGE',
          };
        }
        return item;
      });

      const stats = calculateWaveStats(updatedItems);

      // Voice prompt for NEXT pending item
      if (voiceEnabled) {
        const nextPending = updatedItems.find((x) => x.status !== 'PICKED');
        if (nextPending) {
          speakPickInstruction(nextPending);
        } else if (stats.isCompleted) {
          speakThai('หยิบสินค้าครบทุกรายการในรอบนี้แล้วครับ');
        }
      }

      triggerHaptic('success');

      return {
        ...prev,
        items: updatedItems,
        pickedQty: stats.pickedQty,
        progressPercent: stats.progressPercent,
        status: stats.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      };
    });
  };

  // Switch picking bin for a wave item
  const handleSwitchBin = (itemId: string, newBin: string) => {
    if (!activeWave) return;
    setActiveWave((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.id === itemId ? { ...it, location: newBin, parsedLocation: parseLocation(newBin) } : it
        ),
      };
    });
    if (voiceEnabled) {
      speakThai(`เปลี่ยนไปช่อง ${newBin}`);
    }
    toast.success(`เปลี่ยนไปหยิบจากช่อง: ${newBin}`);
  };

  // Handle Barcode Scan to Pick
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim() || !activeWave) return;

    const query = scanInput.trim().toLowerCase();
    // Find matching item in wave (by SKU, Name or Barcode)
    const match = activeWave.items.find(
      (i) =>
        (i.sku.toLowerCase() === query ||
          i.productName.toLowerCase() === query ||
          i.location.toLowerCase() === query) &&
        i.status !== 'PICKED'
    );

    if (match) {
      handlePickItem(match.id, match.requestedQty);
      toast.success(`สแกนพบ: ${match.productName} (พิกัด: ${match.location})`);
      setScanInput('');
    } else {
      triggerHaptic('error');
      if (voiceEnabled) speakThai('ไม่พบรายการสินค้าที่รอหยิบครับ');
      toast.error(`ไม่พบรายการที่รอหยิบสำหรับโค้ด: ${scanInput}`);
      setScanInput('');
    }
  };

  // Stats calculation
  const currentStats = useMemo(() => {
    if (!activeWave) return null;
    return calculateWaveStats(activeWave.items);
  }, [activeWave]);

  // Current Next Target Item
  const nextTargetItem = useMemo(() => {
    if (!activeWave) return null;
    return activeWave.items.find((x) => x.status !== 'PICKED');
  }, [activeWave]);

  // Shared item pick scanner for both Hardware PDA Gun and Mobile Camera
  const handleItemScanned = (scanned: string) => {
    if (!activeWave) return;
    const query = scanned.trim().toLowerCase();
    const match = activeWave.items.find(
      (i) =>
        (i.sku.toLowerCase() === query ||
          i.productName.toLowerCase() === query ||
          i.location.toLowerCase() === query) &&
        i.status !== 'PICKED'
    );

    if (match) {
      handlePickItem(match.id, match.requestedQty);
      triggerHaptic('success');
      toast.success(`สแกนสำเร็จ: ${match.productName} (${match.location})`);
      if (voiceEnabled) speakScanSuccess(match.productName);
    } else {
      triggerHaptic('error');
      if (voiceEnabled) speakScanMismatch();
      toast.error(`ไม่พบรายการที่รอหยิบสำหรับโค้ด: ${scanned}`);
    }
  };

  // Global PDA / Wireless Scanner Gun Listener (Keyboard Wedge)
  usePdaScanner({
    enabled: Boolean(activeWave && activeWave.status === 'IN_PROGRESS'),
    onScan: handleItemScanned,
  });

  // Print Pick Sheet
  const handlePrint = () => {
    if (activeWave) {
      window.open(`/print/wave-slip?id=${activeWave.id}`, '_blank');
    } else {
      window.print();
    }
  };

  void calculateSShapePickPath;
  void (undefined as unknown as PickWaveItem);

  return (
    <div
      className={cn(
        'relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 transition-colors',
        forkliftMode ? 'bg-slate-950 text-white' : 'theme-nexus-hybrid text-slate-900'
      )}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header
          className={cn(
            'relative overflow-hidden p-6 print:hidden',
            forkliftMode
              ? 'rounded-3xl border border-amber-500/40 bg-slate-900/95 text-white shadow-xl'
              : 'nx-glass-card'
          )}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/ops/outbound"
                className={cn(
                  'p-2.5 rounded-full border transition-colors shadow-2xs',
                  forkliftMode
                    ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                    : 'bg-white/85 hover:bg-white border-slate-200/80 text-slate-700 hover:text-slate-900'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1
                  className={cn(
                    'text-2xl sm:text-3xl font-black flex items-center gap-2.5 tracking-tight',
                    forkliftMode ? 'text-white' : 'text-slate-900'
                  )}
                >
                  <Boxes className="w-7 h-7 text-amber-500" />
                  <span>Smart Wave Picking &amp; Voice Assist</span>
                </h1>
                <p className={cn('text-xs sm:text-sm mt-0.5', forkliftMode ? 'text-slate-300' : 'text-slate-600')}>
                  ระบบจัดรอบหยิบรวมออเดอร์ • เดินแบบ S-Shape • เสียงพูดนำทางภาษาไทย (Voice Picking)
                </p>
              </div>
            </div>

            {/* Action Buttons & Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Voice Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextVal = !voiceEnabled;
                  setVoiceEnabled(nextVal);
                  if (nextVal) speakThai('เปิดระบบเสียงพูดนำทาง');
                  toast.success(nextVal ? 'เปิดเสียงนำทาง' : 'ปิดเสียงนำทาง');
                }}
                className={cn(
                  'px-3.5 py-2 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all',
                  voiceEnabled
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : forkliftMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300'
                    : 'bg-white/80 border-slate-200 text-slate-600'
                )}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {voiceEnabled ? 'เสียงนำทาง: เปิด' : 'เสียงนำทาง: ปิด'}
              </button>

              {/* Forklift Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  setForkliftMode(!forkliftMode);
                  toast.success(forkliftMode ? 'โหมดมาตรฐาน' : 'โหมดรถโฟล์คลิฟต์ / จอใหญ่');
                }}
                className={cn(
                  'px-3.5 py-2 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all',
                  forkliftMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg font-black'
                    : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                )}
              >
                <Eye className="w-4 h-4" />
                {forkliftMode ? 'โหมดโฟล์คลิฟต์: ON' : 'โหมดโฟล์คลิฟต์: OFF'}
              </button>

              {activeWave && (
                <button
                  onClick={handlePrint}
                  className={cn(
                    'px-3.5 py-2 border font-bold rounded-full text-xs flex items-center gap-1.5 shadow-2xs transition-colors',
                    forkliftMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-white/85 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-white'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  พิมพ์ใบหยิบ
                </button>
              )}

              {!isCreatingWave && (
                <>
                  <button
                    onClick={loadPendingOrdersToWave}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-100" />
                    ดึงออเดอร์ค้างส่งทันที
                  </button>

                  <button
                    onClick={() => setIsCreatingWave(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    สร้าง Wave ใหม่
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Modal: Create Wave */}
        <AnimatePresence>
          {isCreatingWave && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="nx-glass-card p-6 space-y-6 print:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    สร้างรอบการหยิบสินค้า (New Batch Wave)
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    เลือกรายการสินค้า ระบบจะคำนวณลำดับการเดินหยิบตามพิกัด (Zone &amp; Aisle S-Shape) ให้อัตโนมัติ
                  </p>
                </div>
                <button
                  onClick={() => setIsCreatingWave(false)}
                  className="text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200 font-bold px-3.5 py-1.5 rounded-full text-xs transition-colors"
                >
                  ยกเลิก
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Product Selection */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหา SKU, ชื่อสินค้า, หรือพิกัดเชลฟ์..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="border border-slate-200/80 bg-white/85 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/95 text-slate-700 font-bold text-xs border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-4">สินค้า</th>
                          <th className="py-2.5 px-4">พิกัด Location</th>
                          <th className="py-2.5 px-4 text-right">คงเหลือ</th>
                          <th className="py-2.5 px-4 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {loading ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              กำลังโหลดสินค้า...
                            </td>
                          </tr>
                        ) : filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500">
                              ไม่พบสินค้าที่ตรงกับการค้นหา
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => (
                            <tr key={p.id || p.name} className="hover:bg-amber-500/5 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-slate-900">
                                <div>{p.name}</div>
                                <div className="text-xs text-slate-500 font-mono">{p.id}</div>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200">
                                  <MapPin className="w-3 h-3 text-amber-600" />
                                  {p.location || 'Unassigned'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-800 tabular-nums">
                                {Number(p.stock || 0).toLocaleString()} {p.unit || 'pcs'}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleAddItemToWave(p)}
                                  className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 border border-amber-500/25 rounded-full text-xs font-bold transition-colors inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" /> เพิ่ม
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Selected List */}
                <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center justify-between text-sm tabular-nums">
                      <span>รายการที่เลือก ({selectedSkus.length})</span>
                      {selectedSkus.length > 0 && (
                        <button onClick={() => setSelectedSkus([])} className="text-xs text-rose-600 hover:underline">
                          ล้างทั้งหมด
                        </button>
                      )}
                    </h3>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedSkus.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl bg-white/60">
                          ยังไม่มีรายการที่เลือก
                          <br />
                          กดเพิ่มสินค้าจากตารางด้านซ้าย
                        </div>
                      ) : (
                        selectedSkus.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs shadow-2xs"
                          >
                            <div className="truncate max-w-[120px]">
                              <div className="font-bold text-slate-900 truncate font-mono">{item.sku}</div>
                              <div className="text-[10px] text-slate-500">{item.orderRef}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setSelectedSkus(
                                    selectedSkus.map((x, i) => (i === idx ? { ...x, qty: val } : x))
                                  );
                                }}
                                className="w-14 h-7 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 tabular-nums"
                              />
                              <button
                                onClick={() => setSelectedSkus(selectedSkus.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        ผู้หยิบสินค้า (Picker)
                      </label>
                      <input
                        type="text"
                        value={pickerName}
                        onChange={(e) => setPickerName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      onClick={handleStartWave}
                      disabled={selectedSkus.length === 0}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-full text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      สร้าง Wave &amp; เริ่มหยิบ
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Wave Screen */}
        {activeWave ? (
          <div className="space-y-6">
            {/* NEXT TARGET HIGHLIGHT (1 Hero Dark Accent Card for Operator Head-up Display) */}
            {nextTargetItem && (
              <div
                className={cn(
                  'p-6 transition-all relative overflow-hidden',
                  forkliftMode
                    ? 'rounded-3xl border-2 bg-amber-950/95 border-amber-400 text-amber-100 ring-4 ring-amber-400/30 shadow-2xl'
                    : 'nx-dark-accent-card border-amber-400/35'
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-full">
                        เป้าหมายถัดไป (Next Pick Target)
                      </span>
                      <span className="font-mono text-xs text-amber-300 tabular-nums">
                        จุดที่ #{nextTargetItem.pickSequence}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3 flex-wrap">
                      <h2
                        className={cn(
                          'font-black tracking-tight',
                          forkliftMode ? 'text-3xl sm:text-5xl text-amber-300' : 'text-2xl sm:text-4xl text-white'
                        )}
                      >
                        {nextTargetItem.productName}
                      </h2>
                      <span className="text-xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums">
                        x{nextTargetItem.requestedQty} {nextTargetItem.unit || 'ชิ้น'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 border border-amber-400/40 rounded-2xl font-mono text-base sm:text-xl font-black text-amber-300">
                        <MapPin className="w-5 h-5 text-amber-400" />
                        {nextTargetItem.location}
                      </div>
                      <span className="text-xs text-slate-300">
                        Zone {nextTargetItem.parsedLocation.zone} • Aisle {nextTargetItem.parsedLocation.aisle} • Rack{' '}
                        {nextTargetItem.parsedLocation.rack}
                      </span>
                    </div>

                    {/* Strict FEFO Lot & Expiry Badges */}
                    {nextTargetItem.lotNumber && nextTargetItem.lotNumber !== 'UNASSIGNED' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 border border-sky-400/40 rounded-full text-sky-200 font-mono text-xs sm:text-sm font-bold">
                          <span>🔒 กฎ FEFO ล็อต:</span>
                          <span className="text-white underline">{nextTargetItem.lotNumber}</span>
                        </div>
                        {nextTargetItem.expDate && (
                          <div
                            className={cn(
                              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold border tabular-nums',
                              nextTargetItem.expiryRisk === 'CRITICAL'
                                ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 animate-pulse'
                                : nextTargetItem.expiryRisk === 'WARNING'
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                            )}
                          >
                            <span>วันหมดอายุ:</span>
                            <span>{nextTargetItem.expDate.slice(0, 10)}</span>
                            {nextTargetItem.daysToExpiry !== undefined && (
                              <span>
                                ({nextTargetItem.daysToExpiry > 0 ? `เหลือ ${nextTargetItem.daysToExpiry} วัน` : 'หมดอายุแล้ว!'})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Multi-bin Quick Select / Alternate Bins */}
                    <div className="pt-2 max-w-xl">
                      <div className="bg-white/95 rounded-2xl p-3 border border-white/80">
                        <BinQuickSelect
                          sku={nextTargetItem.sku}
                          selectedBin={nextTargetItem.location}
                          onSelectBin={(newBin) => handleSwitchBin(nextTargetItem.id, newBin)}
                          mode="picking"
                          theme="light"
                          unit={nextTargetItem.unit || 'ชิ้น'}
                          label="ช่องเก็บที่มีสต็อกสำหรับสินค้านี้ (คลิกเพื่อสลับช่องหยิบ):"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    {voiceEnabled && (
                      <button
                        type="button"
                        onClick={() => speakPickInstruction(nextTargetItem)}
                        className="p-4 bg-white/10 hover:bg-white/20 text-amber-300 rounded-full border border-amber-400/35 transition-colors"
                        title="ฟังเสียงนำทางซ้ำ"
                      >
                        <Volume2 className="w-6 h-6" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowWaveScanCam(true)}
                      className="px-5 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-full shadow-xl flex items-center gap-2 transition-all active:scale-95"
                      title="เปิดกล้องสแกนยืนยันสินค้า"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="hidden sm:inline">สแกนกล้อง</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePickItem(nextTargetItem.id, nextTargetItem.requestedQty)}
                      className={cn(
                        'px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black rounded-full shadow-xl flex items-center gap-2.5 transition-all active:scale-95',
                        forkliftMode ? 'text-xl' : 'text-base'
                      )}
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      หยิบเรียบร้อย (Confirm Pick)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Wave Summary Card */}
            <div
              className={cn(
                'p-6',
                forkliftMode
                  ? 'rounded-2xl border bg-slate-900 border-slate-800 text-white shadow-xl'
                  : 'nx-glass-card text-slate-900'
              )}
            >
              <div
                className={cn(
                  'flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b',
                  forkliftMode ? 'border-slate-800' : 'border-slate-200/80'
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-mono font-black rounded-full">
                      {activeWave.waveNumber}
                    </span>
                    <span
                      className={cn(
                        'px-3 py-0.5 text-xs font-bold rounded-full border',
                        activeWave.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25'
                          : 'bg-sky-500/15 text-sky-700 border-sky-500/25'
                      )}
                    >
                      {activeWave.status === 'COMPLETED' ? 'หยิบเสร็จสิ้น' : 'กำลังดำเนินการหยิบ'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold">
                    ผู้รับผิดชอบ: <span className="text-amber-600">{activeWave.pickerName}</span> | เวลาสร้าง:{' '}
                    <span className="tabular-nums">{activeWave.createdAt}</span>
                  </h2>
                </div>

                {/* Progress Bar */}
                <div className="md:w-72 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold tabular-nums">
                    <span>ความคืบหน้าการหยิบ</span>
                    <span className="text-emerald-600">{currentStats?.progressPercent}%</span>
                  </div>
                  <div
                    className={cn(
                      'w-full h-3 rounded-full overflow-hidden border',
                      forkliftMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-200/80 border-slate-300/60'
                    )}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${currentStats?.progressPercent || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] opacity-75 tabular-nums">
                    <span>
                      หยิบแล้ว {currentStats?.pickedItemsCount} / {currentStats?.totalItems} รายการ
                    </span>
                    <span>
                      จำนวน {currentStats?.pickedQty} / {currentStats?.totalQty} ชิ้น
                    </span>
                  </div>
                </div>
              </div>

              {/* Fast Scan Input Bar */}
              <div
                className={cn(
                  'mt-5 pt-4 border-t print:hidden',
                  forkliftMode ? 'border-slate-800' : 'border-slate-200/80'
                )}
              >
                <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                    <input
                      ref={scanInputRef}
                      type="text"
                      placeholder="สแกนบาร์โค้ดสินค้า / SKU / พิกัด เพื่อยืนยันการหยิบทันที..."
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      className={cn(
                        'w-full pl-11 pr-4 py-3 border rounded-full font-medium focus:outline-none transition-all',
                        forkliftMode
                          ? 'bg-slate-800 border-amber-400 text-white placeholder-slate-400 text-lg'
                          : 'bg-white border-slate-200 focus:border-emerald-500 text-slate-900 placeholder:text-slate-400 text-sm shadow-2xs'
                      )}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowWaveScanCam(true)}
                      className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-full text-sm shadow-sm transition-all flex items-center gap-2 active:scale-95 shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      <span>เปิดกล้องสแกน</span>
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full text-sm shadow-sm transition-all flex items-center gap-2 shrink-0"
                    >
                      ยืนยัน
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Picking List Table */}
            <div
              className={cn(
                'overflow-hidden',
                forkliftMode
                  ? 'rounded-2xl border bg-slate-900 border-slate-800 shadow-xl'
                  : 'nx-glass-card'
              )}
            >
              <div
                className={cn(
                  'p-4 border-b flex items-center justify-between',
                  forkliftMode ? 'bg-slate-800/50 border-slate-800' : 'bg-white/50 border-slate-200/80'
                )}
              >
                <h3 className="font-black flex items-center gap-2 text-sm sm:text-base">
                  <Layers className="w-5 h-5 text-amber-500" />
                  รายการสินค้าในรอบ (All Wave Items)
                </h3>
                <span className="text-xs opacity-75">เรียงตามเส้นทาง S-Shape</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead
                    className={cn(
                      'font-bold text-xs border-b',
                      forkliftMode
                        ? 'bg-slate-800/70 text-slate-300 border-slate-800'
                        : 'bg-slate-50/90 text-slate-600 border-slate-200/80'
                    )}
                  >
                    <tr>
                      <th className="py-3 px-4 text-center w-16">ลำดับ</th>
                      <th className="py-3 px-4">พิกัดจัดเก็บ</th>
                      <th className="py-3 px-4">รหัส / ชื่อสินค้า</th>
                      <th className="py-3 px-4">อ้างอิง</th>
                      <th className="py-3 px-4 text-center">จำนวน</th>
                      <th className="py-3 px-4 text-center">สถานะ</th>
                      <th className="py-3 px-4 text-center print:hidden">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', forkliftMode ? 'divide-slate-800' : 'divide-slate-200/75 bg-white/60')}>
                    {activeWave.items.map((item) => (
                      <tr
                        key={item.id}
                        className={cn(
                          'transition-colors',
                          item.status === 'PICKED'
                            ? forkliftMode
                              ? 'bg-emerald-950/30 text-emerald-300'
                              : 'bg-emerald-500/8 text-emerald-950'
                            : forkliftMode
                            ? 'hover:bg-slate-800/60'
                            : 'hover:bg-white'
                        )}
                      >
                        <td className="py-3 px-4 text-center">
                          <span
                            className={cn(
                              'w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-black tabular-nums',
                              item.status === 'PICKED'
                                ? 'bg-emerald-600 text-white'
                                : forkliftMode
                                ? 'bg-slate-700 text-slate-200'
                                : 'bg-slate-200 text-slate-700'
                            )}
                          >
                            {item.pickSequence}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/12 border border-amber-500/25 text-amber-800 font-mono font-bold text-xs">
                            <MapPin className="w-3.5 h-3.5 text-amber-600" />
                            {item.location}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <div className="font-bold">{item.productName}</div>
                          <div className="text-xs opacity-65 font-mono">{item.sku}</div>
                          {item.lotNumber && item.lotNumber !== 'UNASSIGNED' && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/12 border border-sky-500/25 text-sky-700 font-mono font-semibold">
                                Lot: {item.lotNumber}
                              </span>
                              {item.expDate && (
                                <span
                                  className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border tabular-nums',
                                    item.expiryRisk === 'CRITICAL'
                                      ? 'bg-rose-500/15 border-rose-500/25 text-rose-700'
                                      : item.expiryRisk === 'WARNING'
                                      ? 'bg-amber-500/15 border-amber-500/25 text-amber-800'
                                      : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-800'
                                  )}
                                >
                                  EXP: {item.expDate.slice(0, 10)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono opacity-80">{item.orderDocNum || '-'}</td>
                        <td className="py-3 px-4 text-center tabular-nums">
                          <span className="font-black text-base">{item.requestedQty}</span>{' '}
                          <span className="text-xs opacity-75">{item.unit || 'pcs'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.status === 'PICKED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 rounded-full text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> หยิบแล้ว
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border',
                                forkliftMode
                                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              )}
                            >
                              รอหยิบ
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center print:hidden">
                          {item.status !== 'PICKED' ? (
                            <button
                              onClick={() => handlePickItem(item.id, item.requestedQty)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold shadow-xs transition-colors"
                            >
                              หยิบครบ
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePickItem(item.id, 0)}
                              className={cn(
                                'px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors',
                                forkliftMode
                                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              )}
                            >
                              ยกเลิก
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Completion Footer */}
              <div
                className={cn(
                  'p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden',
                  forkliftMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/85 border-slate-200/80'
                )}
              >
                <button
                  onClick={() => {
                    if (confirm('คุณต้องการรีเซ็ต Wave นี้หรือไม่?')) {
                      setActiveWave(null);
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 font-bold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> ยกเลิก Wave นี้
                </button>

                {currentStats?.isCompleted && (
                  <button
                    onClick={handleCompleteWave}
                    disabled={isCompletingWave}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-full text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
                  >
                    {isCompletingWave ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        กำลังบันทึกและส่งต่อ...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        เสร็จสิ้น Wave และส่งต่อไปจุดแพ็ก
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          !isCreatingWave && (
            <div className="nx-glass-card text-center py-20 p-8 space-y-4">
              <div className="w-16 h-16 bg-amber-500/12 border border-amber-500/25 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                <Boxes className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-slate-900">ยังไม่มีรอบการหยิบสินค้า (Wave) ที่ทำงานอยู่</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  สร้าง Wave รวมออเดอร์เพื่อประหยัดเวลาเดินหยิบสินค้า พร้อมระบบเสียงพูดนำทางภาษาไทย
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={loadPendingOrdersToWave}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-sm shadow-md transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-100" />
                  ดึงออเดอร์ค้างส่งทั้งหมดทันที
                </button>

                <button
                  onClick={() => setIsCreatingWave(true)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full text-sm shadow-md transition-all"
                >
                  + สร้าง Wave หยิบสินค้าด้วยตนเอง
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Embedded Camera Scanner for Tablet & Phone Pickers */}
      <CameraScannerModal
        isOpen={showWaveScanCam}
        onClose={() => setShowWaveScanCam(false)}
        onScan={handleItemScanned}
        continuous={true}
        title={`สแกนหยิบสินค้า: ${activeWave?.waveNumber || ''}`}
        description="ส่องกล้องไปที่บาร์โค้ดสินค้าหรือพิกัดเชลฟ์เพื่อยืนยันการหยิบ (รองรับสแกนต่อเนื่อง)"
      />
    </div>
  );
}
