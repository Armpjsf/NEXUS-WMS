'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sparkles,
  Barcode,
  RefreshCw,
  Plus,
  Play,
  RotateCcw,
  Layers,
  MapPin,
  TrendingDown,
  Navigation,
  FileSpreadsheet,
  Trash2,
  Search,
  Volume2,
  VolumeX,
  Eye,
  Smartphone,
  Camera,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
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
} from '@/lib/picking';
import { speakPickInstruction, speakThai, triggerHaptic, speakScanSuccess, speakScanMismatch, vibrateSuccess, vibrateError } from '@/lib/voiceAssistant';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import CameraScannerModal from '@/components/CameraScannerModal';

export default function WavePickingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWave, setActiveWave] = useState<PickingWave | null>(null);

  // Settings: Voice Assistant & Forklift Mode
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [forkliftMode, setForkliftMode] = useState(false);

  // New Wave Form State
  const [isCreatingWave, setIsCreatingWave] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Array<{ sku: string; qty: number; orderRef?: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerName, setPickerName] = useState('Warehouse Operator');

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

  useEffect(() => {
    loadProducts();
  }, []);

  // Filtered products for creating wave
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return products.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Handle Add Item to Selection
  const handleAddItemToWave = (product: any) => {
    const existing = selectedSkus.find(x => x.sku === (product.id || product.name));
    if (existing) {
      setSelectedSkus(
        selectedSkus.map(x => (x.sku === existing.sku ? { ...x, qty: x.qty + 1 } : x))
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

  // 1-Click Load Pending Orders from Fulfillment API or Fast-Moving items
  const loadPendingOrdersToWave = async () => {
    try {
      const toastId = toast.loading('กำลังดึงรายการออเดอร์ค้างส่ง...');
      const res = await fetch(getApiUrl('/api/orders/fulfillment?action=check_pending')).catch(() => null);
      let found = false;

      if (res && res.ok) {
        const data = await res.json();
        if (data?.pending_tasks && data.pending_tasks.length > 0) {
          const itemsToWave = data.pending_tasks.map((task: any) => ({
            sku: task.item_name || task.sku,
            qty: parseInt(task.amount || task.qty) || 1,
            orderRef: task.doc_ref || task.order_no || 'Pending Order',
          }));
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
        const topProducts = products.filter(p => (p.stock || 0) > 0).slice(0, 5);
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
    } catch (e: any) {
      toast.error('ดึงออเดอร์ไม่สำเร็จ: ' + e.message);
    }
  };

  // Generate and start Wave with S-Shape calculation & Voice Prompt
  const handleStartWave = () => {
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
      category?: string;
      unit?: string;
    }> = selectedSkus.map((item, idx) => {
      const prod = products.find(p => p.id === item.sku || p.name === item.sku);
      return {
        id: `wave-item-${idx + 1}`,
        sku: item.sku,
        productName: prod?.name || item.sku,
        requestedQty: item.qty,
        pickedQty: 0,
        location: prod?.location || 'Unassigned',
        status: 'PENDING',
        orderDocNum: item.orderRef,
        category: prod?.category || 'General',
        unit: prod?.unit || 'pcs',
      };
    });

    // Apply S-Shape Optimization
    const optimizedItems = calculateSShapePickPath(rawItems) as PickWaveItem[];

    const wave: PickingWave = {
      id: `wave-${Date.now()}`,
      waveNumber: generateWaveNumber(),
      createdAt: new Date().toLocaleTimeString('th-TH'),
      status: 'IN_PROGRESS',
      pickerName,
      items: optimizedItems,
      totalOrders: new Set(selectedSkus.map(s => s.orderRef)).size,
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

  // Quick Pick Action with Voice Progression
  const handlePickItem = (itemId: string, qtyToPick?: number) => {
    if (!activeWave) return;

    setActiveWave(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map(item => {
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
        const nextPending = updatedItems.find(x => x.status !== 'PICKED');
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

  // Handle Barcode Scan to Pick
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim() || !activeWave) return;

    const query = scanInput.trim().toLowerCase();
    // Find matching item in wave (by SKU, Name or Barcode)
    const match = activeWave.items.find(
      i =>
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
    return activeWave.items.find(x => x.status !== 'PICKED');
  }, [activeWave]);

  // Shared item pick scanner for both Hardware PDA Gun and Mobile Camera
  const handleItemScanned = (scanned: string) => {
    if (!activeWave) return;
    const query = scanned.trim().toLowerCase();
    const match = activeWave.items.find(
      i =>
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

  return (
    <div
      className={cn(
        'relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 transition-colors',
        forkliftMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      )}
    >
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header
          className={cn(
            'relative overflow-hidden rounded-[1.75rem] border p-6 shadow-xl backdrop-blur-xl print:hidden',
            forkliftMode
              ? 'bg-slate-900/90 border-amber-500/40 text-white'
              : 'border-amber-200 bg-white/90 shadow-amber-900/5'
          )}
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/ops/outbound"
                className={cn(
                  'p-3 rounded-xl border transition-colors',
                  forkliftMode
                    ? 'bg-slate-800 border-slate-700 text-amber-400'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2.5">
                  <Boxes className="w-8 h-8 text-amber-500" />
                  Smart Wave Picking & Voice Assist
                </h1>
                <p className={cn('text-sm mt-0.5', forkliftMode ? 'text-slate-400' : 'text-slate-500')}>
                  ระบบจัดรอบหยิบรวมออเดอร์ • เดินแบบ S-Shape • เสียงพูดนำทางภาษาไทย (Voice Picking)
                </p>
              </div>
            </div>

            {/* Action Buttons & Toggles */}
            <div className="flex flex-wrap items-center gap-2.5">
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
                  'px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all',
                  voiceEnabled
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
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
                  'px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all',
                  forkliftMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg font-black'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                )}
              >
                <Eye className="w-4 h-4" />
                {forkliftMode ? 'โหมดโฟล์คลิฟต์: ON' : 'โหมดโฟล์คลิฟต์: OFF'}
              </button>

              {activeWave && (
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  พิมพ์ใบหยิบ
                </button>
              )}

              {!isCreatingWave && (
                <>
                  <button
                    onClick={loadPendingOrdersToWave}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    ดึงออเดอร์ค้างส่งทันที
                  </button>

                  <button
                    onClick={() => setIsCreatingWave(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
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
              className="bg-white text-slate-900 rounded-2xl border border-amber-200 p-6 shadow-xl space-y-6 print:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    สร้างรอบการหยิบสินค้า (New Batch Wave)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    เลือกรายการสินค้า ระบบจะคำนวณลำดับการเดินหยิบตามพิกัด (Zone & Aisle S-Shape) ให้อัตโนมัติ
                  </p>
                </div>
                <button
                  onClick={() => setIsCreatingWave(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold px-3 py-1 rounded-lg text-xs"
                >
                  ยกเลิก
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Product Selection */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหา SKU, ชื่อสินค้า, หรือพิกัดเชลฟ์..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800"
                    />
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100/75 text-slate-600 font-semibold text-xs border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-4">สินค้า</th>
                          <th className="py-2.5 px-4">พิกัด Location</th>
                          <th className="py-2.5 px-4 text-right">คงเหลือ</th>
                          <th className="py-2.5 px-4 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400">
                              กำลังโหลดสินค้า...
                            </td>
                          </tr>
                        ) : filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400">
                              ไม่พบสินค้าที่ตรงกับการค้นหา
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map(p => (
                            <tr key={p.id || p.name} className="hover:bg-amber-50/50 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-slate-800">
                                <div>{p.name}</div>
                                <div className="text-xs text-slate-400 font-mono">{p.id}</div>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
                                  <MapPin className="w-3 h-3 text-amber-600" />
                                  {p.location || 'Unassigned'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                                {Number(p.stock || 0).toLocaleString()} {p.unit || 'pcs'}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleAddItemToWave(p)}
                                  className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                      <span>รายการที่เลือก ({selectedSkus.length})</span>
                      {selectedSkus.length > 0 && (
                        <button
                          onClick={() => setSelectedSkus([])}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          ล้างทั้งหมด
                        </button>
                      )}
                    </h3>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedSkus.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          ยังไม่มีรายการที่เลือก<br />กดเพิ่มสินค้าจากตารางด้านซ้าย
                        </div>
                      ) : (
                        selectedSkus.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div className="truncate max-w-[120px]">
                              <div className="font-bold text-slate-800 truncate">{item.sku}</div>
                              <div className="text-[10px] text-slate-400">{item.orderRef}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={e => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setSelectedSkus(
                                    selectedSkus.map((x, i) => (i === idx ? { ...x, qty: val } : x))
                                  );
                                }}
                                className="w-14 h-7 text-center font-bold bg-slate-50 border border-slate-200 rounded text-xs text-slate-800"
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

                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        ผู้หยิบสินค้า (Picker)
                      </label>
                      <input
                        type="text"
                        value={pickerName}
                        onChange={e => setPickerName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                      />
                    </div>

                    <button
                      onClick={handleStartWave}
                      disabled={selectedSkus.length === 0}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      สร้าง Wave & เริ่มหยิบ
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
            {/* NEXT TARGET HIGHLIGHT (Forklift / Operator Head-up Display) */}
            {nextTargetItem && (
              <div
                className={cn(
                  'rounded-3xl p-6 border-2 transition-all shadow-2xl relative overflow-hidden',
                  forkliftMode
                    ? 'bg-amber-950/90 border-amber-400 text-amber-200 ring-4 ring-amber-400/30'
                    : 'bg-gradient-to-r from-slate-900 to-slate-800 border-amber-400/50 text-white'
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-lg">
                        เป้าหมายถัดไป (Next Pick Target)
                      </span>
                      <span className="font-mono text-xs text-amber-300">
                        จุดที่ #{nextTargetItem.pickSequence}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <h2
                        className={cn(
                          'font-black tracking-tight',
                          forkliftMode ? 'text-3xl sm:text-5xl text-amber-300' : 'text-2xl sm:text-4xl text-white'
                        )}
                      >
                        {nextTargetItem.productName}
                      </h2>
                      <span className="text-xl sm:text-3xl font-black text-amber-400 font-mono">
                        x{nextTargetItem.requestedQty} {nextTargetItem.unit || 'ชิ้น'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 border border-amber-400/40 rounded-xl font-mono text-base sm:text-xl font-black text-amber-300">
                        <MapPin className="w-5 h-5 text-amber-400" />
                        {nextTargetItem.location}
                      </div>
                      <span className="text-xs text-slate-300">
                        Zone {nextTargetItem.parsedLocation.zone} • Aisle {nextTargetItem.parsedLocation.aisle} • Rack {nextTargetItem.parsedLocation.rack}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <div className="flex items-center gap-3">
                    {voiceEnabled && (
                      <button
                        type="button"
                        onClick={() => speakPickInstruction(nextTargetItem)}
                        className="p-4 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-2xl border border-amber-400/30"
                        title="ฟังเสียงนำทางซ้ำ"
                      >
                        <Volume2 className="w-6 h-6" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowWaveScanCam(true)}
                      className="px-5 py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-2xl shadow-xl flex items-center gap-2 transition-all active:scale-95"
                      title="เปิดกล้องสแกนยืนยันสินค้า"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="hidden sm:inline">สแกนกล้อง</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePickItem(nextTargetItem.id, nextTargetItem.requestedQty)}
                      className={cn(
                        'px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-2xl shadow-xl flex items-center gap-3 transition-all',
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
                'border rounded-2xl p-6 shadow-xl backdrop-blur-xl',
                forkliftMode
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : 'bg-white/95 border-slate-200 text-slate-900'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-amber-500 text-slate-950 text-xs font-mono font-black rounded-md">
                      {activeWave.waveNumber}
                    </span>
                    <span
                      className={cn(
                        'px-2.5 py-0.5 text-xs font-bold rounded-full',
                        activeWave.status === 'COMPLETED'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-blue-100 text-blue-800'
                      )}
                    >
                      {activeWave.status === 'COMPLETED' ? 'หยิบเสร็จสิ้น' : 'กำลังดำเนินการหยิบ'}
                    </span>
                  </div>
                  <h2 className="text-base font-bold">
                    ผู้รับผิดชอบ: <span className="text-amber-500">{activeWave.pickerName}</span> | เวลาสร้าง:{' '}
                    {activeWave.createdAt}
                  </h2>
                </div>

                {/* Progress Bar */}
                <div className="md:w-72 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>ความคืบหน้าการหยิบ</span>
                    <span className="text-amber-500">{currentStats?.progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${currentStats?.progressPercent || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] opacity-75">
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
              <div className="mt-5 pt-4 border-t border-slate-100/10 print:hidden">
                <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      ref={scanInputRef}
                      type="text"
                      placeholder="สแกนบาร์โค้ดสินค้า / SKU / พิกัด เพื่อยืนยันการหยิบทันที..."
                      value={scanInput}
                      onChange={e => setScanInput(e.target.value)}
                      className={cn(
                        'w-full pl-11 pr-4 py-3 border-2 rounded-xl font-medium focus:outline-none transition-all shadow-inner',
                        forkliftMode
                          ? 'bg-slate-800 border-amber-400 text-white placeholder-slate-400 text-lg'
                          : 'bg-slate-50 border-amber-300 text-slate-900 text-sm'
                      )}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowWaveScanCam(true)}
                      className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-sm shadow-md transition-all flex items-center gap-2 active:scale-95 shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      <span>เปิดกล้องสแกน</span>
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-sm shadow-md transition-all flex items-center gap-2 shrink-0"
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
                'border rounded-2xl shadow-xl overflow-hidden',
                forkliftMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              )}
            >
              <div className="p-4 bg-slate-100/10 border-b border-slate-200/10 flex items-center justify-between">
                <h3 className="font-black flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-500" />
                  รายการสินค้าในรอบ (All Wave Items)
                </h3>
                <span className="text-xs opacity-75">เรียงตามเส้นทาง S-Shape</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/10 font-bold text-xs border-b border-slate-200/10">
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
                  <tbody className="divide-y divide-slate-100/10">
                    {activeWave.items.map(item => (
                      <tr
                        key={item.id}
                        className={cn(
                          'transition-colors',
                          item.status === 'PICKED'
                            ? 'bg-emerald-950/20 text-emerald-300'
                            : 'hover:bg-amber-500/10'
                        )}
                      >
                        <td className="py-3 px-4 text-center">
                          <span
                            className={cn(
                              'w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-black',
                              item.status === 'PICKED'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-700 text-slate-200'
                            )}
                          >
                            {item.pickSequence}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs">
                            <MapPin className="w-3.5 h-3.5 text-amber-500" />
                            {item.location}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <div className="font-bold">{item.productName}</div>
                          <div className="text-xs opacity-60 font-mono">{item.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono opacity-80">
                          {item.orderDocNum || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-black text-base">{item.requestedQty}</span>{' '}
                          <span className="text-xs opacity-75">{item.unit || 'pcs'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.status === 'PICKED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> หยิบแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700/50 text-slate-400 rounded-full text-xs font-bold">
                              รอหยิบ
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center print:hidden">
                          {item.status !== 'PICKED' ? (
                            <button
                              onClick={() => handlePickItem(item.id, item.requestedQty)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                            >
                              หยิบครบ
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePickItem(item.id, 0)}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-colors"
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
              <div className="p-4 bg-slate-800/40 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                <button
                  onClick={() => {
                    if (confirm('คุณต้องการรีเซ็ต Wave นี้หรือไม่?')) {
                      setActiveWave(null);
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> ยกเลิก Wave นี้
                </button>

                {currentStats?.isCompleted && (
                  <button
                    onClick={() => {
                      triggerHaptic('success');
                      toast.success('🎉 บันทึกการหยิบครบถ้วนเรียบร้อย!');
                      setActiveWave(null);
                    }}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    เสร็จสิ้น Wave และส่งต่อไปจุดแพ็ก
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          !isCreatingWave && (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-4">
              <div className="w-16 h-16 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Boxes className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-slate-800">ยังไม่มีรอบการหยิบสินค้า (Wave) ที่ทำงานอยู่</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  สร้าง Wave รวมออเดอร์เพื่อประหยัดเวลาเดินหยิบสินค้า พร้อมระบบเสียงพูดนำทางภาษาไทย
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={loadPendingOrdersToWave}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  ดึงออเดอร์ค้างส่งทั้งหมดทันที
                </button>

                <button
                  onClick={() => setIsCreatingWave(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
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
