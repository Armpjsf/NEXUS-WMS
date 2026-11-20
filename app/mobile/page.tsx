'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  PackagePlus,
  Boxes,
  ClipboardCheck,
  Search,
  Truck,
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Scan,
  Layers,
  Clock,
  ChevronRight,
  PackageMinus,
  MapPin,
  X,
  ShieldCheck,
  UserCheck,
  LogOut,
  Mic,
  Zap,
  RotateCcw,
  ArrowLeftRight,
  SlidersHorizontal,
} from 'lucide-react';
import MobileNav from '@/components/MobileNav';
import CameraScannerModal from '@/components/CameraScannerModal';
import { usePdaScanner, playScannerAudio } from '@/hooks/usePdaScanner';
import { getApiUrl } from '@/lib/config';
import { canAccessSection, sectionForPath } from '@/lib/rbac';

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
  const user = session?.user;
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
      subtitle: 'สแกนตรวจนับ PO และลงประวัติรับเข้าสินค้า',
      icon: PackagePlus,
      href: '/mobile/receiving',
      tag: 'รับเข้าคลัง',
      iconBg: 'bg-emerald-500/12 text-emerald-700 border border-emerald-500/20',
    },
    {
      id: 'putaway',
      section: 'Staff - Inbound',
      title: 'จัดเก็บขึ้นชั้น (Putaway)',
      subtitle: 'แนะนำรวมกอง สแกนชั้นวางยืนยันพิกัดจัดเก็บ (Multi-Bin)',
      icon: Layers,
      href: '/mobile/putaway',
      tag: 'จัดเก็บขึ้นเชลฟ์',
      iconBg: 'bg-emerald-500/12 text-emerald-700 border border-emerald-500/20',
    },
    {
      id: 'wave-picking',
      section: 'Staff - Picker',
      title: 'หยิบสินค้า (Wave Picking)',
      subtitle: 'เดินหยิบตาม S-Shape มีเสียงภาษาไทยนำทาง',
      icon: Boxes,
      href: '/mobile/picking',
      tag: 'คำสั่งหยิบรวม',
      iconBg: 'bg-sky-500/12 text-sky-700 border border-sky-500/20',
    },
    {
      id: 'qc-orders',
      section: 'Staff - QC & Pack',
      title: 'ตรวจ QC & แพ็กกล่อง (QC & Packing)',
      subtitle: 'สแกนตรวจความถูกต้อง QC และแพ็กกล่องพิมพ์ใบปะหน้า',
      icon: ShieldCheck,
      href: '/mobile/orders',
      tag: 'สถานี QC & แพ็ก',
      iconBg: 'bg-sky-500/12 text-sky-700 border border-sky-500/20',
    },
    {
      id: 'cross-dock',
      section: 'Staff - Dispatch',
      title: 'เช็คของขึ้นรถ (Cross-Dock)',
      subtitle: 'กรอกของที่ลูกค้านำมา (ไม่ต้องมีในคลัง) เช็ค แล้วส่งเข้า TMS',
      icon: Truck,
      href: '/mobile/dispatch',
      tag: 'Cross-Dock',
      iconBg: 'bg-sky-500/12 text-sky-700 border border-sky-500/20',
    },
    {
      id: 'dispatch',
      section: 'Staff - Dispatch',
      title: 'ส่งมอบขนส่ง (Courier Dispatch)',
      subtitle: 'ยิงเลขพัสดุ ส่ง Kerry/Flash/SPX และบันทึกเวลาส่ง',
      icon: Truck,
      href: '/mobile/orders?tab=dispatch',
      tag: 'ส่งมอบขนส่ง',
      iconBg: 'bg-amber-500/15 text-amber-800 border border-amber-500/25',
    },
    {
      id: 'cycle-count',
      section: 'Staff - Inventory',
      title: 'ตรวจนับสต็อก (Cycle Count)',
      subtitle: 'ตรวจนับสินค้าตามโซน/เชลฟ์ บันทึกส่วนต่าง',
      icon: ClipboardCheck,
      href: '/mobile/cycle-count',
      tag: 'เช็กสต็อก',
      iconBg: 'bg-amber-500/15 text-amber-800 border border-amber-500/25',
    },
    {
      id: 'inventory-lookup',
      section: 'all',
      title: 'ค้นหาพิกัด & สต็อก (Lookup)',
      subtitle: 'สแกนหรือพิมพ์เพื่อดู Location และยอดคงเหลือ',
      icon: Search,
      href: '/mobile/inventory',
      tag: 'ค้นหาด่วน',
      iconBg: 'bg-emerald-500/12 text-emerald-700 border border-emerald-500/20',
    },
    {
      id: 'smart-tasks',
      section: 'all',
      title: 'คิวงานอัจฉริยะ (Smart Tasks)',
      subtitle: 'รับงานหยิบ/จัดเก็บ/เติมสต็อกตามลำดับความสำคัญ',
      icon: Zap,
      href: '/mobile/tasks',
      tag: 'คิวงาน',
      iconBg: 'bg-amber-500/15 text-amber-800 border border-amber-500/25',
    },
    {
      id: 'voice-picking',
      section: 'Staff - Picker',
      title: 'สั่งหยิบด้วยเสียง (Voice Picking)',
      subtitle: 'หยิบแบบมือว่าง มีเสียงภาษาไทยนำทาง + ยืนยันด้วยสแกน',
      icon: Mic,
      href: '/mobile/voice-picking',
      tag: 'Hands-Free',
      iconBg: 'bg-amber-500/15 text-amber-800 border border-amber-500/25',
    },
  ];

  // Re-order based on role
  const isSectionStaff = userRole.startsWith('Staff - ');
  const canOpen = (href: string) => {
    if (!isSectionStaff) return true;
    const section = sectionForPath(href);
    if (!section) return false;
    return canAccessSection(userRole, section);
  };
  const myWorkflows = isSectionStaff
    ? allWorkflows.filter(w => (w.section === userRole || w.section === 'all') && canOpen(w.href))
    : allWorkflows;
  const otherWorkflows = isSectionStaff
    ? allWorkflows.filter(w => w.section !== userRole && w.section !== 'all' && canOpen(w.href))
    : [];

  const secondaryWorkflows = [
    {
      id: 'lpn-management',
      title: 'จัดการพาเลท LPN',
      desc: 'สแกนเลขพาเลท LPN เพื่อตรวจสอบหรือย้ายพิกัดทั้งพาเลท',
      icon: Boxes,
      href: '/mobile/lpn',
      badge: 'LPN',
    },
    {
      id: 'kitting-assembly',
      title: 'ประกอบชุดสินค้า Kitting',
      desc: 'รวมชุดสินค้าตามสูตร BOM และตัดสต็อกวัตถุดิบอัตโนมัติ',
      icon: Layers,
      href: '/mobile/kitting',
      badge: 'Kitting',
    },
    {
      id: 'rma-returns',
      title: 'รับคืนสินค้า RMA',
      desc: 'รับคืนสินค้าจากลูกค้า คัดแยกสภาพและเติมกลับเข้าสต็อก',
      icon: RotateCcw,
      href: '/mobile/returns',
      badge: 'RMA',
    },
    {
      id: 'approve-adjustments',
      title: 'อนุมัติปรับสต็อก',
      desc: 'ตรวจสอบและอนุมัติคำขอปรับยอดสต็อก (Maker-Checker)',
      icon: ClipboardCheck,
      href: '/mobile/adjustments',
      badge: 'Approval',
    },
    {
      id: 'quick-adjust',
      title: 'ปรับสต็อกด่วน (Quick Adjust)',
      desc: 'สแกนส่งคำขอปรับเพิ่ม-ลดยอดสต็อกหน้างานเข้าคิวรออนุมัติ',
      icon: SlidersHorizontal,
      href: '/mobile/adjust',
      badge: 'Adjust',
    },
    {
      id: 'branch-transfers',
      title: 'โอนย้ายสต็อกข้ามสาขา',
      desc: 'ส่งออกและตรวจรับสินค้าโอนย้ายระหว่างคลัง/สาขา',
      icon: ArrowLeftRight,
      href: '/mobile/transfers',
      badge: 'Transfer',
    },
    {
      id: 'outbound-issue',
      title: 'เบิกจ่ายตรง / ใช้ภายใน',
      desc: 'เบิกกล่อง เทป หรือตัวอย่างสินค้า',
      icon: PackageMinus,
      href: '/mobile/outbound',
      badge: 'Direct Issue',
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
      id: 'dock',
      title: 'คิวเทียบท่า (Dock)',
      desc: 'เช็คอินรถ นำเข้าเบย์ และปิดงานเทียบท่า',
      icon: Truck,
      href: '/mobile/dock',
      badge: 'Yard',
    },
  ];

  return (
    <div className="min-h-screen text-slate-900 pb-28 font-sans select-none">
      {/* Top App Bar - Frosted Hybrid Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-white/85 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl overflow-hidden p-1 flex items-center justify-center bg-slate-900 shadow-sm shrink-0">
              <img src="/nexus-icon.png" alt="NEXUS WMS" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-black text-base text-slate-900 tracking-tight leading-tight">NEXUS Mobile</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isOnline
                    ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25'
                    : 'bg-rose-500/12 text-rose-700 border-rose-500/25'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 tabular-nums flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400" /> อัปเดต {lastSync || 'กำลังซิงค์...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCameraOpen(true)}
              className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-full flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>สแกนกล้อง</span>
            </button>
            <button
              onClick={loadData}
              title="รีเฟรชข้อมูล"
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-900 active:scale-95 transition-all flex items-center justify-center shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-5 max-w-lg mx-auto">
        {/* User Role & Department Card */}
        <div className="nx-glass-card flex items-center justify-between gap-2 p-3.5 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/12 text-sky-700 border border-sky-500/20 flex items-center justify-center font-bold shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-xs leading-tight truncate">{userName}</p>
              <p className="text-[11px] text-slate-500 truncate">
                บทบาท: <strong className="text-sky-700">{userRole}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/12 text-sky-700 border border-sky-500/25">
              {isSectionStaff ? userRole.replace('Staff - ', 'แผนก: ') : 'ทุกแผนก'}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="ออกจากระบบ"
              className="min-h-[38px] flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-rose-500/12 text-rose-700 border border-rose-500/25 active:scale-95 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออก</span>
            </button>
          </div>
        </div>

        {/* Core Operations Cards */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isSectionStaff ? 'งานประจำแผนกของคุณ' : 'งานปฏิบัติการหลักคลังสินค้า'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/75 border border-white/85 text-[11px] font-bold text-slate-600 tabular-nums">
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
                  className="nx-glass-card group relative flex items-center justify-between p-4 hover:bg-white/95 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-slate-100/90 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:bg-slate-200 transition-all shrink-0 ml-2">
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
            <div className="flex items-center justify-between mb-2.5 px-1 mt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">งานแผนกอื่นๆ</span>
              <span className="text-[11px] text-slate-500">สลับดูตามต้องการ</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {otherWorkflows.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="nx-glass-card flex items-center justify-between p-3.5 text-slate-700 hover:text-slate-900 transition-all text-xs min-h-[48px]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold">{item.title}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Secondary Floor Actions */}
        {secondaryWorkflows.filter(a => canOpen(a.href)).length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1 mt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">งานเสริม & ขนส่ง</span>
              <span className="text-[11px] text-slate-500">ขั้นตอนเพิ่มเติม</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {secondaryWorkflows.filter(a => canOpen(a.href)).map(action => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="nx-glass-card flex items-center justify-between p-3.5 hover:bg-white/95 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <ActionIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{action.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                            {action.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{action.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Shift Tips */}
        <div className="nx-glass-card p-4 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">ผลการสแกนบาร์โค้ด</h3>
              </div>
              <button
                onClick={() => setScanModalOpen(false)}
                className="min-h-[36px] min-w-[36px] p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="nx-dark-accent-card p-4 text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">รหัสที่ตรวจพบ</span>
              <span className="text-lg font-black text-amber-300 tabular-nums tracking-wider break-all">{scannedCode}</span>
            </div>

            {matchedProduct ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 font-bold uppercase">
                      พบสินค้าในระบบ
                    </span>
                    <h4 className="font-bold text-slate-900 text-base mt-1.5">{matchedProduct.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">SKU: {matchedProduct.sku || matchedProduct.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 block">คงเหลือ</span>
                    <span className="text-2xl font-black text-emerald-700 tabular-nums">
                      {matchedProduct.stock ?? 0}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">{matchedProduct.unit || 'ชิ้น'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/20 text-xs text-emerald-800">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>พิกัดจัดเก็บ: <strong className="text-slate-900 font-mono">{matchedProduct.location || 'ยังไม่ระบุ Bin'}</strong></span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={`/mobile/receiving?sku=${encodeURIComponent(matchedProduct.sku || matchedProduct.name)}`}
                    onClick={() => setScanModalOpen(false)}
                    className="min-h-[44px] px-3 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-sm"
                  >
                    📥 รับสินค้านี้เข้า
                  </Link>
                  <Link
                    href={`/mobile/inventory?q=${encodeURIComponent(matchedProduct.sku || matchedProduct.name)}`}
                    onClick={() => setScanModalOpen(false)}
                    className="min-h-[44px] px-3 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs flex items-center justify-center border border-slate-200"
                  >
                    🔍 ดูรายละเอียดสต็อก
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-3 text-center">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">ไม่พบสินค้าจากรหัสนี้โดยตรง</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    รหัสนี้อาจเป็นเลขที่ PO, เลขที่ออเดอร์ หรือสินค้าที่ยังไม่ได้ลงทะเบียน
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={`/ops/receiving?po=${encodeURIComponent(scannedCode || '')}`}
                    onClick={() => setScanModalOpen(false)}
                    className="min-h-[44px] px-3 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center"
                  >
                    ตรวจเป็นเลข PO
                  </Link>
                  <Link
                    href={`/mobile/orders?search=${encodeURIComponent(scannedCode || '')}`}
                    onClick={() => setScanModalOpen(false)}
                    className="min-h-[44px] px-3 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 flex items-center justify-center"
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
              className="w-full min-h-[48px] py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
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
