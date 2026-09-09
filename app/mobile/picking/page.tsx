'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Boxes, 
  ArrowLeft, 
  CheckCircle2, 
  Play, 
  RotateCcw, 
  MapPin, 
  Navigation, 
  Volume2, 
  VolumeX, 
  Camera, 
  RefreshCw, 
  Scan, 
  Check, 
  Sparkles,
  ChevronRight,
  AlertCircle,
  Package,
  PlusCircle,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { 
  calculateSShapePickPath, 
  generateWaveNumber, 
  calculateWaveStats, 
  PickWaveItem, 
  PickingWave, 
  parseLocation 
} from '@/lib/picking';
import { 
  speakPickInstruction, 
  speakThai, 
  triggerHaptic, 
  speakScanSuccess, 
  speakScanMismatch 
} from '@/lib/voiceAssistant';
import { getApiUrl } from '@/lib/config';

export default function MobilePickingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [activeWave, setActiveWave] = useState<PickingWave | null>(null);
  const [waveOrderIds, setWaveOrderIds] = useState<string[]>([]);
  const [completedOrderNos, setCompletedOrderNos] = useState<string[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Load real pending orders and product catalog
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, ordRes] = await Promise.all([
        fetch(getApiUrl('/api/products'), { cache: 'no-store' }),
        fetch(getApiUrl('/api/orders?limit=100'), { cache: 'no-store' }),
      ]);
      const [prodJson, ordJson] = await Promise.all([
        prodRes.json().catch(() => []),
        ordRes.json().catch(() => ({ orders: [] })),
      ]);
      if (Array.isArray(prodJson)) setProducts(prodJson);
      if (ordJson?.orders && Array.isArray(ordJson.orders)) setOrders(ordJson.orders);
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real pending orders awaiting pick
  const pendingOrders = orders.filter(o => o.status === 'NEW' || o.status === 'PICKING');

  // Start Wave Picking from Real Orders
  const startWaveFromOrders = useCallback(async () => {
    if (pendingOrders.length === 0) {
      toast.error('ไม่มีออเดอร์ค้างหยิบในระบบ');
      return;
    }

    // Bundle up to 5 pending orders into this Wave
    const targetOrders = pendingOrders.slice(0, 5);
    const rawItems: PickWaveItem[] = [];
    const orderIds: string[] = [];
    const orderNos: string[] = [];

    targetOrders.forEach((ord) => {
      orderIds.push(ord.id);
      orderNos.push(ord.orderNo);
      const itemsList = Array.isArray(ord.items) ? ord.items : [];

      itemsList.forEach((line: any, lineIdx: number) => {
        const prod = products.find(p => p.sku === line.sku);
        const loc = line.location || prod?.location || `A-0${(lineIdx % 4) + 1}-01`;
        const remQty = Math.max(1, Number(line.qty || 1) - Number(line.picked || 0));

        rawItems.push({
          id: `pick-${ord.id}-${lineIdx}`,
          orderId: ord.id,
          orderDocNum: ord.orderNo,
          customerName: ord.customerName,
          sku: line.sku,
          productName: line.name || prod?.name || line.sku,
          barcode: prod?.barcode || prod?.sku || line.sku,
          requestedQty: remQty,
          pickedQty: 0,
          location: loc,
          parsedLocation: parseLocation(loc),
          pickSequence: rawItems.length + 1,
          status: 'PENDING' as const,
          category: prod?.category,
          unit: prod?.unit || 'ชิ้น',
        });
      });
    });

    if (rawItems.length === 0) {
      toast.error('ออเดอร์ที่เลือกไม่มีรายการสินค้า');
      return;
    }

    // Optimize travel path with S-Shape warehouse routing
    const sortedItems = calculateSShapePickPath(rawItems);
    const wave: PickingWave = {
      id: `wave-${Date.now()}`,
      waveNumber: generateWaveNumber(),
      createdAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      pickerName: 'พนักงานคลัง (Mobile)',
      items: sortedItems,
      totalOrders: targetOrders.length,
      ...calculateWaveStats(sortedItems),
    };

    setWaveOrderIds(orderIds);
    setCompletedOrderNos(orderNos);
    setActiveWave(wave);

    // Update order status to PICKING in DB
    for (const ord of targetOrders) {
      if (ord.status === 'NEW') {
        fetch(getApiUrl('/api/orders'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ord.id, status: 'PICKING' }),
        }).catch(() => {});
      }
    }

    toast.success(`เริ่มงานหยิบใบ ${wave.waveNumber} (รวม ${targetOrders.length} ออเดอร์)`);

    if (sortedItems.length > 0 && voiceEnabled) {
      speakPickInstruction(sortedItems[0]);
    }
  }, [pendingOrders, products, voiceEnabled]);

  // Create a Demo Order for testing when no pending orders exist
  const createDemoOrder = async () => {
    setCreatingDemo(true);
    try {
      const sampleItems = products.length >= 2
        ? [
            { sku: products[0].sku, name: products[0].name, qty: 2, price: products[0].price || 190, location: products[0].location || 'A-01-01' },
            { sku: products[1].sku, name: products[1].name, qty: 1, price: products[1].price || 350, location: products[1].location || 'A-02-02' },
          ]
        : [
            { sku: 'DEMO-SKU-A', name: 'สินค้าตัวอย่าง A (แก้วน้ำเซรามิก)', qty: 2, price: 150, location: 'A-01-01' },
            { sku: 'DEMO-SKU-B', name: 'สินค้าตัวอย่าง B (ชุดช้อนส้อมสแตนเลส)', qty: 1, price: 290, location: 'A-02-01' },
          ];

      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'Shopee',
          customerName: 'คุณสมชาย ใจดี (ลูกค้าตัวอย่าง)',
          phone: '089-123-4567',
          shipAddress: '88/12 ถ.สุขุมวิท พระโขนง กรุงเทพฯ 10110',
          carrier: 'Flash Express',
          priority: 'NORMAL',
          items: sampleItems,
        }),
      });

      if (res.ok) {
        toast.success('สร้างออเดอร์ทดสอบสำเร็จ!');
        await loadData();
      } else {
        toast.error('สร้างออเดอร์ไม่สำเร็จ');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการสร้างออเดอร์');
    } finally {
      setCreatingDemo(false);
    }
  };

  // Current Target Item in S-Shape sequence
  const currentTarget = activeWave?.items.find(i => i.status === 'PENDING');
  const pickedCount = activeWave?.items.filter(i => i.status === 'PICKED').length || 0;
  const totalCount = activeWave?.items.length || 0;
  const isCompleted = activeWave && totalCount > 0 && pickedCount === totalCount;

  // Handle Pick Confirmation
  const confirmPickItem = (item: PickWaveItem) => {
    if (!activeWave) return;

    playScannerAudio('success');
    triggerHaptic('success');

    const nextItems = activeWave.items.map(i => {
      if (i.id === item.id) {
        return { ...i, pickedQty: i.requestedQty, status: 'PICKED' as const };
      }
      return i;
    });

    const nextStats = calculateWaveStats(nextItems);
    const isNowFinished = nextStats.progressPercent === 100;

    const updatedWave: PickingWave = {
      ...activeWave,
      items: nextItems,
      ...nextStats,
      status: isNowFinished ? 'COMPLETED' : 'IN_PROGRESS',
    };

    setActiveWave(updatedWave);
    toast.success(`หยิบ ${item.productName} เรียบร้อย!`);

    // Announce next item in voice
    const nextTarget = nextItems.find(i => i.status === 'PENDING');
    if (nextTarget) {
      if (voiceEnabled) speakPickInstruction(nextTarget);
    } else {
      // 100% Completed! Mark all wave orders as PICKED in DB!
      if (voiceEnabled) speakThai('หยิบสินค้าครบทุกรายการแล้วค่ะ นำไปที่โต๊ะตรวจสอบคิวซีได้เลยค่ะ');
      toast.success('หยิบครบถ้วนทั้ง Wave แล้ว! อัปเดตสถานะออเดอร์เป็น PICKED เรียบร้อย');

      if (waveOrderIds.length > 0) {
        Promise.all(
          waveOrderIds.map(id =>
            fetch(getApiUrl('/api/orders'), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, status: 'PICKED' }),
            })
          )
        ).then(() => {
          loadData();
        }).catch(err => {
          console.error('[WavePicking] status update error:', err);
        });
      }
    }
  };

  // Barcode scanner verification
  const handleBarcodeScan = (scannedCode: string) => {
    if (!currentTarget) return;

    const clean = scannedCode.trim().toLowerCase();
    const isSkuMatch = currentTarget.sku.toLowerCase() === clean;
    const isBarcodeMatch = currentTarget.barcode?.toLowerCase() === clean;
    const isLocMatch = currentTarget.location.toLowerCase() === clean;

    if (isSkuMatch || isBarcodeMatch || isLocMatch) {
      setCameraOpen(false);
      confirmPickItem(currentTarget);
    } else {
      playScannerAudio('error');
      triggerHaptic('error');
      if (voiceEnabled) speakScanMismatch();
      toast.error(`รหัส ${scannedCode} ไม่ตรงกับเป้าหมาย (${currentTarget.sku})`);
    }
  };

  usePdaScanner({
    onScan: handleBarcodeScan,
    enabled: Boolean(currentTarget) && !cameraOpen,
    playSound: false,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 font-sans select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/mobile" 
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-base text-white leading-tight">หยิบสินค้า (Wave Picking)</h1>
              <p className="text-[11px] text-slate-400">เดินตามเส้นทาง S-Shape พร้อมเสียงนำทาง</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-xl border transition-all ${
                voiceEnabled 
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title={voiceEnabled ? 'เปิดเสียงภาษาไทยอยู่' : 'ปิดเสียง'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {activeWave && (
              <button
                onClick={() => setCameraOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all"
              >
                <Camera className="w-4 h-4" />
                <span>สแกนหยิบ</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {!activeWave ? (
          /* No Active Wave: Prompt to start from pending orders */
          <div className="space-y-4">
            {pendingOrders.length > 0 ? (
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-blue-500/30 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto">
                  <Boxes className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-2">
                    <Package className="w-3.5 h-3.5" />
                    มีออเดอร์ค้างหยิบ {pendingOrders.length} รายการ
                  </div>
                  <h2 className="text-xl font-black text-white">พร้อมสร้าง Wave หยิบสินค้า</h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    ระบบจะจัดกลุ่มออเดอร์จริงและคำนวณเส้นทางเดินหยิบแบบ S-Shape เพื่อลดระยะทางเดินให้สั้นที่สุด
                  </p>
                </div>

                {/* Preview of pending orders */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2 text-xs">
                  <span className="font-bold text-slate-400 text-[11px] block uppercase">ออเดอร์ที่พร้อมหยิบในรอบนี้ (สูงสุด 5 ออเดอร์)</span>
                  {pendingOrders.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{o.orderNo}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {o.channel || 'Direct'}
                        </span>
                      </div>
                      <span className="text-blue-400 font-bold font-mono">
                        {o.totalQty || o.items?.length || 1} ชิ้น
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startWaveFromOrders}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 transition-all"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>เริ่มคำสั่งหยิบรวม ({Math.min(5, pendingOrders.length)} ออเดอร์)</span>
                </button>
              </div>
            ) : (
              /* Satisfying Empty State: No pending orders */
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">ไม่มีออเดอร์ค้างหยิบ 🎉</h2>
                  <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
                    ออเดอร์ทั้งหมดถูกหยิบและส่งต่อไปยัง <strong>สถานีตรวจ QC และโต๊ะแพ็กกิ้ง</strong> เรียบร้อยแล้ว
                  </p>
                </div>

                <div className="pt-2 space-y-2.5">
                  <Link
                    href="/mobile/orders"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all"
                  >
                    <span>🔍 ไปที่สถานีตรวจ QC &amp; แพ็กกล่อง (QC Station)</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={createDemoOrder}
                    disabled={creatingDemo}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{creatingDemo ? 'กำลังสร้าง...' : '(โหมดทดสอบ) สร้างออเดอร์ใหม่เพื่อลองหยิบ'}</span>
                  </button>

                  <button
                    onClick={loadData}
                    className="w-full py-2.5 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> ตรวจสอบออเดอร์ใหม่อีกครั้ง
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Active Picking Wave */
          <>
            {/* Wave Progress Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-400">
                  {activeWave.waveNumber} ({activeWave.totalOrders} ออเดอร์)
                </span>
                <span className="text-xs font-bold text-slate-300">
                  หยิบแล้ว {pickedCount} / {totalCount} รายการ
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${activeWave.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Current Target Hero Card */}
            {currentTarget ? (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-950/60 to-slate-900 border-2 border-blue-500/50 p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-blue-400" /> เป้าหมาย #{currentTarget.pickSequence} (ออเดอร์ {currentTarget.orderDocNum || '-'})
                  </span>
                  <button
                    onClick={() => speakPickInstruction(currentTarget)}
                    className="p-2 rounded-xl bg-slate-800 text-blue-400 hover:text-white active:scale-95"
                    title="ฟังเสียงอีกครั้ง"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Target Location (Bin) - HUGE */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                  <span className="text-xs text-slate-400 block">พิกัดชั้นวางเป้าหมาย</span>
                  <span className="text-3xl font-black text-amber-400 tracking-wider font-mono">
                    {currentTarget.location}
                  </span>
                </div>

                {/* Target Product Details */}
                <div className="space-y-1">
                  <h3 className="font-black text-lg text-white leading-tight">
                    {currentTarget.productName}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span className="font-mono">SKU: {currentTarget.sku}</span>
                    <span>หยิบ: <strong className="text-2xl font-black text-emerald-400 ml-1">{currentTarget.requestedQty}</strong> {currentTarget.unit || 'ชิ้น'}</span>
                  </div>
                </div>

                {/* 1-Thumb Confirm Button */}
                <button
                  onClick={() => confirmPickItem(currentTarget)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>ยืนยันหยิบสำเร็จ ({currentTarget.requestedQty} {currentTarget.unit || 'ชิ้น'})</span>
                </button>
              </div>
            ) : (
              /* Completed Screen */
              <div className="p-8 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">หยิบสินค้าครบทุกรายการแล้ว! 🎉</h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    อัปเดตสถานะออเดอร์เป็น <strong>PICKED</strong> ในระบบแล้ว สินค้าพร้อมส่งต่อไปที่ <strong>สถานีตรวจ QC</strong> เพื่อยิงบาร์โค้ดเช็กความถูกต้องก่อนบรรจุกล่อง
                  </p>
                </div>

                {/* Completed orders tag list */}
                {completedOrderNos.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 block">ออเดอร์ที่หยิบเสร็จในรอบนี้:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {completedOrderNos.map(no => (
                        <span key={no} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                          {no}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <Link
                    href="/mobile/orders"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all"
                  >
                    <span>🔍 ส่งต่อโต๊ะตรวจ QC &amp; แพ็กกล่อง (QC Station)</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setActiveWave(null);
                        loadData();
                      }}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      <RotateCcw className="w-4 h-4" /> ดึงรอบหยิบถัดไป
                    </button>
                    <Link
                      href="/mobile"
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                    >
                      🏠 กลับหน้าหลัก
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* List of items in Wave */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                รายการสินค้าในรอบ ({activeWave.items.length})
              </span>
              <div className="space-y-2">
                {activeWave.items.map(it => (
                  <div
                    key={it.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                      it.status === 'PICKED'
                        ? 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                        : it.id === currentTarget?.id
                        ? 'bg-blue-950/30 border-blue-500/40 text-white font-bold shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        it.status === 'PICKED' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {it.status === 'PICKED' ? '✓' : it.pickSequence}
                      </div>
                      <div>
                        <p className="truncate max-w-[180px]">{it.productName}</p>
                        <span className="text-[10px] font-mono text-slate-400">{it.location}</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold">
                      {it.requestedQty} {it.unit || 'ชิ้น'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleBarcodeScan}
        title="สแกนยืนยันหยิบสินค้า"
        description="ส่องกล้องไปที่บาร์โค้ดสินค้าหรือพิกัดชั้นวางเพื่อยืนยันการหยิบ"
      />

      {/* Bottom Sticky Navigation */}
      <MobileNav />
    </div>
  );
}
