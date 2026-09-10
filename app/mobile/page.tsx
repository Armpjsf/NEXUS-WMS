'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  PackagePlus, 
  Boxes, 
  ClipboardCheck, 
  Search, 
  Truck, 
  Camera, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Scan, 
  Layers, 
  Clock, 
  ExternalLink, 
  ChevronRight, 
  PackageMinus, 
  Sparkles, 
  MapPin, 
  X,
  ShieldCheck,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';

interface ProductLookup {
  id?: string;
  name: string;
  sku?: string;
  stock?: number;
  location?: string;
  category?: string;
  unit?: string;
  price?: number;
}

export default function MobileHubPage() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<ProductLookup | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string>('');

  // Fetch product list for instant offline-like fast lookup
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/products'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
        setIsOnline(true);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setLastSync(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle barcode scanned via Camera or PDA Laser Gun
  const handleBarcodeIdentified = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return;

    setScannedCode(clean);

    // Try finding matching product by SKU, barcode, or name
    const match = products.find(p => 
      p.sku?.toLowerCase() === clean.toLowerCase() ||
      p.name?.toLowerCase() === clean.toLowerCase() ||
      (p as any).barcode?.toLowerCase() === clean.toLowerCase()
    );

    if (match) {
      playScannerAudio('success');
      setMatchedProduct(match);
    } else {
      playScannerAudio('error');
      setMatchedProduct(null);
    }

    setScanModalOpen(true);
  }, [products]);

  // Hardware Laser Scanner (PDA)
  const { data: session } = useSession();
  const user = session?.user as any;
  const userRole: string = user?.role || 'Staff';
  const userName: string = user?.name || 'พนักงานคลัง';

  // Hardware Laser Scanner (PDA)
  usePdaScanner({
    onScan: handleBarcodeIdentified,
    enabled: !cameraOpen,
    playSound: false,
  });

  const allWorkflows = [
    {
      id: 'inbound',
      section: 'Staff - Inbound',
      title: 'รับสินค้าเข้า (Inbound)',
      subtitle: 'สแกนตรวจนับ PO / จัดเก็บขึ้นชั้นวาง (Putaway)',
      icon: PackagePlus,
      href: '/mobile/receiving',
      color: 'from-emerald-600 to-teal-700',
      tag: 'รับเข้าคลัง',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    {
      id: 'wave-picking',
      section: 'Staff - Picker',
      title: 'หยิบสินค้า (Wave Picking)',
      subtitle: 'เดินหยิบตาม S-Shape มีเสียงภาษาไทยนำทาง',
      icon: Boxes,
      href: '/mobile/picking',
      color: 'from-blue-600 to-indigo-700',
      tag: 'คำสั่งหยิบรวม',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      id: 'qc-orders',
      section: 'Staff - QC & Pack',
      title: 'ตรวจ QC & แพ็กกล่อง (QC & Packing)',
      subtitle: 'สแกนตรวจความถูกต้อง QC และแพ็กกล่องพิมพ์ใบปะหน้า',
      icon: ShieldCheck,
      href: '/mobile/orders',
      color: 'from-teal-600 to-cyan-700',
      tag: 'สถานี QC & แพ็ก',
      border: 'border-teal-200',
      iconBg: 'bg-teal-100 text-teal-600',
    },
    {
      id: 'dispatch',
      section: 'Staff - Dispatch',
      title: 'ส่งมอบขนส่ง (Courier Dispatch)',
      subtitle: 'ยิงเลขพัสดุ ส่ง Kerry/Flash/SPX และบันทึกเวลาส่ง',
      icon: Truck,
      href: '/mobile/orders?tab=dispatch',
      color: 'from-orange-600 to-amber-700',
      tag: 'ส่งมอบขนส่ง',
      border: 'border-orange-200',
      iconBg: 'bg-orange-100 text-orange-600',
    },
    {
      id: 'cycle-count',
      section: 'Staff - Inventory',
      title: 'ตรวจนับสต็อก (Cycle Count)',
      subtitle: 'ตรวจนับสินค้าตามโซน/เชลฟ์ บันทึกส่วนต่าง',
      icon: ClipboardCheck,
      href: '/mobile/cycle-count',
      color: 'from-amber-600 to-orange-700',
      tag: 'เช็กสต็อก',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    {
      id: 'inventory-lookup',
      section: 'all',
      title: 'ค้นหาพิกัด & สต็อก (Lookup)',
      subtitle: 'สแกนหรือพิมพ์เพื่อดู Location และยอดคงเหลือ',
      icon: Search,
      href: '/mobile/inventory',
      color: 'from-purple-600 to-violet-700',
      tag: 'ค้นหาด่วน',
      border: 'border-purple-500/30',
      iconBg: 'bg-purple-500/20 text-purple-400',
    },
  ];

  // Re-order based on role
  const isSectionStaff = userRole.startsWith('Staff - ');
  const myWorkflows = isSectionStaff
    ? allWorkflows.filter(w => w.section === userRole || w.section === 'all')
    : allWorkflows;
  const otherWorkflows = isSectionStaff
    ? allWorkflows.filter(w => w.section !== userRole && w.section !== 'all')
    : [];

  const secondaryWorkflows = [
    {
      id: 'driver-jobs',
      title: 'คนขับรถส่งของ (Driver POD)',
      desc: 'อัปโหลดรูปถ่ายและลายเซ็นผู้รับสินค้า',
      icon: Truck,
      href: '/mobile/jobs',
      badge: 'Delivery',
    },
    {
      id: 'quick-adjust',
      title: 'ปรับสต็อกด่วน (Quick Adjust)',
      desc: 'สแกนแล้วกด +/- ปรับยอดจริงหน้างาน',
      icon: RefreshCw,
      href: '/mobile/adjust',
      badge: 'Adjust',
    },
    {
      id: 'damage-report',
      title: 'แจ้งสินค้าชำรุด (Report Damage)',
      desc: 'ถ่ายรูป ตัดจ่ายของชำรุดออกจากสต็อก',
      icon: AlertCircle,
      href: '/mobile/damage',
      badge: 'Damage',
    },
    {
      id: 'putaway',
      title: 'จัดเก็บขึ้นชั้น (Putaway)',
      desc: 'สแกนสินค้าและสแกนชั้นวางยืนยันพิกัด',
      icon: Layers,
      href: '/mobile/putaway',
      badge: 'Putaway',
    },
    {
      id: 'returns',
      title: 'รับคืนสินค้า (RMA Returns)',
      desc: 'ตรวจสภาพสินค้าคืนและรับเข้าสต็อก',
      icon: RotateCcw,
      href: '/mobile/returns',
      badge: 'Returns',
    },
    {
      id: 'outbound-issue',
      title: 'เบิกจ่ายตรง / ใช้ภายใน',
      desc: 'เบิกกล่อง เทป หรือตัวอย่างสินค้า',
      icon: PackageMinus,
      href: '/mobile/outbound',
      badge: 'Direct Issue',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 font-sans select-none">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl overflow-hidden p-0.5 flex items-center justify-center">
              <img src="/nexus-icon.png" alt="NEXUS WMS" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-base text-slate-900 tracking-tight leading-tight">NEXUS Mobile</h1>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-slate-500" /> อัปเดต {lastSync || 'กำลังซิงค์...'}
              </p>
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
              title="รีเฟรชข้อมูล"
              className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {/* User Role & Department Badge */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-xs leading-tight">{userName}</p>
              <p className="text-[11px] text-slate-500">บทบาท: <strong className="text-blue-600">{userRole}</strong></p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {isSectionStaff ? userRole.replace('Staff - ', 'แผนก: ') : 'ทุกแผนก (All Sections)'}
          </span>
        </div>

        {/* Instant Scanner Hero Banner */}
        <div 
          onClick={() => setCameraOpen(true)}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-white border border-blue-200 p-4 shadow-xl active:scale-[0.99] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>PDA & กล้องสแกนด่วน</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                แตะเพื่อสแกนบาร์โค้ด
              </h2>
              <p className="text-xs text-slate-500">
                หรือกดไกปืน Laser Gun ยิงสินค้า/พิกัดได้ทันที
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
              <Scan className="w-7 h-7 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Core Operations Cards */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isSectionStaff ? 'งานประจำแผนกของคุณ' : 'งานปฏิบัติการหลักคลังสินค้า'}
            </span>
            <span className="text-[11px] text-slate-500">
              {myWorkflows.length} รายการ
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {myWorkflows.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`group relative flex items-center justify-between p-4 rounded-2xl bg-white border ${item.border} hover:bg-slate-100 active:scale-[0.98] transition-all shadow-md`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0 shadow-inner`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-700 transition-colors">
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:bg-slate-200 transition-all shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Other Sections (if section staff) */}
        {otherWorkflows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1 mt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">งานแผนกอื่นๆ</span>
              <span className="text-[11px] text-slate-600">สลับดูตามต้องการ</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {otherWorkflows.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Secondary Floor Actions */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1 mt-6">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">งานเสริม & ขนส่ง</span>
            <span className="text-[11px] text-slate-500">ขั้นตอนเพิ่มเติม</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {secondaryWorkflows.map(action => {
              const ActionIcon = action.icon;
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-200 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <ActionIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{action.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-mono">
                          {action.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{action.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Shift Tips */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>คำแนะนำสำหรับพนักงานคลัง</span>
          </div>
          <p className="leading-relaxed text-[11px]">
            • ใช้อุปกรณ์ PDA หรือกล้องมือถือสแกนเช็กบาร์โค้ดก่อนหยิบหรือวางทุกครั้งเพื่อความถูกต้อง<br />
            • เมนูหยิบสินค้า (Wave Picking) มีเสียงภาษาไทยคอยนำทางพิกัดชั้นวาง
          </p>
        </div>
      </main>

      {/* Scanned Barcode Result Modal */}
      {scanModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">ผลการสแกนบาร์โค้ด</h3>
              </div>
              <button 
                onClick={() => setScanModalOpen(false)}
                className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-center">
              <span className="text-xs text-slate-500 block mb-1">รหัสที่ตรวจพบ</span>
              <span className="text-lg font-black text-amber-600 tracking-wider break-all">{scannedCode}</span>
            </div>

            {matchedProduct ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold uppercase">
                      พบสินค้าในระบบ
                    </span>
                    <h4 className="font-bold text-slate-900 text-base mt-1">{matchedProduct.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">SKU: {matchedProduct.sku || matchedProduct.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">คงเหลือ</span>
                    <span className="text-xl font-black text-emerald-600">
                      {matchedProduct.stock ?? 0}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">{matchedProduct.unit || 'ชิ้น'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-emerald-200 text-xs text-emerald-700">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>พิกัดจัดเก็บ: <strong className="text-slate-900 font-mono">{matchedProduct.location || 'ยังไม่ระบุ Bin'}</strong></span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    href={`/mobile/receiving?sku=${encodeURIComponent(matchedProduct.sku || matchedProduct.name)}`}
                    onClick={() => setScanModalOpen(false)}
                    className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center shadow"
                  >
                    📥 รับสินค้านี้เข้า
                  </Link>
                  <Link
                    href={`/mobile/inventory?q=${encodeURIComponent(matchedProduct.sku || matchedProduct.name)}`}
                    onClick={() => setScanModalOpen(false)}
                    className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs text-center border border-slate-200"
                  >
                    🔍 ดูรายละเอียดสต็อก
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3 text-center">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">ไม่พบสินค้าจากรหัสนี้โดยตรง</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    รหัสนี้อาจเป็นเลขที่ PO, เลขที่ออเดอร์ หรือสินค้าที่ยังไม่ได้ลงทะเบียน
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={`/ops/receiving?po=${encodeURIComponent(scannedCode || '')}`}
                    onClick={() => setScanModalOpen(false)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                  >
                    ตรวจเป็นเลข PO
                  </Link>
                  <Link
                    href={`/mobile/orders?search=${encodeURIComponent(scannedCode || '')}`}
                    onClick={() => setScanModalOpen(false)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                  >
                    ตรวจเป็นเลข Order
                  </Link>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setScanModalOpen(false);
                setCameraOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> สแกนบาร์โค้ดถัดไป
            </button>
          </div>
        </div>
      )}

      {/* Universal Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleBarcodeIdentified}
        title="สแกนบาร์โค้ดหน้าคลัง"
        description="ส่องกล้องไปที่บาร์โค้ดสินค้า พิกัดชั้นวาง หรือเอกสาร PO/Order"
        continuous={false}
      />

      {/* Bottom Sticky Navigation */}
      <MobileNav />
    </div>
  );
}
