'use client';

import { PackagePlus, PackageMinus, RefreshCw, Boxes, ShoppingCart, Activity, Users, ClipboardList, DollarSign, Banknote, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function OpsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
       <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Daily Operations</h1>
          <p className="text-[#8a92a6]">ศูนย์รวมงานปฏิบัติการคลังสินค้าประจำวัน (Floor & Fulfillment Operations)</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* Inbound Card */}
           <Link href="/ops/receiving" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-emerald-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PackagePlus className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-emerald-500/10 w-fit rounded-2xl mb-6 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                           <PackagePlus className="w-8 h-8 text-emerald-500" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">1. รับสินค้าเข้า (Inbound Receiving)</h2>
                       <p className="text-[#8a92a6]">สแกนตรวจรับสินค้าตามใบสั่งซื้อ (PO/GRN), ตรวจนับจำนวนจริง, และกำหนดพิกัดจัดเก็บขึ้นชั้นวาง (Putaway)</p>
                   </div>
                   <div className="mt-8 flex items-center text-emerald-400 font-medium group-hover:translate-x-2 transition-transform">
                       เปิดหน้ารับสินค้าเข้า &rarr;
                   </div>
               </div>
           </Link>

           {/* Sales Orders (Fulfillment) Card */}
           <Link href="/ops/orders" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-blue-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <ShoppingCart className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-blue-500/10 w-fit rounded-2xl mb-6 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                           <ShoppingCart className="w-8 h-8 text-blue-400" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">2. ออเดอร์ขาออก (Sales Orders)</h2>
                       <p className="text-[#8a92a6]">กระบวนการจัดส่งให้ลูกค้าครบวงจร: ตรวจสอบออเดอร์ใหม่ &rarr; หยิบ &rarr; แพ็กกล่อง &rarr; ยิงเลขพัสดุ Tracking &rarr; ส่งมอบขนส่ง</p>
                   </div>
                   <div className="mt-8 flex items-center text-blue-400 font-medium group-hover:translate-x-2 transition-transform">
                       จัดการออเดอร์ลูกค้า &rarr;
                   </div>
               </div>
           </Link>

           {/* COD & Freight Settlement Card */}
           <Link href="/ops/cod-reconcile" className="group relative overflow-hidden bg-slate-900/50 border border-amber-500/30 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-amber-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <Banknote className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-amber-500/10 w-fit rounded-2xl mb-6 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                           <Banknote className="w-8 h-8 text-amber-400" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">3. กระทบยอดเงินสด COD & ค่าขนส่ง</h2>
                       <p className="text-[#8a92a6]">รับเงินนำส่งจากคนขับหลังปิดทริป กระทบยอดเงินสด/สแกน QR ตรวจสอบส่วนต่างค้างชำระ และออกใบสำคัญรับเงินอัตโนมัติ</p>
                   </div>
                   <div className="mt-8 flex items-center text-amber-400 font-medium group-hover:translate-x-2 transition-transform">
                       เปิดหน้ากระทบยอดเงินสด &rarr;
                   </div>
               </div>
           </Link>

           {/* Reverse Logistics & Quarantine Card */}
           <Link href="/ops/returns" className="group relative overflow-hidden bg-slate-900/50 border border-rose-500/30 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-rose-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <RotateCcw className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-rose-500/10 w-fit rounded-2xl mb-6 border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">
                           <RotateCcw className="w-8 h-8 text-rose-400" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">4. คืนสินค้า & กักกัน (Reverse Logistics)</h2>
                       <p className="text-[#8a92a6]">สแกนรับสินค้าตีกลับ/ชำรุดเข้าพิกัดกักกัน QUARANTINE ตรวจสอบสภาพ ตัดสินใจนำกลับเข้าสต็อก เคลม หรือทำลาย</p>
                   </div>
                   <div className="mt-8 flex items-center text-rose-400 font-medium group-hover:translate-x-2 transition-transform">
                       จัดการคืนสินค้า & RMA &rarr;
                   </div>
               </div>
           </Link>

           {/* Wave Picking Card */}
           <Link href="/ops/wave-picking" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-indigo-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <Boxes className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-indigo-500/10 w-fit rounded-2xl mb-6 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                           <Boxes className="w-8 h-8 text-indigo-400" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">5. หยิบสินค้ารวม (Wave Picking)</h2>
                       <p className="text-[#8a92a6]">รวมหลายออเดอร์แล้วเดินหยิบรอบเดียวตามลำดับพิกัด S-Shape พร้อมระบบเสียงภาษาไทยนำทาง</p>
                   </div>
                   <div className="mt-8 flex items-center text-indigo-400 font-medium group-hover:translate-x-2 transition-transform">
                       เปิดระบบนำทางหยิบของ &rarr;
                   </div>
               </div>
           </Link>

           {/* Direct Issue Card */}
           <Link href="/ops/outbound" className="group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-rose-500/10">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PackageMinus className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-4 bg-rose-500/10 w-fit rounded-2xl mb-6 border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">
                           <PackageMinus className="w-8 h-8 text-rose-500" />
                       </div>
                       <h2 className="text-2xl font-bold text-white mb-2">6. เบิกจ่ายตรง / ภายใน (Direct Issue)</h2>
                       <p className="text-[#8a92a6]">ตัดสต็อกทันทีโดยไม่ต้องผ่านออเดอร์ลูกค้า เช่น เบิกวัสดุสิ้นเปลือง กล่อง เทป หรือเบิกสินค้าตัวอย่าง Sample</p>
                   </div>
                   <div className="mt-8 flex items-center text-rose-400 font-medium group-hover:translate-x-2 transition-transform">
                       บันทึกเบิกตัดสต็อกตรง &rarr;
                   </div>
               </div>
           </Link>

           {/* Cycle Count Card */}
           <Link href="/mobile/cycle-count" className="col-span-1 md:col-span-2 group relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex items-center gap-6 hover:bg-slate-800/80 transition-all hover:border-slate-700">
               <div className="p-3 bg-amber-500/10 rounded-xl">
                   <RefreshCw className="w-6 h-6 text-amber-400" />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-white">7. Cycle Count (ตรวจนับสต็อกตามรอบ)</h3>
                   <p className="text-[#8a92a6] text-sm">ตรวจนับสินค้าจริงตาม Zone/Shelf เทียบยอดกับระบบ เพื่อตรวจจับผลต่าง (Variance) และสินค้าสูญหาย</p>
               </div>
           </Link>

           {/* Control Tower */}
           <Link href="/ops/control-tower" className="col-span-1 md:col-span-2 group relative overflow-hidden bg-gradient-to-r from-[#171c23] to-slate-900/50 border border-[#facc15]/20 rounded-3xl p-6 flex items-center gap-6 hover:border-[#facc15]/40 transition-all">
               <div className="p-3 bg-[#facc15]/10 rounded-xl">
                   <Activity className="w-6 h-6 text-[#facc15]" />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-white">Control Tower (ภาพรวมคลังเรียลไทม์)</h3>
                   <p className="text-[#8a92a6] text-sm">แดชบอร์ดผู้จัดการ: สต็อกต่ำ, ล็อตใกล้หมดอายุ/เรียกคืน, ออเดอร์กำลังทำ, หุ่นยนต์ และความเคลื่อนไหวล่าสุด รวมในหน้าเดียว</p>
               </div>
           </Link>

           {/* Enterprise tools row */}
           <Link href="/ops/lms" className="group bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex items-center gap-4 hover:bg-slate-800/80 transition-all">
               <div className="p-3 bg-purple-500/10 rounded-xl"><Users className="w-6 h-6 text-purple-400" /></div>
               <div><h3 className="text-base font-bold text-white">Labor Management</h3><p className="text-[#8a92a6] text-xs">ประสิทธิภาพพนักงานรายคน/กะ</p></div>
           </Link>
           <Link href="/ops/asn" className="group bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex items-center gap-4 hover:bg-slate-800/80 transition-all">
               <div className="p-3 bg-emerald-500/10 rounded-xl"><ClipboardList className="w-6 h-6 text-emerald-400" /></div>
               <div><h3 className="text-base font-bold text-white">ASN แจ้งของเข้า</h3><p className="text-[#8a92a6] text-xs">รับแจ้งล่วงหน้า → แปลงเป็นใบรับ</p></div>
           </Link>
           <Link href="/ops/carrier-rates" className="group bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex items-center gap-4 hover:bg-slate-800/80 transition-all">
               <div className="p-3 bg-cyan-500/10 rounded-xl"><DollarSign className="w-6 h-6 text-cyan-400" /></div>
               <div><h3 className="text-base font-bold text-white">เทียบราคาขนส่ง</h3><p className="text-[#8a92a6] text-xs">หาขนส่งถูกสุดตามน้ำหนัก/โซน</p></div>
           </Link>

       </div>
    </div>
  );
}
