'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  ArrowLeft,
  CheckCircle2,
  Truck,
  Camera,
  RefreshCw,
  X,
  Check,
  Scan,
  Printer,
  ShieldCheck,
  PackagePlus,
  PenLine,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileAddItemsModal, { MobileAddItemsOrder } from '@/components/orders/MobileAddItemsModal';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import SignatureModal from '@/components/SignatureModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { triggerHaptic } from '@/lib/voiceAssistant';
import { getApiUrl } from '@/lib/config';
import { extractScannedSku } from '@/lib/scan';
import { errorMessage } from '@/lib/errors';

type Status = 'NEW' | 'PICKING' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface Line {
  sku: string;
  name: string;
  qty: number;
  packedQty?: number;
  done?: boolean;
}

interface Order {
  id: string;
  orderNo: string;
  channel: string;
  customerName: string;
  status: Status;
  priority: string;
  items: Line[];
  totalQty: number;
  totalAmount: number;
  carrier: string;
  trackingNo: string;
  createdAt: string;
  shipAddress: string;
  phone: string;
  notes?: string;
  boxCount?: number;
  weightKg?: number;
  deliveryMode?: 'DELIVERY' | 'SELF_PICKUP';
  tmsJobId?: string;
  tmsStatus?: string;
  vehiclePlate?: string;
  driverName?: string;
  vehicleType?: string;
  dockBay?: string;
}

interface Carrier {
  id: string;
  code: string;
  name: string;
  trackingUrlTemplate: string;
  isDefault: boolean;
}

// กันชื่อสินค้าที่เป็น JSON ดิบ (จาก QR เก่า) หลุดมาแสดง — ดึงชื่อจริงออกมา
function cleanItemName(name?: string): string {
  const t = (name || '').trim();
  if (t.startsWith('{') && t.endsWith('}')) {
    try { const o = JSON.parse(t); return String(o.name || o.productName || o.sku || o.loc || t); } catch { /* noop */ }
  }
  return t;
}

export default function MobileOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'QC' | 'PACK' | 'DISPATCH' | 'SHIPPED'>('QC');
  const [searchQuery, setSearchQuery] = useState('');
  const [qcOrder, setQcOrder] = useState<Order | null>(null);
  const [packingOrder, setPackingOrder] = useState<Order | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [addItemsOrder, setAddItemsOrder] = useState<MobileAddItemsOrder | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Load orders & carriers
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, carRes] = await Promise.all([
        fetch(getApiUrl('/api/orders'), { cache: 'no-store' }),
        fetch(getApiUrl('/api/carriers'), { cache: 'no-store' }).catch(() => null),
      ]);
      const ordJson = await ordRes.json();
      setOrders(ordJson.orders || []);

      if (carRes && carRes.ok) {
        const carJson = await carRes.json();
        setCarriers(carJson.carriers || []);
      }
    } catch {
      toast.error('โหลดข้อมูลออเดอร์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Read tab parameter from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam) {
        const upper = tabParam.toUpperCase();
        if (upper === 'DISPATCH' || upper === 'QC' || upper === 'PACK' || upper === 'SHIPPED') {
          setActiveTab(upper as any);
        }
      }
    }
  }, []);

  const isQcPassed = (o: Order) => Boolean(o.notes?.includes('[QC:PASSED]'));

  // Main barcode scan on list: Find matching order by OrderNo or TrackingNo
  const handleMainBarcodeScan = useCallback((code: string) => {
    const q = code.trim().toLowerCase();
    if (!q) return;

    const match = orders.find(o => 
      o.orderNo.toLowerCase() === q ||
      (o.trackingNo && o.trackingNo.toLowerCase() === q) ||
      o.items.some(it => it.sku.toLowerCase() === q)
    );

    if (match) {
      playScannerAudio('success');
      toast.success(`พบออเดอร์ ${match.orderNo}`);
      setCameraOpen(false);

      if (match.status === 'PICKED') {
        if (isQcPassed(match)) {
          setActiveTab('PACK');
          setPackingOrder(match);
        } else {
          setActiveTab('QC');
          setQcOrder(match);
        }
      } else if (match.status === 'PACKED') {
        setActiveTab('DISPATCH');
        setDispatchOrder(match);
      } else {
        setActiveTab('SHIPPED');
        setSearchQuery(match.orderNo);
      }
      return;
    }

    playScannerAudio('error');
    setCameraOpen(false);
    setSearchQuery(code.trim());
    toast.error(`ไม่พบออเดอร์ที่ตรงกับรหัส "${code}"`);
  }, [orders]);

  const handleRetryTms = async (order: Order) => {
    const t = toast.loading('กำลังส่งงานเข้า TMS...');
    try {
      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'SHIPPED',
          carrier: order.carrier || 'รถขนส่งของบริษัท (จัดส่งเอง)',
          sendToTms: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งงานเข้า TMS ไม่สำเร็จ');
      if (!data.order?.tmsJobId) throw new Error(`ส่งงานเข้า TMS ไม่สำเร็จ (${data.tmsError || data.order?.tmsDispatchError || 'ไม่พบ TMS Job ID'})`);
      toast.success(`ส่งงาน ${order.orderNo} เข้า TMS (${data.order.tmsJobId}) เรียบร้อย!`, { id: t });
      loadData();
    } catch (e) {
      toast.error(errorMessage(e) || 'ไม่สามารถส่งเข้า TMS ได้', { id: t });
    }
  };

  usePdaScanner({
    onScan: handleMainBarcodeScan,
    enabled: !qcOrder && !packingOrder && !dispatchOrder && !cameraOpen && !addItemsOrder,
    playSound: false,
  });

  // Segregate by real fulfillment lifecycle
  const qcOrders = orders.filter(o => o.status === 'PICKED' && !isQcPassed(o));
  const packOrders = orders.filter(o => o.status === 'PICKED' && isQcPassed(o));
  const dispatchOrders = orders.filter(o => o.status === 'PACKED');
  const shippedOrders = orders.filter(o => o.status === 'SHIPPED');

  const currentTabOrders = (
    activeTab === 'QC' ? qcOrders :
    activeTab === 'PACK' ? packOrders :
    activeTab === 'DISPATCH' ? dispatchOrders :
    shippedOrders
  ).filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNo.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.trackingNo && o.trackingNo.toLowerCase().includes(q)) ||
      o.items.some(i => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 pb-28 font-sans select-none">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/mobile"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs active:scale-95 transition-all shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-bold text-base text-slate-900 leading-tight truncate">สถานี QC &amp; จัดส่ง (Fulfillment)</h1>
                <p className="text-[11px] text-slate-600 truncate">ตรวจความถูกต้อง แพ็กกล่อง และส่งมอบขนส่ง</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCameraOpen(true)}
                className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm transition-all font-mono"
              >
                <Camera className="w-4 h-4" />
                <span>สแกนกล้อง</span>
              </button>
              <button
                onClick={loadData}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-white/90 border border-slate-200/80 text-slate-600 hover:text-slate-900 shadow-xs active:scale-95 transition-all"
                aria-label="รีเฟรช"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search & Barcode Status */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเลขออเดอร์, Tracking, หรือลูกค้า..."
                className="w-full min-h-[44px] bg-white/90 border border-slate-200/80 rounded-full pl-10 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="min-h-[44px] px-3 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PDA พร้อม
            </div>
          </div>
        </div>
      </header>

      {/* Status Tabs (4 Dedicated Steps) */}
      <div className="px-4 max-w-lg mx-auto">
        <div className="nx-glass-card grid grid-cols-4 gap-1 mt-3 p-1.5 rounded-full text-center">
          <button
            onClick={() => setActiveTab('QC')}
            className={`min-h-[40px] py-1.5 px-1 text-[11px] font-bold rounded-full transition-all tabular-nums ${
              activeTab === 'QC'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ตรวจ QC ({qcOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('PACK')}
            className={`min-h-[40px] py-1.5 px-1 text-[11px] font-bold rounded-full transition-all tabular-nums ${
              activeTab === 'PACK'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            รอแพ็ก ({packOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('DISPATCH')}
            className={`min-h-[40px] py-1.5 px-1 text-[11px] font-bold rounded-full transition-all tabular-nums ${
              activeTab === 'DISPATCH'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            รอส่ง ({dispatchOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('SHIPPED')}
            className={`min-h-[40px] py-1.5 px-1 text-[11px] font-bold rounded-full transition-all tabular-nums ${
              activeTab === 'SHIPPED'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ส่งแล้ว ({shippedOrders.length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="nx-glass-card py-14 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            กำลังโหลดรายการออเดอร์...
          </div>
        ) : currentTabOrders.length === 0 ? (
          <div className="nx-glass-card py-14 px-6 text-center text-slate-500 space-y-2">
            <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {searchQuery ? 'ไม่พบออเดอร์ที่ตรงกับการค้นหา' : 
               activeTab === 'QC' ? 'ไม่มีออเดอร์รอตรวจ QC (ต้องมีสินค้าที่หยิบเสร็จแล้ว)' :
               activeTab === 'PACK' ? 'ไม่มีออเดอร์รอแพ็ก (ต้องผ่านการตรวจ QC ก่อน)' :
               activeTab === 'DISPATCH' ? 'ไม่มีออเดอร์รอส่งมอบให้ขนส่ง' : 'ยังไม่มีประวัติการส่งมอบ'}
            </p>
          </div>
        ) : (
          currentTabOrders.map(order => (
            <div
              key={order.id}
              className="nx-glass-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900 text-base tabular-nums">
                      {order.orderNo}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {order.channel || 'Direct'}
                    </span>
                    {isQcPassed(order) && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        QC ผ่านแล้ว
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                    ลูกค้า: {order.customerName || 'ทั่วไป'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-500 block">จำนวน</span>
                  <span className="text-base font-black text-sky-700 tabular-nums">{order.totalQty}</span>
                  <span className="text-[11px] text-slate-500 ml-1">ชิ้น</span>
                </div>
              </div>

              {/* Items preview */}
              <div className="p-3 rounded-2xl bg-white/85 border border-slate-200/80 text-xs space-y-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-700 gap-2">
                    <span className="truncate max-w-[210px] font-medium">• {cleanItemName(it.name)}</span>
                    <span className="font-mono font-semibold text-slate-600 tabular-nums shrink-0">x{it.qty}</span>
                  </div>
                ))}
              </div>

              {/* Dock Bay and Vehicle Tag */}
              {(order.dockBay || order.vehiclePlate) && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  {order.dockBay && (
                    <span className="font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      ท่า: {order.dockBay}
                    </span>
                  )}
                  {order.vehiclePlate && (
                    <span className="font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      รถ: {order.vehiclePlate} {order.driverName ? `(${order.driverName})` : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Tracking info if already packed/shipped */}
              {order.trackingNo && (
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-amber-800 bg-amber-50/90 border border-amber-200 p-2.5 rounded-2xl">
                  <span className="flex items-center gap-1.5 truncate">
                    <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{order.carrier || 'ขนส่ง'}: {order.trackingNo}</span>
                  </span>
                  {order.tmsJobId && (process.env.NEXT_PUBLIC_TMS_APP_URL || process.env.NEXT_PUBLIC_TMS_URL) ? (
                    <a
                      href={`${(process.env.NEXT_PUBLIC_TMS_APP_URL || process.env.NEXT_PUBLIC_TMS_URL || '').replace(/\/$/, '')}/track/${encodeURIComponent(order.tmsJobId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-full bg-sky-600 text-white font-bold text-[10px] shrink-0 active:scale-95 transition-transform font-sans"
                    >
                      TMS: {order.tmsJobId} ↗
                    </a>
                  ) : order.tmsJobId ? (
                    <span className="px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-200 font-bold text-[10px] shrink-0 font-sans">
                      TMS: {order.tmsJobId}
                    </span>
                  ) : (/บริษัท|จัดส่งเอง|fleet/i.test(order.carrier || '') && order.status === 'SHIPPED') ? (
                    <button
                      type="button"
                      onClick={() => handleRetryTms(order)}
                      className="px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] shrink-0 active:scale-95 transition-transform flex items-center gap-1 font-sans"
                    >
                      <span>ส่งเข้า TMS</span>
                    </button>
                  ) : null}
                </div>
              )}

              {/* Action Buttons based on status & QC */}
              {order.status === 'PICKED' && !isQcPassed(order) && (
                <button
                  onClick={() => setQcOrder(order)}
                  className="w-full min-h-[48px] py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" /> เปิดสถานีตรวจสอบ QC (ยิงบาร์โค้ดเช็กสินค้า)
                </button>
              )}

              {order.status === 'PICKED' && isQcPassed(order) && (
                <button
                  onClick={() => setPackingOrder(order)}
                  className="w-full min-h-[48px] py-3 px-4 rounded-full bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15 transition-all"
                >
                  <Package className="w-4 h-4" /> เลือกกล่อง &amp; บันทึกแพ็กพัสดุ (Packing)
                </button>
              )}

              {order.status === 'PACKED' && (
                <button
                  onClick={() => setDispatchOrder(order)}
                  className="w-full min-h-[48px] py-3 px-4 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Truck className="w-4 h-4" /> {order.deliveryMode === 'SELF_PICKUP' ? 'ส่งมอบให้ลูกค้า (รับเอง)' : 'สแกนเลขพัสดุ & ส่งมอบขนส่ง'}
                </button>
              )}

              {order.status === 'SHIPPED' && (
                <div className="flex items-center justify-between gap-2 pt-1 text-xs text-emerald-700">
                  <span className="flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> ส่งมอบให้ขนส่งแล้ว
                  </span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`/print/qc-handover?id=${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] flex items-center gap-1 font-bold"
                    >
                      <Printer className="w-3 h-3" /> ใบ QC
                    </a>
                    <a
                      href={`/print/shipping-label?id=${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 py-1 rounded-full bg-white/90 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] flex items-center gap-1 font-semibold"
                    >
                      <Printer className="w-3 h-3" /> ฉลาก 4x6
                    </a>
                  </div>
                </div>
              )}

              {/* เพิ่มสินค้าเข้าออเดอร์ (ลูกค้าเพิ่มของหลังแพ็ก/จ่ายงานให้รถ) —
                  ปิดเมื่อคนขับส่งเสร็จ (TMS = Completed) แม้ WMS ยังไม่ซิงก์เป็น DELIVERED */}
              {(order.status === 'PACKED' || order.status === 'SHIPPED')
                && (order as any).tmsStatus !== 'Completed'
                && (order as any).tmsStatus !== 'Delivered' && (
                <button
                  onClick={() => setAddItemsOrder({
                    id: order.id,
                    orderNo: order.orderNo,
                    status: order.status,
                    tmsJobId: (order as any).tmsJobId || (order.trackingNo?.startsWith('JOB-') ? order.trackingNo : undefined),
                    destinations: (order as any).destinations,
                  })}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-full bg-white/90 border border-amber-300 hover:bg-amber-50 text-amber-800 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <PackagePlus className="w-4 h-4" /> เพิ่มสินค้าเข้าออเดอร์ (สแกนของเพิ่ม)
                </button>
              )}
            </div>
          ))
        )}
      </main>

      {/* Modal 1: Dedicated QC Inspection Modal */}
      {qcOrder && (
        <MobileQcModal
          order={qcOrder}
          onClose={() => setQcOrder(null)}
          onPassQc={() => {
            const target = qcOrder;
            setQcOrder(null);
            loadData();
            setActiveTab('PACK');
            setPackingOrder(target);
          }}
        />
      )}

      {/* Modal 2: Packing Modal */}
      {packingOrder && (
        <MobilePackingModal
          order={packingOrder}
          onClose={() => setPackingOrder(null)}
          onDone={() => {
            setPackingOrder(null);
            loadData();
            setActiveTab('DISPATCH');
          }}
        />
      )}

      {/* Modal 3: Dispatch / Shipping Tracking Modal */}
      {dispatchOrder && (
        <MobileDispatchModal
          order={dispatchOrder}
          carriers={carriers}
          onClose={() => setDispatchOrder(null)}
          onDone={() => {
            setDispatchOrder(null);
            loadData();
            setActiveTab('SHIPPED');
          }}
        />
      )}

      {/* Global Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleMainBarcodeScan}
        title="สแกนเลขออเดอร์ / บาร์โค้ดพัสดุ"
        description="ส่องกล้องไปที่บาร์โค้ดเพื่อเปิดหน้าต่างแพ็กหรือส่งมอบทันที"
      />

      {/* เพิ่มสินค้าเข้าออเดอร์ (มือถือ) */}
      <MobileAddItemsModal
        order={addItemsOrder}
        onClose={() => setAddItemsOrder(null)}
        onDone={() => loadData()}
      />

      {/* Bottom Sticky Navigation */}
      <MobileNav />
    </div>
  );
}

/**
 * Dedicated Mobile QC Station Modal:
 * Worker inspects picked basket, scanning each item to verify 100% SKU and quantity match.
 */
function MobileQcModal({
  order,
  onClose,
  onPassQc,
}: {
  order: Order;
  onClose: () => void;
  onPassQc: () => void;
}) {
  const [items, setItems] = useState(() => 
    order.items.map(it => ({ ...it, verifiedQty: 0, done: false }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [qcStaffSig, setQcStaffSig] = useState<string>('');
  const [sigOpen, setSigOpen] = useState(false);

  const handleScanItem = (barcode: string) => {
    const q = extractScannedSku(barcode).toLowerCase(); // QR labels encode {name:SKU}
    const idx = items.findIndex(it => it.sku.toLowerCase() === q || it.name.toLowerCase().includes(q));

    if (idx >= 0) {
      playScannerAudio('success');
      triggerHaptic('success');
      setItems(prev => {
        const copy = [...prev];
        const newQty = Math.min(copy[idx].qty, (copy[idx].verifiedQty || 0) + 1);
        copy[idx] = { ...copy[idx], verifiedQty: newQty, done: newQty >= copy[idx].qty };
        return copy;
      });
      toast.success(`✓ ตรวจผ่าน: ${items[idx].name}`);
    } else {
      playScannerAudio('error');
      triggerHaptic('error');
      toast.error(`❌ "${extractScannedSku(barcode)}" ไม่ตรงกับรายการในออเดอร์นี้!`);
    }
  };

  usePdaScanner({
    onScan: handleScanItem,
    enabled: !scannerOpen,
    playSound: false,
  });

  const totalRequired = items.reduce((sum, it) => sum + it.qty, 0);
  const totalVerified = items.reduce((sum, it) => sum + (it.verifiedQty || 0), 0);
  const allItemsVerified = items.every(it => (it.verifiedQty || 0) >= it.qty);

  const handleMarkAllVerified = () => {
    setItems(prev => prev.map(it => ({ ...it, verifiedQty: it.qty, done: true })));
    toast.success('ทำเครื่องหมายตรวจผ่านครบทุกรายการแล้ว');
  };

  const handleApproveQc = async () => {
    setSubmitting(true);
    try {
      const existingNotes = order.notes || '';
      const qcStamp = `[QC:PASSED ${new Date().toLocaleTimeString('th-TH')}]`;
      const updatedNotes = existingNotes.includes('[QC:PASSED') ? existingNotes : `${existingNotes} ${qcStamp}`.trim();

      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          notes: updatedNotes,
          ...(qcStaffSig ? {
            qcSignatures: {
              staffSignature: qcStaffSig,
              staffName: 'เจ้าหน้าที่คลัง / QC',
              signedAt: new Date().toISOString(),
            },
          } : {}),
        }),
      });

      if (!res.ok) throw new Error('บันทึกผล QC ไม่สำเร็จ');
      toast.success(`ออเดอร์ ${order.orderNo} ผ่านการตรวจ QC เรียบร้อย!`);
      onPassQc();
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการบันทึก QC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-lg max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl text-slate-900">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-base truncate tabular-nums">สถานีตรวจ QC: {order.orderNo}</h3>
                <p className="text-xs text-slate-600 truncate tabular-nums">ลูกค้า: {order.customerName} • ตรวจแล้ว {totalVerified}/{totalRequired} ชิ้น</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setScannerOpen(true)}
              className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="เปิดกล้องสแกน QC"
            >
              <Camera className="w-4 h-4" />
              <span>สแกน</span>
            </button>
            <button onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scan instruction banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ยิงบาร์โค้ด หรือ กดปุ่ม +1 เพื่อตรวจสินค้า
          </span>
          <button onClick={handleMarkAllVerified} className="text-emerald-700 underline font-bold text-xs">
            ตรวจผ่านทั้งหมด
          </button>
        </div>

        {/* Quick Barcode Scan / Type Input Bar */}
        <div className="p-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center gap-2">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (quickInput.trim()) {
                handleScanItem(quickInput.trim());
                setQuickInput('');
              }
            }}
            className="flex items-center gap-2 flex-1"
          >
            <div className="relative flex-1">
              <Scan className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickInput}
                onChange={e => setQuickInput(e.target.value)}
                onFocus={(e) => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
                placeholder="สแกน หรือ พิมพ์ SKU แล้วกด Enter..."
                className="w-full min-h-[44px] pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-full transition-all shrink-0"
            >
              ตรวจ
            </button>
          </form>
        </div>

        {/* Items Checklist */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.map((it, idx) => {
            const isDone = (it.verifiedQty || 0) >= it.qty;
            return (
              <div
                key={idx}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  isDone
                    ? 'bg-emerald-50/90 border-emerald-200 text-slate-900'
                    : 'bg-slate-50/90 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 tabular-nums ${
                    isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border border-slate-200 text-slate-600'
                  }`}>
                    {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 leading-snug truncate">{cleanItemName(it.name)}</h4>
                    <span className="text-[10px] font-mono text-slate-500 block mt-0.5">SKU: {it.sku}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right font-mono tabular-nums">
                    <span className={`text-base font-black ${isDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {it.verifiedQty || 0}
                    </span>
                    <span className="text-xs text-slate-500"> / {it.qty}</span>
                  </div>
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => handleScanItem(it.sku)}
                      className="min-h-[36px] px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200 active:scale-95 transition-all"
                      title="คลิกเพื่อตรวจผ่าน +1"
                    >
                      +1
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit QC Pass */}
        <div className="p-4 border-t border-slate-200/80 shrink-0 bg-white/95 space-y-2.5">
          {/* Optional QC Staff Signature */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              {qcStaffSig ? (
                <img src={qcStaffSig} alt="ลายเซ็น QC" className="h-9 w-16 object-contain bg-white border border-emerald-200 rounded-lg px-1 shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <PenLine className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">
                  {qcStaffSig ? '✓ ลงลายเซ็นผู้ตรวจปล่อย QC แล้ว' : 'ลายเซ็นเจ้าหน้าที่ QC (ไม่บังคับ)'}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {qcStaffSig ? 'จะแสดงในใบตรวจปล่อยสินค้า (QC Slip)' : 'หากไม่เซ็น ระบบใช้ตราประทับบาร์โค้ดดิจิทัลแทน'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSigOpen(true)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shrink-0 active:scale-95"
            >
              {qcStaffSig ? 'เซ็นใหม่' : 'เซ็นชื่อ'}
            </button>
          </div>

          <button
            onClick={handleApproveQc}
            disabled={submitting || !allItemsVerified}
            className={`w-full min-h-[48px] py-3.5 px-5 rounded-full font-black text-sm flex items-center justify-center gap-2 transition-all tabular-nums ${
              allItemsVerified
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200'
            }`}
          >
            {submitting ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span>
              {allItemsVerified
                ? 'ผ่านการตรวจ QC ครบถ้วน (ส่งต่อสถานีแพ็กกล่อง)'
                : `กรุณายิงบาร์โค้ดตรวจสินค้าให้ครบ (${totalVerified}/${totalRequired} ชิ้น)`}
            </span>
          </button>
        </div>
      </div>

      <CameraScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanItem}
        title="สแกนตรวจ QC สินค้า"
        description="ส่องกล้องไปที่บาร์โค้ดสินค้าเพื่อตรวจนับทีละชิ้น"
        continuous={true}
      />

      <SignatureModal
        isOpen={sigOpen}
        docNum={`ผู้ตรวจปล่อย QC · ${order.orderNo}`}
        onClose={() => setSigOpen(false)}
        onSave={async (url) => {
          setQcStaffSig(url);
          setSigOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Mobile Packing Station Modal:
 * Worker selects box size, inputs weight, prints shipping label, and completes packaging.
 */
function MobilePackingModal({
  order,
  onClose,
  onDone,
}: {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}) {
  const BOX_SIZES = [
    { code: '00', label: 'กล่อง 00 (เล็ก)' },
    { code: '0', label: 'กล่อง 0' },
    { code: 'A', label: 'กล่อง A' },
    { code: 'B', label: 'กล่อง B' },
    { code: '2A', label: 'กล่อง 2A' },
    { code: 'C', label: 'กล่อง C' },
    { code: 'D', label: 'กล่อง D' },
    { code: 'BAG', label: 'ซองกันน้ำ' },
  ];

  const [selectedBox, setSelectedBox] = useState('A');
  const [weightKg, setWeightKg] = useState('0.5');
  const [boxCount, setBoxCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const handleCommitPack = async (andPrint: boolean = false) => {
    setSubmitting(true);
    try {
      const parsedWeight = parseFloat(weightKg) || 0.5;
      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'PACKED',
          boxCount,
          weightKg: parsedWeight,
          notes: `${order.notes || ''} [Box:${selectedBox}]`.trim(),
        }),
      });

      if (!res.ok) throw new Error('บันทึกการแพ็กไม่สำเร็จ');

      if (andPrint) {
        const printUrl = `/print/shipping-label?id=${order.id}&weight=${parsedWeight}&box=${selectedBox}&boxCount=${boxCount}`;
        window.open(printUrl, '_blank');
        toast.success(`แพ็กออเดอร์ ${order.orderNo} สำเร็จ และเปิดพิมพ์ฉลากแล้ว!`);
      } else {
        toast.success(`แพ็กออเดอร์ ${order.orderNo} สำเร็จ! ย้ายไปสถานีรอส่งมอบ`);
      }
      onDone();
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 pb-36 sm:pb-6 shadow-2xl space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-full bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
              <Package className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base truncate tabular-nums">สถานีแพ็กกล่อง: {order.orderNo}</h3>
              <p className="text-xs text-slate-600 truncate">ลูกค้า: {order.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QC Verified Tag */}
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> ตรวจสอบ QC ผ่านครบถ้วนแล้ว
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-700 tabular-nums">{order.totalQty} ชิ้น</span>
        </div>

        {/* Box Size Picker */}
        <div>
          <label className="text-xs text-slate-700 block mb-1.5 font-bold">เลือกขนาดกล่องพัสดุ (Box Size)</label>
          <div className="grid grid-cols-4 gap-2">
            {BOX_SIZES.map(b => (
              <button
                key={b.code}
                type="button"
                onClick={() => setSelectedBox(b.code)}
                className={`min-h-[44px] py-2 px-1 rounded-full text-xs font-bold border transition-all text-center ${
                  selectedBox === b.code
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {b.code}
              </button>
            ))}
          </div>
        </div>

        {/* Weight & Box Count */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-700 block mb-1 font-bold">น้ำหนักรวม (กก.)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={weightKg}
              onFocus={handleInputFocus}
              onChange={e => setWeightKg(e.target.value)}
              className="w-full min-h-[44px] p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-900 font-mono text-sm tabular-nums focus:outline-none focus:border-emerald-500 font-bold"
            />
          </div>
          <div>
            <label className="text-xs text-slate-700 block mb-1 font-bold">จำนวนกล่อง (ชิ้น)</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={boxCount}
              onFocus={handleInputFocus}
              onChange={e => setBoxCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full min-h-[44px] p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-900 font-mono text-sm tabular-nums focus:outline-none focus:border-emerald-500 font-bold"
            />
          </div>
        </div>

        {/* Print Shipping Label Link (Auto-saves draft & prints) */}
        <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="font-bold text-slate-900 block">พิมพ์ใบปะหน้าพัสดุ (4x6 / A4)</span>
            <span className="text-[10px] text-slate-500">บันทึกขนาด & น้ำหนักทันทีก่อนพิมพ์</span>
          </div>
          <button
            type="button"
            onClick={() => handleCommitPack(true)}
            disabled={submitting}
            className="min-h-[40px] px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded-full flex items-center gap-1.5 border border-sky-200 active:scale-95 transition-all shrink-0"
          >
            <Printer className="w-4 h-4 text-sky-600" />
            <span>พิมพ์ฉลาก</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Primary Warehouse SOP: Pack & Print in one go */}
          <button
            type="button"
            onClick={() => handleCommitPack(true)}
            disabled={submitting}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15 active:scale-[0.98] transition-all"
          >
            {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
            <span>บันทึกแพ็กกล่อง & พิมพ์ฉลาก (PACK & PRINT)</span>
          </button>

          {/* Secondary: Pack Only (without print) */}
          <button
            type="button"
            onClick={() => handleCommitPack(false)}
            disabled={submitting}
            className="w-full min-h-[44px] py-3 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
            <span>บันทึกแพ็กเสร็จสิ้น (ไม่พิมพ์ฉลาก)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface FleetVehicle {
  id: string;
  plate: string;
  driverName: string;
  vehicleType: string;
}

/**
 * Mobile Dispatch Modal:
 * Worker selects courier, assigns company vehicle & driver for TMS, and scans Tracking No. barcode.
 */
function MobileDispatchModal({
  order,
  carriers,
  onClose,
  onDone
}: {
  order: Order;
  carriers: Carrier[];
  onClose: () => void;
  onDone: () => void;
}) {
  const isPickup = order.deliveryMode === 'SELF_PICKUP';
  const [carrier, setCarrier] = useState(order.carrier || (carriers[0]?.name || 'Flash Express'));
  const isFleet = /บริษัท|จัดส่งเอง|fleet/i.test(carrier);

  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState(order.vehiclePlate || '');
  const [driverName, setDriverName] = useState(order.driverName || '');
  const [vehicleType, setVehicleType] = useState(order.vehicleType || '4-Wheel');
  const [dockBay, setDockBay] = useState(order.dockBay || '');
  const [shipAddress, setShipAddress] = useState(order.shipAddress || '');
  const [trackingNo, setTrackingNo] = useState(order.trackingNo || (isFleet ? order.orderNo : ''));
  const [submitting, setSubmitting] = useState(false);
  const [scanCamOpen, setScanCamOpen] = useState(false);

  useEffect(() => {
    fetch(getApiUrl('/api/fleet-vehicles?active=1'), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.vehicles && Array.isArray(d.vehicles) && d.vehicles.length > 0) {
          setVehicles(d.vehicles);
          // Auto-select first matching or default vehicle if not set
          if (!order.vehiclePlate && d.vehicles[0]) {
            const v = d.vehicles[0];
            setSelectedVehicleId(v.id);
            setVehiclePlate(v.plate);
            setDriverName(v.driverName || '');
            setVehicleType(v.vehicleType || '4-Wheel');
          }
        }
      })
      .catch(() => {});
  }, [order.vehiclePlate]);

  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    const v = vehicles.find(x => x.id === id);
    if (v) {
      setVehiclePlate(v.plate);
      setDriverName(v.driverName || '');
      setVehicleType(v.vehicleType || '4-Wheel');
    }
  };

  const handleScanTracking = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    playScannerAudio('success');
    triggerHaptic('success');
    setTrackingNo(clean);
    setScanCamOpen(false);
    toast.success(`สแกนเลขพัสดุ: ${clean}`);
  };

  usePdaScanner({
    onScan: handleScanTracking,
    enabled: !scanCamOpen,
    playSound: false,
  });

  const handleCommitDispatch = async () => {
    // 3PL courier must have a tracking number
    if (!isPickup && !isFleet && !trackingNo.trim()) {
      toast.error('กรุณาระบุหรือสแกนเลขพัสดุ (Tracking No.)');
      return;
    }

    setSubmitting(true);
    try {
      const finalTracking = isFleet
        ? (trackingNo.trim() || order.orderNo)
        : trackingNo.trim();

      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'SHIPPED',
          carrier: isPickup ? 'ลูกค้ารับเอง' : carrier,
          trackingNo: isPickup ? '' : finalTracking,
          vehiclePlate: isFleet ? vehiclePlate.trim() : undefined,
          driverName: isFleet ? driverName.trim() : undefined,
          vehicleType: isFleet ? vehicleType : undefined,
          dockBay: dockBay || undefined,
          shipAddress: isFleet && shipAddress.trim() ? shipAddress.trim() : undefined,
          sendToTms: isFleet,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'บันทึกส่งมอบไม่สำเร็จ');
      if (isFleet) {
        if (data.order?.tmsJobId) {
          toast.success(`ส่งมอบ ${order.orderNo} ให้รถบริษัท (${vehiclePlate || 'จัดส่งเอง'}) และสร้างงานเข้า TMS (${data.order.tmsJobId}) เรียบร้อย!`);
        } else {
          toast.error(`ส่งมอบ ${order.orderNo} แล้ว แต่ส่งงานเข้า TMS ไม่สำเร็จ (${data.tmsError || data.order?.tmsDispatchError || 'ตรวจสอบการเชื่อมต่อ TMS'})`, { duration: 6000 });
        }
      } else {
        toast.success(isPickup ? `ส่งมอบ ${order.orderNo} ให้ลูกค้ารับเองแล้ว!` : `ส่งมอบ ${order.orderNo} ให้ ${carrier} เรียบร้อย!`);
      }
      onDone();
    } catch (e) {
      toast.error(errorMessage(e) || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 pb-36 sm:pb-6 shadow-2xl space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              <Truck className="w-5 h-5" />
            </span>
            <h3 className="font-bold text-slate-900 text-base truncate tabular-nums">{isPickup ? 'ส่งมอบให้ลูกค้า (รับเอง)' : 'ส่งมอบขนส่ง'}: {order.orderNo}</h3>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:text-slate-900 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isPickup && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 font-semibold flex items-center gap-2">
            ลูกค้ารับเอง — ไม่ต้องเลือกขนส่ง/เลขพัสดุ กดยืนยันเมื่อส่งมอบให้ลูกค้าแล้ว
          </div>
        )}

        {/* Dock Bay Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            ท่าเทียบ / จุดวางพักรอขึ้นรถ (Dock Bay)
          </label>
          <select
            value={dockBay}
            onChange={e => setDockBay(e.target.value)}
            className="w-full min-h-[44px] bg-white rounded-2xl px-3.5 py-2.5 text-xs font-bold text-amber-900 border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">-- ไม่ระบุ Dock (จัดส่งทั่วไป) --</option>
            <option value="BAY-01">BAY-01 (Inbound / จุดรับเข้า)</option>
            <option value="BAY-02">BAY-02 (Outbound / ท่าโหลดสายใต้)</option>
            <option value="BAY-03">BAY-03 (Outbound / ท่าโหลดทั่วไป)</option>
            <option value="DOCK-01">DOCK-01 (ท่าโหลด 1)</option>
            <option value="DOCK-02">DOCK-02 (ท่าโหลด 2)</option>
            <option value="STAGING-A">STAGING-A (ลานพักรอโหลด A)</option>
            <option value="STAGING-B">STAGING-B (ลานพักรอโหลด B)</option>
          </select>
        </div>

        {/* Courier Select */}
        {!isPickup && (<>
        <div>
          <label className="text-xs text-slate-700 block mb-1.5 font-semibold">ผู้ให้บริการขนส่ง (Carrier)</label>
          <select
            value={carrier}
            onChange={e => {
              const val = e.target.value;
              setCarrier(val);
              if (/บริษัท|จัดส่งเอง|fleet/i.test(val) && !trackingNo) {
                setTrackingNo(order.orderNo);
              }
            }}
            className="w-full min-h-[44px] p-3 rounded-2xl bg-white border border-slate-200 text-slate-900 font-bold text-sm focus:outline-none focus:border-amber-500"
          >
            {carriers.length > 0 ? (
              carriers.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))
            ) : (
              <>
                <option value="รถขนส่งของบริษัท (จัดส่งเอง)">รถขนส่งของบริษัท (จัดส่งเอง)</option>
                <option value="Flash Express">Flash Express</option>
                <option value="Kerry Express">Kerry Express (KEX)</option>
                <option value="J&T Express">J&T Express</option>
                <option value="Thailand Post">ไปรษณีย์ไทย (EMS)</option>
                <option value="SPX Express">SPX Express (Shopee)</option>
                <option value="Lazada Logistics">Lazada Logistics (LEX)</option>
              </>
            )}
          </select>
        </div>

        {/* Company Fleet TMS Vehicle & Driver Section */}
        {isFleet && (
          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-sky-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-sky-600" /> มอบหมายรถและคนขับ (เชื่อมต่อ TMS)
              </span>
              <span className="text-[10px] bg-sky-600 text-white font-bold px-2.5 py-0.5 rounded-full">TMS Auto-Job</span>
            </div>

            {/* Vehicle Selector */}
            <div>
              <label className="text-xs text-sky-900 block mb-1 font-bold">เลือกรถในระบบ (ทะเบียนรถ)</label>
              {vehicles.length > 0 ? (
                <select
                  value={selectedVehicleId}
                  onChange={e => handleSelectVehicle(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 rounded-2xl bg-white border border-sky-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-sky-500 mb-1.5"
                >
                  <option value="">-- เลือกรถในระบบ หรือกรอกด้านล่าง --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plate} ({v.driverName ? `${v.driverName} - ` : ''}{v.vehicleType || '4 ล้อ'})
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                type="text"
                value={vehiclePlate}
                onChange={e => setVehiclePlate(e.target.value)}
                placeholder="ระบุทะเบียนรถ เช่น 1กข-9999 สุราษฎร์ธานี"
                className="w-full min-h-[44px] p-2.5 rounded-2xl bg-white border border-sky-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Driver Name & Vehicle Type */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-sky-900 block mb-1 font-bold">ชื่อคนขับ</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                  placeholder="ระบุชื่อคนขับรถ..."
                  className="w-full min-h-[44px] p-2.5 rounded-2xl bg-white border border-sky-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-sky-900 block mb-1 font-bold">ประเภทรถ</label>
                <select
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 rounded-2xl bg-white border border-sky-200 text-slate-900 font-bold text-xs focus:outline-none focus:border-sky-500"
                >
                  <option value="4-Wheel">กระบะ 4 ล้อ</option>
                  <option value="6-Wheel">บรรทุก 6 ล้อ</option>
                  <option value="10-Wheel">บรรทุก 10 ล้อ</option>
                  <option value="Trailer">เทรลเลอร์</option>
                  <option value="Motorcycle">มอเตอร์ไซค์</option>
                </select>
              </div>
            </div>

            {/* Destination Address (Critical for TMS navigation) */}
            <div>
              <label className="text-xs text-sky-900 block mb-1 font-bold flex items-center justify-between">
                <span>ที่อยู่จัดส่งปลายทาง (ส่งพิกัดให้คนขับ)</span>
                {!shipAddress.trim() && (
                  <span className="text-[10px] text-amber-700 font-bold">ยังไม่มีที่อยู่</span>
                )}
              </label>
              <textarea
                value={shipAddress}
                onChange={e => setShipAddress(e.target.value)}
                placeholder="กรอกที่อยู่ปลายทางสำหรับคนขับนำทางในแอป TMS..."
                rows={2}
                className="w-full p-2.5 rounded-2xl bg-white border border-sky-200 text-slate-900 font-medium text-xs focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Tracking Number Input + Scan */}
        <div>
          <label className="text-xs text-slate-700 block mb-1.5 font-semibold">
            {isFleet ? 'เลขที่พัสดุ / รหัสงาน (Tracking / Job)' : 'เลขพัสดุ (Tracking No.)'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={trackingNo}
              onChange={e => setTrackingNo(e.target.value)}
              onFocus={(e) => setTimeout(() => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)}
              placeholder={isFleet ? `เช่น ${order.orderNo}` : 'สแกนหรือพิมพ์เลขพัสดุ...'}
              className="flex-1 min-h-[48px] px-4 py-3 rounded-full bg-white border border-slate-200 font-mono text-amber-700 font-black text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => setScanCamOpen(true)}
              className="min-h-[48px] min-w-[48px] p-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center active:scale-95 shadow-sm"
              title="สแกนบาร์โค้ด Tracking"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {isFleet
              ? '• รถบริษัท: ระบบจะใช้เลขออเดอร์สร้างงานใน TMS อัตโนมัติ (หรือจะยิงเลขบาร์โค้ดก็ได้)'
              : '• ขนส่งเอกชน: กดปุ่มกล้อง หรือใช้ปืนยิงบาร์โค้ดสแกนเลขจากใบปะหน้า Flash/Kerry'}
          </p>
        </div>
        </>)}

        {/* Submit */}
        <button
          onClick={handleCommitDispatch}
          disabled={submitting}
          className="w-full min-h-[48px] py-3.5 px-5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
        >
          {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
          <span>{isPickup ? 'ยืนยันลูกค้ารับสินค้าแล้ว' : isFleet ? 'ยืนยันส่งมอบ & สร้างงานเข้า TMS' : 'ยืนยันส่งมอบให้ขนส่ง (SHIPPED)'}</span>
        </button>
      </div>

      <CameraScannerModal
        isOpen={scanCamOpen}
        onClose={() => setScanCamOpen(false)}
        onScan={handleScanTracking}
        title="สแกนบาร์โค้ดเลขพัสดุ (Tracking)"
        description="ส่องกล้องไปที่บาร์โค้ดเลขพัสดุบนใบปะหน้ากล่อง"
      />
    </div>
  );
}
