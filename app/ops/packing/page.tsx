'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  CheckCircle2,
  Scale,
  Barcode,
  Printer,
  RefreshCw,
  X,
  Truck,
  Volume2,
  VolumeX,
  ShieldCheck,
  BoxSelect,
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { usePdaScanner } from '@/hooks/usePdaScanner';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { ExperimentalBanner } from '@/components/ui/ExperimentalBanner';
import { errorMessage } from '@/lib/errors';

interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  verifiedQty: number;
  isVerified: boolean;
  unit?: string;
  weightKg?: number;
}

interface PackingOrder {
  orderNo: string;
  customerName: string;
  channel: string;
  carrier: string;
  status: string;
  items: OrderItem[];
}

export default function PackingQAPage() {
  const [orders, setOrders] = useState<PackingOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    async function loadPackingOrders() {
      try {
        setLoadingOrders(true);
        const res = await fetch('/api/orders?limit=100');
        if (res.ok) {
          const json = await res.json();
          const allOrders = json.orders || [];
          const packable = allOrders.filter((o: any) => o.status === 'PICKED' || o.status === 'PACKING');
          const formatted: PackingOrder[] = packable.map((o: any) => ({
            orderNo: o.orderNo || o.id,
            customerName: o.customerName || 'ลูกค้าทั่วไป',
            channel: o.channel || 'Direct',
            carrier: o.carrier || 'STANDARD',
            status: o.status || 'PICKED',
            items: (o.items || []).map((it: any) => ({
              sku: it.sku,
              name: it.name || it.sku,
              qty: Number(it.qty || 1),
              verifiedQty: Number(it.packed || 0),
              isVerified: Number(it.packed || 0) >= Number(it.qty || 1),
              unit: it.unit || 'ชิ้น',
              weightKg: Number(it.weightKg || 1.0)
            }))
          }));
          setOrders(formatted);
          if (formatted.length > 0) {
            setSelectedOrder(formatted[0]);
          }
        }
      } catch (e) {
        console.error('Failed to load packing orders:', e);
      } finally {
        setLoadingOrders(false);
      }
    }
    loadPackingOrders();
  }, []);

  const [selectedOrder, setSelectedOrder] = useState<PackingOrder | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [actualWeight, setActualWeight] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shipmentResult, setShipmentResult] = useState<any>(null);

  // Auto-select first order
  useEffect(() => {
    if (!selectedOrder && orders.length > 0) {
      setSelectedOrder(orders[0]);
    }
  }, [orders, selectedOrder]);

  // Audio effects via Web Audio API
  const playBeep = (type: 'success' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(1800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  // Hardware Scanner Hook
  usePdaScanner({
    onScan: (scanned) => {
      handleVerifyBarcode(scanned);
    },
    enabled: !!selectedOrder
  });

  // Verification Logic
  const handleVerifyBarcode = (code: string) => {
    if (!selectedOrder) return;
    const clean = code.trim().toLowerCase();

    const itemIdx = selectedOrder.items.findIndex(it => 
      it.sku.toLowerCase() === clean || 
      it.name.toLowerCase().includes(clean)
    );

    if (itemIdx === -1) {
      playBeep('error');
      toast.error(`❌ สินค้าไม่ตรงออเดอร์! รหัส "${code}" ไม่อยู่ในคำสั่งซื้อนี้`);
      return;
    }

    const item = selectedOrder.items[itemIdx];
    if (item.verifiedQty >= item.qty) {
      playBeep('error');
      toast.error(`⚠️ สินค้า "${item.sku}" ตรวจสอบครบตามจำนวนแล้ว (${item.qty} ชิ้น)`);
      return;
    }

    // Success verify
    playBeep('success');
    const updatedItems = [...selectedOrder.items];
    const newQty = item.verifiedQty + 1;
    updatedItems[itemIdx] = {
      ...item,
      verifiedQty: newQty,
      isVerified: newQty >= item.qty
    };

    const updatedOrder = { ...selectedOrder, items: updatedItems };
    setSelectedOrder(updatedOrder);
    setOrders(orders.map(o => o.orderNo === updatedOrder.orderNo ? updatedOrder : o));

    toast.success(`✅ ตรวจสอบถูกต้อง: ${item.name} (${newQty}/${item.qty})`);
  };

  // Weight Calculation
  const estimatedWeight = selectedOrder
    ? selectedOrder.items.reduce((sum, it) => sum + (it.qty * (it.weightKg || 1)), 0)
    : 0;

  const isAllVerified = selectedOrder
    ? selectedOrder.items.every(it => it.verifiedQty >= it.qty)
    : false;

  // Complete Packing Session & Generate Shipping AWB
  const handleCompletePacking = async () => {
    if (!selectedOrder) return;
    if (!isAllVerified) {
      toast.error('กรุณาสแกนตรวจสอบสินค้าให้ครบทุกชิ้นก่อนปิดกล่อง');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Complete packing session
      const packRes = await fetch('/api/packing/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo: selectedOrder.orderNo,
          packedBy: 'Operator Station 01',
          actualWeightKg: actualWeight || estimatedWeight,
          estWeightKg: estimatedWeight,
          items: selectedOrder.items
        })
      });
      const packJson = await packRes.json();
      if (!packRes.ok) throw new Error(packJson.error || 'บันทึกการแพ็คไม่สำเร็จ');

      // 2. Dispatch carrier shipment & get tracking AWB
      const carrierRes = await fetch('/api/carrier/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo: selectedOrder.orderNo,
          carrierCode: selectedOrder.carrier,
          recipientName: selectedOrder.customerName,
          packageWeightKg: actualWeight || estimatedWeight,
          itemCount: selectedOrder.items.reduce((sum, it) => sum + it.qty, 0)
        })
      });
      const carrierJson = await carrierRes.json();

      toast.success(packJson.message || 'แพ็คสินค้าเรียบร้อยแล้ว!');
      setShipmentResult(carrierJson.data);

      // Remove from pending list
      setOrders(orders.filter(o => o.orderNo !== selectedOrder.orderNo));
      setSelectedOrder(null);
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen p-4 md:p-8 pb-32 font-mono">
      <AmbientBackground />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#30353d] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#57ec7f] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#57ec7f]">
                ZERO-ERROR PACKING QA STATION & WEIGHT CHECK
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#dee2ec] tracking-tight flex items-center gap-3">
              <span>สถานีตรวจแพ็คสินค้าและชั่งน้ำหนัก (Packing QA)</span>
            </h1>
            <p className="text-xs text-[#8a92a6] mt-1">
              สแกนบาร์โค้ดตรวจสอบสินค้าทีละชิ้น 100% ป้องกันหยิบผิด/ส่งของขาด พร้อมระบบตรวจชั่งน้ำหนักกล่องก่อนออกใบปะหน้าขนส่ง
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                soundEnabled ? "border-[#57ec7f]/40 bg-[#57ec7f]/10 text-[#57ec7f]" : "border-[#30353d] bg-[#171c23] text-[#8a92a6]"
              )}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'เสียงเปิด' : 'เสียงปิด'}</span>
            </button>

            <Link
              href="/ops/tasks"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#30353d] bg-[#252a32] text-[#dee2ec] hover:text-[#facc15] text-xs font-bold"
            >
              <span>กลับคิวงาน</span>
            </Link>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Order Queue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#dee2ec] flex items-center gap-1.5">
                <BoxSelect className="w-4 h-4 text-[#facc15]" />
                <span>คำสั่งซื้อรอแพ็ค ({orders.length})</span>
              </span>
            </div>

            <div className="space-y-2.5">
              {orders.length === 0 ? (
                <div className="p-8 rounded-xl border border-[#30353d] bg-[#171c23] text-center text-xs text-[#8a92a6]">
                  <CheckCircle2 className="w-8 h-8 text-[#57ec7f] mx-auto mb-2" />
                  <p className="font-bold text-[#dee2ec]">ไม่มีออเดอร์ค้างรอแพ็ค</p>
                  <p>สินค้าที่หยิบเสร็จแล้วจะมาแสดงที่นี่โดยอัตโนมัติ</p>
                </div>
              ) : (
                orders.map((ord) => {
                  const isSelected = selectedOrder?.orderNo === ord.orderNo;
                  const totalItems = ord.items.reduce((s, i) => s + i.qty, 0);
                  const verifiedItems = ord.items.reduce((s, i) => s + i.verifiedQty, 0);

                  return (
                    <div
                      key={ord.orderNo}
                      onClick={() => setSelectedOrder(ord)}
                      className={cn(
                        "p-4 rounded-xl border cursor-pointer transition-all shadow-md",
                        isSelected 
                          ? "border-[#facc15] bg-[#171c23]" 
                          : "border-[#30353d] bg-[#090f15]/80 hover:border-[#8a92a6]"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-bold text-[#facc15] text-sm">{ord.orderNo}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-[#4cd7f6] border border-[#4cd7f6]/30">
                          {ord.carrier}
                        </span>
                      </div>
                      <p className="text-xs text-[#dee2ec] truncate">{ord.customerName}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-[#8a92a6] pt-2 border-t border-[#30353d]/50">
                        <span>ความคืบหน้า:</span>
                        <span className={cn("font-bold", verifiedItems === totalItems ? "text-[#57ec7f]" : "text-[#dee2ec]")}>
                          {verifiedItems} / {totalItems} ชิ้น
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2 & 3: Packing Station Verification Terminal */}
          <div className="lg:col-span-2 space-y-4">
            {selectedOrder ? (
              <div className="rounded-2xl border border-[#30353d] bg-[#171c23] p-6 space-y-6 shadow-2xl">
                {/* Active Order Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#090f15] border border-[#30353d]">
                  <div>
                    <span className="text-[10px] text-[#8a92a6] uppercase tracking-wider block">กำลังตรวจสอบออเดอร์:</span>
                    <h2 className="text-lg font-bold text-[#facc15]">{selectedOrder.orderNo}</h2>
                    <p className="text-xs text-[#dee2ec] mt-0.5">{selectedOrder.customerName} ({selectedOrder.channel})</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#8a92a6] block">ขนส่งที่เลือก</span>
                    <span className="text-xs font-bold text-[#57ec7f]">{selectedOrder.carrier}</span>
                  </div>
                </div>

                {/* Scan Barcode Input Box */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#d1c6ab] uppercase tracking-wider">
                    🔫 ยิงสแกนบาร์โค้ดสินค้าที่นี่ (Laser Gun / Bluetooth / พิมพ์ค้นหา)
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (manualBarcode) {
                        handleVerifyBarcode(manualBarcode);
                        setManualBarcode('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3.5 top-3 w-5 h-5 text-[#facc15]" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter..."
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-[#090f15] border border-[#30353d] rounded-xl text-sm font-bold text-[#dee2ec] placeholder-[#8a92a6] outline-none focus:border-[#57ec7f] transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#facc15] text-[#1b1600] font-bold text-xs hover:bg-[#eec200] transition-all"
                    >
                      ตรวจสอบ
                    </button>
                  </form>
                </div>

                {/* Item Verification List */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-[#8a92a6]">
                    <span>รายการสินค้าในกล่อง</span>
                    <span>สถานะการตรวจสอบ</span>
                  </div>

                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => {
                      const isComplete = item.verifiedQty >= item.qty;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                            isComplete 
                              ? "bg-[#57ec7f]/10 border-[#57ec7f]/40" 
                              : item.verifiedQty > 0 
                              ? "bg-[#eec200]/10 border-[#facc15]/40" 
                              : "bg-[#090f15] border-[#30353d]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                              isComplete ? "bg-[#57ec7f] text-[#090f15]" : "bg-[#252a32] text-[#8a92a6]"
                            )}>
                              {isComplete ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-[#dee2ec]">{item.name}</p>
                              <p className="text-xs text-[#8a92a6]">
                                SKU: <strong className="text-[#facc15]">{item.sku}</strong> | น้ำหนักประเมิน: {item.weightKg} kg/ชิ้น
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                            <div>
                              <span className="text-[10px] text-[#8a92a6] block">จำนวนที่ตรวจแล้ว</span>
                              <span className={cn("text-base font-bold", isComplete ? "text-[#57ec7f]" : "text-[#dee2ec]")}>
                                {item.verifiedQty} / {item.qty} {item.unit || 'ชิ้น'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weight Scale & Tolerance Check */}
                <div className="p-4 rounded-xl border border-[#30353d] bg-[#090f15] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#dee2ec] flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-[#4cd7f6]" />
                      <span>ตรวจสอบน้ำหนักกล่องพัสดุ (Digital Scale Tolerance)</span>
                    </span>
                    <span className="text-[11px] text-[#8a92a6]">เกณฑ์คลาดเคลื่อน: ±15%</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#171c23] border border-[#30353d]">
                      <span className="text-[#8a92a6] block text-[10px]">น้ำหนักประเมินจากระบบ (Est. Weight):</span>
                      <span className="text-base font-bold text-[#4cd7f6]">{estimatedWeight.toFixed(2)} kg</span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#171c23] border border-[#30353d] flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[#8a92a6] block text-[10px]">น้ำหนักชั่งจริง (Actual Weight):</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={estimatedWeight.toFixed(2)}
                          value={actualWeight || ''}
                          onChange={(e) => setActualWeight(parseFloat(e.target.value) || 0)}
                          className="w-24 bg-[#090f15] border border-[#30353d] px-2 py-1 rounded text-sm font-bold text-[#dee2ec] outline-none focus:border-[#facc15]"
                        />
                        <span className="ml-1 text-[#8a92a6]">kg</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActualWeight(estimatedWeight)}
                        className="px-2 py-1 rounded bg-[#252a32] text-[#d1c6ab] hover:text-[#facc15] text-[10px]"
                      >
                        ซิงค์ตราชั่ง
                      </button>
                    </div>
                  </div>
                </div>

                {/* Complete Packing Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-[#8a92a6]">
                    {isAllVerified ? (
                      <span className="text-[#57ec7f] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> ตรวจสอบสินค้าครบถ้วนทุกรายการ พร้อมปิดกล่อง
                      </span>
                    ) : (
                      <span>กรุณาสแกนตรวจสอบสินค้าให้ครบตามจำนวนก่อนปิดกล่อง</span>
                    )}
                  </div>

                  <button
                    onClick={handleCompletePacking}
                    disabled={!isAllVerified || submitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#57ec7f] hover:bg-[#46c368] text-[#090f15] font-bold text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังออกใบส่งพัสดุ...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>ปิดกล่อง & ออกใบปะหน้าขนส่ง (Finalize Packing)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-2xl border border-[#30353d] bg-[#171c23] text-center text-xs text-[#8a92a6]">
                <Package className="w-12 h-12 text-[#8a92a6] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#dee2ec] mb-1">เลือกออเดอร์จากแถบด้านซ้ายเพื่อเริ่มตรวจแพ็ค</h3>
                <p>ระบบจะนำรายการสินค้าในบิลมาเปรียบเทียบกับบาร์โค้ดที่สแกนจริงหน้างานแบบ Real-Time</p>
              </div>
            )}
          </div>
        </div>

        {/* Shipping Label Modal Preview */}
        <AnimatePresence>
          {shipmentResult && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-2xl border border-[#30353d] bg-[#171c23] p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-start border-b border-[#30353d] pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#57ec7f]" />
                    <h3 className="text-base font-bold text-[#dee2ec]">ใบปะหน้าพัสดุ (AWB Shipping Label)</h3>
                  </div>
                  <button onClick={() => setShipmentResult(null)} className="p-1 text-[#8a92a6] hover:text-[#dee2ec]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {shipmentResult.simulated && (
                  <ExperimentalBanner>
                    ยังไม่ได้เชื่อม API ขนส่งจริง — เลขพัสดุ SIM-… เป็นเลขจำลอง ห้ามส่งให้ลูกค้าหรือใช้ติดกล่องจริง
                  </ExperimentalBanner>
                )}

                {/* White Sticker Mockup */}
                <div className="bg-white text-black p-4 rounded-lg shadow-xl border-2 border-black font-sans text-xs space-y-2">
                  <div className="flex justify-between items-center border-b-2 border-black pb-1.5 font-bold">
                    <span className="text-base">{shipmentResult.carrierName}</span>
                    <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded">EXPRESS AWB</span>
                  </div>

                  <div className="py-2 text-center border-b border-black">
                    <div className="font-mono text-base font-bold tracking-widest">{shipmentResult.trackingNumber}</div>
                    <div className="h-12 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_4px)] w-full my-1 border border-black" />
                    <span className="text-[10px] font-mono text-gray-700">Ref Order: {shipmentResult.awbLabelPayload?.orderNo}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div>
                      <strong className="block text-gray-700">ผู้ส่ง (Sender):</strong>
                      <p className="leading-tight">{shipmentResult.awbLabelPayload?.sender?.name}</p>
                      <p className="text-gray-600">{shipmentResult.awbLabelPayload?.sender?.phone}</p>
                    </div>
                    <div>
                      <strong className="block text-gray-700">ผู้รับ (Recipient):</strong>
                      <p className="leading-tight font-bold">{shipmentResult.awbLabelPayload?.recipient?.name}</p>
                      <p className="text-gray-600">{shipmentResult.awbLabelPayload?.recipient?.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 text-xs">
                  <button
                    onClick={() => {
                      toast.success('สั่งพิมพ์ใบปะหน้าเข้าเครื่องพิมพ์เรียบร้อย');
                      setShipmentResult(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#57ec7f] text-[#090f15] font-bold"
                  >
                    <Printer className="w-4 h-4" />
                    <span>พิมพ์ใบปะหน้า (Print AWB)</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}