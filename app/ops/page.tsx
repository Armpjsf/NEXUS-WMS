'use client';

import { PackagePlus, PackageMinus, RefreshCw, Boxes, ShoppingCart, Activity, Users, ClipboardList, DollarSign, Banknote, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function OpsPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
       <div className="mb-8">
          <h1 className="text-4xl font-black text-[#dee2ec] mb-2 tracking-tight">Daily Operations</h1>
          <p className="text-[#8a92a6]">ศูนย์รวมงานปฏิบัติการคลังสินค้าประจำวัน (Floor & Fulfillment Operations)</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* Inbound Card */}
           <Link href="/ops/receiving" className="group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-8 hover:bg-[#1b2027] hover:border-[#57ec7f]/50 transition-all hover:scale-[1.01] hover:shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PackagePlus className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-3.5 bg-[#57ec7f]/15 w-fit rounded-xl mb-6 border border-[#57ec7f]/30 group-hover:bg-[#57ec7f]/25 transition-colors">
                           <PackagePlus className="w-8 h-8 text-[#57ec7f]" />
                       </div>
                       <h2 className="text-2xl font-bold text-[#dee2ec] mb-2">1. รับสินค้าเข้า (Inbound Receiving)</h2>
                       <p className="text-[#8a92a6] text-sm leading-relaxed">สแกนตรวจรับสินค้าตามใบสั่งซื้อ (PO/GRN), ตรวจนับจำนวนจริง, และกำหนดพิกัดจัดเก็บขึ้นชั้นวาง (Putaway)</p>
                   </div>
                   <div className="mt-8 flex items-center text-[#57ec7f] font-mono font-bold text-sm group-hover:translate-x-2 transition-transform">
                       เปิดหน้ารับสินค้าเข้า &rarr;
                   </div>
               </div>
           </Link>

           {/* Sales Orders (Fulfillment) Card */}
           <Link href="/ops/orders" className="group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-8 hover:bg-[#1b2027] hover:border-[#4cd7f6]/50 transition-all hover:scale-[1.01] hover:shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <ShoppingCart className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-3.5 bg-[#4cd7f6]/15 w-fit rounded-xl mb-6 border border-[#4cd7f6]/30 group-hover:bg-[#4cd7f6]/25 transition-colors">
                           <ShoppingCart className="w-8 h-8 text-[#4cd7f6]" />
                       </div>
                       <h2 className="text-2xl font-bold text-[#dee2ec] mb-2">2. ออเดอร์ขาออก (Sales Orders)</h2>
                       <p className="text-[#8a92a6] text-sm leading-relaxed">กระบวนการจัดส่งให้ลูกค้าครบวงจร: ตรวจสอบออเดอร์ใหม่ &rarr; หยิบ &rarr; แพ็กกล่อง &rarr; ยิงเลขพัสดุ Tracking &rarr; ส่งมอบขนส่ง</p>
                   </div>
                   <div className="mt-8 flex items-center text-[#4cd7f6] font-mono font-bold text-sm group-hover:translate-x-2 transition-transform">
                       จัดการออเดอร์ลูกค้า &rarr;
                   </div>
               </div>
           </Link>

           {/* COD & Freight Settlement Card */}
           <Link href="/ops/cod-reconcile" className="group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-8 hover:bg-[#1b2027] hover:border-[#facc15]/50 transition-all hover:scale-[1.01] hover:shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <Banknote className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-3.5 bg-[#facc15]/15 w-fit rounded-xl mb-6 border border-[#facc15]/30 group-hover:bg-[#facc15]/25 transition-colors">
                           <Banknote className="w-8 h-8 text-[#facc15]" />
                       </div>
                       <h2 className="text-2xl font-bold text-[#dee2ec] mb-2">3. กระทบยอดเงินสด COD & ค่าขนส่ง</h2>
                       <p className="text-[#8a92a6] text-sm leading-relaxed">รับเงินนำส่งจากคนขับหลังปิดทริป กระทบยอดเงินสด/สแกน QR ตรวจสอบส่วนต่างค้างชำระ และออกใบสำคัญรับเงินอัตโนมัติ</p>
                   </div>
                   <div className="mt-8 flex items-center text-[#facc15] font-mono font-bold text-sm group-hover:translate-x-2 transition-transform">
                       เปิดหน้ากระทบยอดเงินสด &rarr;
                   </div>
               </div>
           </Link>

           {/* Reverse Logistics & Quarantine Card */}
           <Link href="/ops/returns" className="group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-8 hover:bg-[#1b2027] hover:border-[#ff5449]/50 transition-all hover:scale-[1.01] hover:shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <RotateCcw className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-3.5 bg-[#ff5449]/15 w-fit rounded-xl mb-6 border border-[#ff5449]/30 group-hover:bg-[#ff5449]/25 transition-colors">
                           <RotateCcw className="w-8 h-8 text-[#ff5449]" />
                       </div>
                       <h2 className="text-2xl font-bold text-[#dee2ec] mb-2">4. คืนสินค้า & กักกัน (Reverse Logistics)</h2>
                       <p className="text-[#8a92a6] text-sm leading-relaxed">สแกนรับสินค้าตีกลับ/ชำรุดเข้าพิกัดกักกัน QUARANTINE ตรวจสอบสภาพ ตัดสินใจนำกลับเข้าสต็อก เคลม หรือทำลาย</p>
                   </div>
                   <div className="mt-8 flex items-center text-[#ffb4ab] font-mono font-bold text-sm group-hover:translate-x-2 transition-transform">
                       จัดการคืนสินค้า & RMA &rarr;
                   </div>
               </div>
           </Link>

           {/* Wave Picking Card */}
           <Link href="/ops/wave-picking" className="group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-8 hover:bg-[#1b2027] hover:border-[#4cd7f6]/50 transition-all hover:scale-[1.01] hover:shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <Boxes className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-3.5 bg-[#4cd7f6]/15 w-fit rounded-xl mb-6 border border-[#4cd7f6]/30 group-hover:bg-[#4cd7f6]/25 transition-colors">
                           <Boxes className="w-8 h-8 text-[#4cd7f6]" />
                       </div>
                       <h2 className="text-2xl font-bold text-[#dee2ec] mb-2">5. หยิบสินค้ารวม (Wave Picking)</h2>
                       <p className="text-[#8a92a6] text-sm leading-relaxed">รวมหลายออเดอร์แล้วเดินหยิบรอบเดียวตามลำดับพิกัด S-Shape พร้อมระบบเสียงภาษาไทยนำทาง</p>
                   </div>
                   <div className="mt-8 flex items-center text-[#4cd7f6] font-mono font-bold text-sm group-hover:translate-x-2 transition-transform">
                       เปิดระบบนำทางหยิบของ &rarr;
                   </div>
               </div>
           </Link>

           {/* Direct Issue Card */}
           <Link href="/ops/outbound" className="group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-8 hover:bg-[#1b2027] hover:border-[#ff5449]/50 transition-all hover:scale-[1.01] hover:shadow-xl">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PackageMinus className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                   <div>
                       <div className="p-3.5 bg-[#ff5449]/15 w-fit rounded-xl mb-6 border border-[#ff5449]/30 group-hover:bg-[#ff5449]/25 transition-colors">
                           <PackageMinus className="w-8 h-8 text-[#ff5449]" />
                       </div>
                       <h2 className="text-2xl font-bold text-[#dee2ec] mb-2">6. เบิกจ่ายตรง / ภายใน (Direct Issue)</h2>
                       <p className="text-[#8a92a6] text-sm leading-relaxed">ตัดสต็อกทันทีโดยไม่ต้องผ่านออเดอร์ลูกค้า เช่น เบิกวัสดุสิ้นเปลือง กล่อง เทป หรือเบิกสินค้าตัวอย่าง Sample</p>
                   </div>
                   <div className="mt-8 flex items-center text-[#ffb4ab] font-mono font-bold text-sm group-hover:translate-x-2 transition-transform">
                       บันทึกเบิกตัดสต็อกตรง &rarr;
                   </div>
               </div>
           </Link>

           {/* Cycle Count Card */}
           <Link href="/mobile/cycle-count" className="col-span-1 md:col-span-2 group relative overflow-hidden bg-[#171c23] border border-[#30353d] rounded-xl p-6 flex items-center gap-6 hover:bg-[#1b2027] hover:border-[#facc15]/50 transition-all">
               <div className="p-3 bg-[#facc15]/15 border border-[#facc15]/30 rounded-xl">
                   <RefreshCw className="w-6 h-6 text-[#facc15]" />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-[#dee2ec]">7. Cycle Count (ตรวจนับสต็อกตามรอบ)</h3>
                   <p className="text-[#8a92a6] text-sm mt-0.5">ตรวจนับสินค้าจริงตาม Zone/Shelf เทียบยอดกับระบบ เพื่อตรวจจับผลต่าง (Variance) และสินค้าสูญหาย</p>
               </div>
           </Link>

           {/* Control Tower */}
           <Link href="/ops/control-tower" className="col-span-1 md:col-span-2 group relative overflow-hidden bg-[#171c23] border border-[#facc15]/30 rounded-xl p-6 flex items-center gap-6 hover:bg-[#1b2027] hover:border-[#facc15]/60 transition-all">
               <div className="p-3 bg-[#facc15]/15 border border-[#facc15]/30 rounded-xl">
                   <Activity className="w-6 h-6 text-[#facc15]" />
               </div>
               <div>
                   <h3 className="text-lg font-bold text-[#dee2ec]">Control Tower (ภาพรวมคลังเรียลไทม์)</h3>
                   <p className="text-[#8a92a6] text-sm mt-0.5">แดชบอร์ดผู้จัดการ: สต็อกต่ำ, ล็อตใกล้หมดอายุ/เรียกคืน, ออเดอร์กำลังทำ, หุ่นยนต์ และความเคลื่อนไหวล่าสุด รวมในหน้าเดียว</p>
               </div>
           </Link>

           {/* Enterprise tools row */}
           <Link href="/ops/analytics/staff" className="group bg-[#171c23] border border-[#30353d] rounded-xl p-5 flex items-center gap-4 hover:bg-[#1b2027] hover:border-[#4cd7f6]/50 transition-all">
               <div className="p-3 bg-[#4cd7f6]/15 border border-[#4cd7f6]/30 rounded-xl"><Users className="w-6 h-6 text-[#4cd7f6]" /></div>
               <div><h3 className="text-base font-bold text-[#dee2ec]">Labor Management</h3><p className="text-[#8a92a6] text-xs mt-0.5">ประสิทธิภาพพนักงานรายคน/กะ</p></div>
           </Link>
           <Link href="/ops/asn" className="group bg-[#171c23] border border-[#30353d] rounded-xl p-5 flex items-center gap-4 hover:bg-[#1b2027] hover:border-[#57ec7f]/50 transition-all">
               <div className="p-3 bg-[#57ec7f]/15 border border-[#57ec7f]/30 rounded-xl"><ClipboardList className="w-6 h-6 text-[#57ec7f]" /></div>
               <div><h3 className="text-base font-bold text-[#dee2ec]">ASN แจ้งของเข้า</h3><p className="text-[#8a92a6] text-xs mt-0.5">รับแจ้งล่วงหน้า → แปลงเป็นใบรับ</p></div>
           </Link>
           <Link href="/ops/carrier-rates" className="group bg-[#171c23] border border-[#30353d] rounded-xl p-5 flex items-center gap-4 hover:bg-[#1b2027] hover:border-[#facc15]/50 transition-all">
               <div className="p-3 bg-[#facc15]/15 border border-[#facc15]/30 rounded-xl"><DollarSign className="w-6 h-6 text-[#facc15]" /></div>
               <div><h3 className="text-base font-bold text-[#dee2ec]">เทียบราคาขนส่ง</h3><p className="text-[#8a92a6] text-xs mt-0.5">หาขนส่งถูกสุดตามน้ำหนัก/โซน</p></div>
           </Link>

       </div>
    </div>
  );
}
