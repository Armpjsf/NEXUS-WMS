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
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { triggerHaptic } from '@/lib/voiceAssistant';
import { getApiUrl } from '@/lib/config';

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
}

interface Carrier {
  id: string;
  code: string;
  name: string;
  trackingUrlTemplate: string;
  isDefault: boolean;
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

  usePdaScanner({
    onScan: handleMainBarcodeScan,
    enabled: !qcOrder && !packingOrder && !dispatchOrder && !cameraOpen,
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/mobile" 
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-base text-slate-900 leading-tight">สถานี QC &amp; จัดส่ง (Fulfillment)</h1>
              <p className="text-[11px] text-slate-500">ตรวจความถูกต้อง แพ็กกล่อง และส่งมอบขนส่ง</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCameraOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>สแกนกล้อง</span>
            </button>
            <button
              onClick={loadData}
              className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Barcode Status */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลขออเดอร์, Tracking, หรือลูกค้า..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="px-2.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-mono text-blue-600 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            PDA พร้อม
          </div>
        </div>

        {/* Status Tabs (4 Dedicated Steps) */}
        <div className="grid grid-cols-4 gap-1 mt-3 p-1 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <button
            onClick={() => setActiveTab('QC')}
            className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              activeTab === 'QC'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            ตรวจ QC ({qcOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('PACK')}
            className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              activeTab === 'PACK'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            รอแพ็ก ({packOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('DISPATCH')}
            className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              activeTab === 'DISPATCH'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            รอส่ง ({dispatchOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('SHIPPED')}
            className={`py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              activeTab === 'SHIPPED'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            ส่งแล้ว ({shippedOrders.length})
          </button>
        </div>
      </header>

      {/* Orders List */}
      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
            กำลังโหลดรายการออเดอร์...
          </div>
        ) : currentTabOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Package className="w-12 h-12 mx-auto text-slate-700" />
            <p className="text-sm font-semibold text-slate-500">
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
              className="p-4 rounded-2xl bg-white/90 border border-slate-200 hover:border-slate-200 shadow-md space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {order.orderNo}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {order.channel || 'Direct'}
                    </span>
                    {isQcPassed(order) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 border border-teal-200">
                        QC ผ่านแล้ว
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    ลูกค้า: {order.customerName || 'ทั่วไป'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">จำนวน</span>
                  <span className="text-base font-black text-blue-600">{order.totalQty}</span>
                  <span className="text-[11px] text-slate-500 ml-1">ชิ้น</span>
                </div>
              </div>

              {/* Items preview */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-600">
                    <span className="truncate max-w-[200px]">• {it.name}</span>
                    <span className="font-mono text-slate-500">x{it.qty}</span>
                  </div>
                ))}
              </div>

              {/* Tracking info if already packed/shipped */}
              {order.trackingNo && (
                <div className="flex items-center justify-between text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    {order.carrier || 'ขนส่ง'}: {order.trackingNo}
                  </span>
                </div>
              )}

              {/* Action Buttons based on status & QC */}
              {order.status === 'PICKED' && !isQcPassed(order) && (
                <button
                  onClick={() => setQcOrder(order)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" /> เปิดสถานีตรวจสอบ QC (ยิงบาร์โค้ดเช็กสินค้า)
                </button>
              )}

              {order.status === 'PICKED' && isQcPassed(order) && (
                <button
                  onClick={() => setPackingOrder(order)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                >
                  <Package className="w-4 h-4" /> เลือกกล่อง &amp; บันทึกแพ็กพัสดุ (Packing)
                </button>
              )}

              {order.status === 'PACKED' && (
                <button
                  onClick={() => setDispatchOrder(order)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all"
                >
                  <Truck className="w-4 h-4" /> สแกนเลขพัสดุ &amp; ส่งมอบขนส่ง
                </button>
              )}

              {order.status === 'SHIPPED' && (
                <div className="flex items-center justify-between pt-1 text-xs text-emerald-600">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> ส่งมอบให้ขนส่งแล้ว
                  </span>
                  <a
                    href={`/print/shipping-label?id=${order.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" /> ฉลาก 4x6
                  </a>
                </div>
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

  const handleScanItem = (barcode: string) => {
    const q = barcode.trim().toLowerCase();
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
      toast.error(`❌ บาร์โค้ด "${barcode}" ไม่ตรงกับรายการในออเดอร์นี้!`);
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
        }),
      });

      if (!res.ok) throw new Error('บันทึกผล QC ไม่สำเร็จ');
      toast.success(`ออเดอร์ ${order.orderNo} ผ่านการตรวจ QC เรียบร้อย!`);
      onPassQc();
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาดในการบันทึก QC');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-100 text-teal-600 border border-teal-200">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">สถานีตรวจ QC: {order.orderNo}</h3>
                <p className="text-xs text-slate-500">ลูกค้า: {order.customerName} • ตรวจแล้ว {totalVerified}/{totalRequired} ชิ้น</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shadow-md shadow-teal-600/30"
              title="เปิดกล้องสแกน QC"
            >
              <Camera className="w-4 h-4" />
              <span>สแกน</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scan instruction banner */}
        <div className="bg-teal-50 border-b border-teal-200 px-4 py-2 text-xs text-teal-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            ยิงบาร์โค้ด หรือ กดปุ่ม +1 เพื่อตรวจสินค้า
          </span>
          <button onClick={handleMarkAllVerified} className="text-teal-600 underline font-bold text-xs">
            ตรวจผ่านทั้งหมด
          </button>
        </div>

        {/* Quick Barcode Scan / Type Input Bar */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
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
              <Scan className="w-4 h-4 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={quickInput}
                onChange={e => setQuickInput(e.target.value)}
                placeholder="สแกน หรือ พิมพ์ SKU แล้วกด Enter..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-500 font-mono focus:outline-none focus:border-teal-500 font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shrink-0"
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
                    ? 'bg-teal-50 border-teal-200 text-slate-900 shadow-xs' 
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isDone ? 'bg-teal-100 text-teal-600 border border-teal-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs leading-snug">{it.name}</h4>
                    <span className="text-[10px] font-mono text-slate-500 block mt-0.5">SKU: {it.sku}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right font-mono">
                    <span className={`text-base font-black ${isDone ? 'text-teal-600' : 'text-amber-600'}`}>
                      {it.verifiedQty || 0}
                    </span>
                    <span className="text-xs text-slate-500"> / {it.qty}</span>
                  </div>
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => handleScanItem(it.sku)}
                      className="px-2.5 py-1.5 bg-teal-100 hover:bg-teal-500/30 text-teal-700 rounded-lg text-xs font-bold border border-teal-200 active:scale-95 transition-all"
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
        <div className="p-4 border-t border-slate-200 shrink-0 bg-white">
          <button
            onClick={handleApproveQc}
            disabled={submitting || !allItemsVerified}
            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              allItemsVerified
                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 text-white shadow-xl shadow-teal-600/30 active:scale-[0.98]'
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
                ? '✓ ผ่านการตรวจ QC ครบถ้วน (ส่งต่อสถานีแพ็กกล่อง)' 
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

  const handleCommitPack = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'PACKED',
          boxCount,
          weightKg: parseFloat(weightKg) || 0.5,
          notes: `${order.notes || ''} [Box:${selectedBox}]`.trim(),
        }),
      });

      if (!res.ok) throw new Error('บันทึกการแพ็กไม่สำเร็จ');
      toast.success(`แพ็กออเดอร์ ${order.orderNo} สำเร็จ! ย้ายไปสถานีรอส่งมอบ`);
      onDone();
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-600 border border-blue-200">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">สถานีแพ็กกล่อง: {order.orderNo}</h3>
              <p className="text-xs text-slate-500">ลูกค้า: {order.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QC Verified Tag */}
        <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4 text-teal-600" /> ตรวจสอบ QC ผ่านครบถ้วนแล้ว
          </span>
          <span className="text-[11px] font-mono font-bold text-teal-600">{order.totalQty} ชิ้น</span>
        </div>

        {/* Box Size Picker */}
        <div>
          <label className="text-xs text-slate-500 block mb-1.5 font-bold">เลือกขนาดกล่องพัสดุ (Box Size)</label>
          <div className="grid grid-cols-4 gap-2">
            {BOX_SIZES.map(b => (
              <button
                key={b.code}
                type="button"
                onClick={() => setSelectedBox(b.code)}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center ${
                  selectedBox === b.code
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-200'
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
            <label className="text-xs text-slate-500 block mb-1 font-bold">น้ำหนักรวม (กก.)</label>
            <input
              type="number"
              step="0.01"
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-500 font-bold"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1 font-bold">จำนวนกล่อง (ชิ้น)</label>
            <input
              type="number"
              min="1"
              value={boxCount}
              onChange={e => setBoxCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-500 font-bold"
            />
          </div>
        </div>

        {/* Print Shipping Label Link */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="text-xs">
            <span className="font-bold text-slate-900 block">พิมพ์ใบปะหน้าพัสดุ</span>
            <span className="text-[10px] text-slate-500">ขนาด 4x6 นิ้ว หรือ A4</span>
          </div>
          <a
            href={`/print/shipping-label?id=${order.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-200"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>พิมพ์ฉลาก</span>
          </a>
        </div>

        {/* Submit Commit Pack */}
        <button
          onClick={handleCommitPack}
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 active:scale-[0.98] transition-all"
        >
          {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>ยืนยันแพ็กกล่องเสร็จสิ้น (PACKED)</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Mobile Dispatch Modal:
 * Worker selects courier and scans Tracking No. barcode directly at the dock.
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
  const [carrier, setCarrier] = useState(order.carrier || (carriers[0]?.name || 'Flash Express'));
  const [trackingNo, setTrackingNo] = useState(order.trackingNo || '');
  const [submitting, setSubmitting] = useState(false);
  const [scanCamOpen, setScanCamOpen] = useState(false);

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
    if (!trackingNo.trim()) {
      toast.error('กรุณาระบุหรือสแกนเลขพัสดุ (Tracking No.)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: 'SHIPPED',
          carrier,
          trackingNo: trackingNo.trim(),
        }),
      });

      if (!res.ok) throw new Error('บันทึกส่งมอบไม่สำเร็จ');
      toast.success(`ส่งมอบ ${order.orderNo} ให้ ${carrier} เรียบร้อย!`);
      onDone();
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-base">ส่งมอบขนส่ง: {order.orderNo}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Courier Select */}
        <div>
          <label className="text-xs text-slate-500 block mb-1.5 font-semibold">ผู้ให้บริการขนส่ง (Carrier)</label>
          <select
            value={carrier}
            onChange={e => setCarrier(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-sm focus:outline-none focus:border-amber-500"
          >
            {carriers.length > 0 ? (
              carriers.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))
            ) : (
              <>
                <option value="Flash Express">Flash Express</option>
                <option value="Kerry Express">Kerry Express (KEX)</option>
                <option value="J&T Express">J&T Express</option>
                <option value="Thailand Post">ไปรษณีย์ไทย (EMS)</option>
                <option value="SPX Express">SPX Express (Shopee)</option>
                <option value="Lazada Logistics">Lazada Logistics (LEX)</option>
                <option value="รถบริษัทส่งเอง">รถบริษัทส่งเอง (Own Fleet)</option>
              </>
            )}
          </select>
        </div>

        {/* Tracking Number Input + Scan */}
        <div>
          <label className="text-xs text-slate-500 block mb-1.5 font-semibold">
            เลขพัสดุ (Tracking No.)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={trackingNo}
              onChange={e => setTrackingNo(e.target.value)}
              placeholder="สแกนหรือพิมพ์เลขพัสดุ..."
              className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-amber-600 font-black text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => setScanCamOpen(true)}
              className="p-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center active:scale-95 shadow-md shadow-amber-600/30"
              title="สแกนบาร์โค้ด Tracking"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            • กดปุ่มกล้อง หรือใช้ปืนยิงบาร์โค้ดสแกนเลขจากใบปะหน้า Flash/Kerry ได้ทันที
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleCommitDispatch}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 active:scale-[0.98] transition-all"
        >
          {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
          <span>ยืนยันส่งมอบให้ขนส่ง (SHIPPED)</span>
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
