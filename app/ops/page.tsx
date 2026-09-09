'use client';

import { PackagePlus, PackageMinus, RefreshCw, Boxes, Truck, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default function OpsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
       <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Daily Operations</h1>
          <p className="text-slate-400">ศูนย์รวมงานปฏิบัติการคลังสินค้าประจำวัน (Floor & Fulfillment Operations)</p>
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
                       <p className="text-slate-400">สแกนตรวจรับสินค้าตามใบสั่งซื้อ (PO/GRN), ตรวจนับจำนวนจริง, และกำหนดพิกัดจัดเก็บขึ้นชั้นวาง (Putaway)</p>
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
                       <p className="text-slate-400">กระบวนการจัดส่งให้ลูกค้าครบวงจร: ตรวจสอบออเดอร์ใหม่ &rarr; หยิบ &rarr; แพ็กกล่อง &rarr; ยิงเลขพัสดุ Tracking &rarr; ส่งมอบขนส่ง</p>
                   </div>
                   <div className="mt-8 flex items-center text-blue-400 font-medium group-hover:translate-x-2 transition-transform">
                       จัดการออเดอร์ลูกค้า &rarr;
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
                       <h2 className="text-2xl font-bold text-white mb-2">3. หยิบสินค้ารวม (Wave Picking)</h2>
                       <p className="text-slate-400">รวมหลายออเดอร์แล้วเดินหยิบรอบเดียวตามลำดับพิกัด S-Shape พร้อมระบบเสียงภาษาไทยนำทาง</p>
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
                       <h2 className="text-2xl font-bold text-white mb-2">4. เบิกจ่ายตรง / ภายใน (Direct Issue)</h2>
                       <p className="text-slate-400">ตัดสต็อกทันทีโดยไม่ต้องผ่านออเดอร์ลูกค้า เช่น เบิกวัสดุสิ้นเปลือง กล่อง เทป หรือเบิกสินค้าตัวอย่าง Sample</p>
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
                   <h3 className="text-lg font-bold text-white">5. Cycle Count (ตรวจนับสต็อกตามรอบ)</h3>
                   <p className="text-slate-400 text-sm">ตรวจนับสินค้าจริงตาม Zone/Shelf เทียบยอดกับระบบ เพื่อตรวจจับผลต่าง (Variance) และสินค้าสูญหาย</p>
               </div>
           </Link>

       </div>
    </div>
  );
}
