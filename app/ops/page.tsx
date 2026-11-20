'use client';

import {
  PackagePlus,
  PackageMinus,
  RefreshCw,
  Boxes,
  ShoppingCart,
  Activity,
  Users,
  ClipboardList,
  DollarSign,
  Banknote,
  RotateCcw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function OpsPage() {
  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        {/* Open Header */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/70 backdrop-blur-md border border-white/85 px-3 py-1 rounded-full shadow-xs">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Floor &amp; Fulfillment Hub
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-1.5">
            Daily Operations
          </h1>
          <p className="text-sm text-slate-600 font-medium">
            ศูนย์รวมงานปฏิบัติการคลังสินค้าประจำวัน (Floor &amp; Fulfillment Operations)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inbound Card */}
          <Link
            href="/ops/receiving"
            className="nx-glass-card group relative overflow-hidden p-8 hover:bg-white/90 hover:border-emerald-400/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="absolute -bottom-4 -right-4 p-6 opacity-[0.04] text-emerald-900 group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
              <PackagePlus className="w-44 h-44" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="p-3.5 bg-emerald-500/12 w-fit rounded-2xl mb-6 border border-emerald-500/25 group-hover:bg-emerald-500/20 transition-colors">
                  <PackagePlus className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                  1. รับสินค้าเข้า (Inbound Receiving)
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  สแกนตรวจรับสินค้าตามใบสั่งซื้อ (PO/GRN), ตรวจนับจำนวนจริง, และกำหนดพิกัดจัดเก็บขึ้นชั้นวาง (Putaway)
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm group-hover:translate-x-1.5 transition-transform">
                <span>เปิดหน้ารับสินค้าเข้า</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Sales Orders (Fulfillment) Card */}
          <Link
            href="/ops/orders"
            className="nx-glass-card group relative overflow-hidden p-8 hover:bg-white/90 hover:border-sky-400/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="absolute -bottom-4 -right-4 p-6 opacity-[0.04] text-sky-900 group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
              <ShoppingCart className="w-44 h-44" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="p-3.5 bg-sky-500/12 w-fit rounded-2xl mb-6 border border-sky-500/25 group-hover:bg-sky-500/20 transition-colors">
                  <ShoppingCart className="w-7 h-7 text-sky-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                  2. ออเดอร์ขาออก (Sales Orders)
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  กระบวนการจัดส่งให้ลูกค้าครบวงจร: ตรวจสอบออเดอร์ใหม่ &rarr; หยิบ &rarr; แพ็กกล่อง &rarr; ยิงเลขพัสดุ Tracking &rarr; ส่งมอบขนส่ง
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-1.5 text-sky-700 font-bold text-sm group-hover:translate-x-1.5 transition-transform">
                <span>จัดการออเดอร์ลูกค้า</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* COD & Freight Settlement Card */}
          <Link
            href="/ops/cod-reconcile"
            className="nx-glass-card group relative overflow-hidden p-8 hover:bg-white/90 hover:border-amber-400/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="absolute -bottom-4 -right-4 p-6 opacity-[0.04] text-amber-900 group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
              <Banknote className="w-44 h-44" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="p-3.5 bg-amber-500/12 w-fit rounded-2xl mb-6 border border-amber-500/25 group-hover:bg-amber-500/20 transition-colors">
                  <Banknote className="w-7 h-7 text-amber-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                  3. กระทบยอดเงินสด COD &amp; ค่าขนส่ง
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  รับเงินนำส่งจากคนขับหลังปิดทริป กระทบยอดเงินสด/สแกน QR ตรวจสอบส่วนต่างค้างชำระ และออกใบสำคัญรับเงินอัตโนมัติ
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-1.5 text-amber-700 font-bold text-sm group-hover:translate-x-1.5 transition-transform">
                <span>เปิดหน้ากระทบยอดเงินสด</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Reverse Logistics & Quarantine Card */}
          <Link
            href="/ops/returns"
            className="nx-glass-card group relative overflow-hidden p-8 hover:bg-white/90 hover:border-rose-400/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="absolute -bottom-4 -right-4 p-6 opacity-[0.04] text-rose-900 group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
              <RotateCcw className="w-44 h-44" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="p-3.5 bg-rose-500/12 w-fit rounded-2xl mb-6 border border-rose-500/25 group-hover:bg-rose-500/20 transition-colors">
                  <RotateCcw className="w-7 h-7 text-rose-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                  4. คืนสินค้า &amp; กักกัน (Reverse Logistics)
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  สแกนรับสินค้าตีกลับ/ชำรุดเข้าพิกัดกักกัน QUARANTINE ตรวจสอบสภาพ ตัดสินใจนำกลับเข้าสต็อก เคลม หรือทำลาย
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-1.5 text-rose-700 font-bold text-sm group-hover:translate-x-1.5 transition-transform">
                <span>จัดการคืนสินค้า &amp; RMA</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Wave Picking Card */}
          <Link
            href="/ops/wave-picking"
            className="nx-glass-card group relative overflow-hidden p-8 hover:bg-white/90 hover:border-sky-400/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="absolute -bottom-4 -right-4 p-6 opacity-[0.04] text-sky-900 group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
              <Boxes className="w-44 h-44" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="p-3.5 bg-sky-500/12 w-fit rounded-2xl mb-6 border border-sky-500/25 group-hover:bg-sky-500/20 transition-colors">
                  <Boxes className="w-7 h-7 text-sky-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                  5. หยิบสินค้ารวม (Wave Picking)
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  รวมหลายออเดอร์แล้วเดินหยิบรอบเดียวตามลำดับพิกัด S-Shape พร้อมระบบเสียงภาษาไทยนำทาง
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-1.5 text-sky-700 font-bold text-sm group-hover:translate-x-1.5 transition-transform">
                <span>เปิดระบบนำทางหยิบของ</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Direct Issue Card */}
          <Link
            href="/ops/outbound"
            className="nx-glass-card group relative overflow-hidden p-8 hover:bg-white/90 hover:border-rose-400/60 transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="absolute -bottom-4 -right-4 p-6 opacity-[0.04] text-rose-900 group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
              <PackageMinus className="w-44 h-44" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="p-3.5 bg-rose-500/12 w-fit rounded-2xl mb-6 border border-rose-500/25 group-hover:bg-rose-500/20 transition-colors">
                  <PackageMinus className="w-7 h-7 text-rose-600" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                  6. เบิกจ่ายตรง / ภายใน (Direct Issue)
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  ตัดสต็อกทันทีโดยไม่ต้องผ่านออเดอร์ลูกค้า เช่น เบิกวัสดุสิ้นเปลือง กล่อง เทป หรือเบิกสินค้าตัวอย่าง Sample
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-1.5 text-rose-700 font-bold text-sm group-hover:translate-x-1.5 transition-transform">
                <span>บันทึกเบิกตัดสต็อกตรง</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Cycle Count Card */}
          <Link
            href="/mobile/cycle-count"
            className="col-span-1 md:col-span-2 nx-glass-card group relative overflow-hidden p-6 flex items-center justify-between gap-6 hover:bg-white/90 hover:border-amber-400/60 transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-amber-500/12 border border-amber-500/25 rounded-2xl shrink-0">
                <RefreshCw className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  7. Cycle Count (ตรวจนับสต็อกตามรอบ)
                </h3>
                <p className="text-slate-600 text-sm mt-0.5">
                  ตรวจนับสินค้าจริงตาม Zone/Shelf เทียบยอดกับระบบ เพื่อตรวจจับผลต่าง (Variance) และสินค้าสูญหาย
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 hidden sm:block" />
          </Link>

          {/* Control Tower (1 Hero Dark Accent Card) */}
          <Link
            href="/ops/control-tower"
            className="col-span-1 md:col-span-2 nx-dark-accent-card group relative overflow-hidden p-6 flex items-center justify-between gap-6 hover:border-amber-400/50 transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-amber-500/15 border border-amber-400/30 rounded-2xl shrink-0">
                <Activity className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Telemetry
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Control Tower (ภาพรวมคลังเรียลไทม์)
                </h3>
                <p className="text-slate-300 text-sm mt-0.5">
                  แดชบอร์ดผู้จัดการ: สต็อกต่ำ, ล็อตใกล้หมดอายุ/เรียกคืน, ออเดอร์กำลังทำ, หุ่นยนต์ และความเคลื่อนไหวล่าสุด รวมในหน้าเดียว
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 hidden sm:block" />
          </Link>

          {/* Enterprise tools row */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
            <Link
              href="/ops/analytics/staff"
              className="nx-glass-card group p-5 flex items-center gap-4 hover:bg-white/90 hover:border-sky-400/60 transition-all"
            >
              <div className="p-3 bg-sky-500/12 border border-sky-500/25 rounded-2xl shrink-0">
                <Users className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Labor Management</h3>
                <p className="text-slate-600 text-xs mt-0.5">ประสิทธิภาพพนักงานรายคน/กะ</p>
              </div>
            </Link>

            <Link
              href="/ops/asn"
              className="nx-glass-card group p-5 flex items-center gap-4 hover:bg-white/90 hover:border-emerald-400/60 transition-all"
            >
              <div className="p-3 bg-emerald-500/12 border border-emerald-500/25 rounded-2xl shrink-0">
                <ClipboardList className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ASN แจ้งของเข้า</h3>
                <p className="text-slate-600 text-xs mt-0.5">รับแจ้งล่วงหน้า &rarr; แปลงเป็นใบรับ</p>
              </div>
            </Link>

            <Link
              href="/ops/carrier-rates"
              className="nx-glass-card group p-5 flex items-center gap-4 hover:bg-white/90 hover:border-amber-400/60 transition-all"
            >
              <div className="p-3 bg-amber-500/12 border border-amber-500/25 rounded-2xl shrink-0">
                <DollarSign className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">เทียบราคาขนส่ง</h3>
                <p className="text-slate-600 text-xs mt-0.5">หาขนส่งถูกสุดตามน้ำหนัก/โซน</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
