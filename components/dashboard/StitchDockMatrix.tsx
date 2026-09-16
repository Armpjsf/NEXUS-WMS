'use client';

import { useEffect, useState } from 'react';
import { Truck, Clock, Box, ArrowDownToLine, ArrowUpFromLine, PackageOpen } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

interface Movement {
  id?: string | number;
  type?: string;
  sku?: string;
  productName?: string;
  qty?: number;
  date?: string;
  docRef?: string;
  location?: string;
}

interface Bay {
  id: string;
  name: string;
  type: 'INBOUND' | 'OUTBOUND' | string;
  status: 'ACTIVE' | 'WAITING' | 'AVAILABLE' | string;
  vehicle: string;
  pallets: string;
  progress: number;
  eta: string;
}

interface StitchDockMatrixProps {
  /** รายการเคลื่อนไหวจริงจาก /api/dashboard (recentTransactions) */
  movements?: Movement[];
}

export default function StitchDockMatrix({ movements = [] }: StitchDockMatrixProps) {
  const logs = movements.slice(0, 8);
  const [bays, setBays] = useState<Bay[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const branchId = typeof window !== 'undefined'
          ? (new URLSearchParams(window.location.search).get('branchId') || 'hq')
          : 'hq';
        const res = await fetch(getApiUrl(`/api/dock-bays?branchId=${branchId}`), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setBays(data.bays || []);
      } catch {
        /* เงียบไว้ — ไม่มีเบย์ก็แสดง empty-state */
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      {/* Dock Bay Matrix — ยังไม่เปิดใช้ (ไม่มีตารางลานเทียบใน DB) */}
      <div className="xl:col-span-2 bg-[#171c23] p-5 rounded-xl border border-[#30353d]/70 shadow-xl flex flex-col">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#30353d]/50 mb-4">
          <Truck className="w-5 h-5 text-[#facc15]" />
          <div>
            <h3 className="font-headline text-base font-bold text-[#dee2ec]">
              ผังสถานะลานจอดเทียบ &amp; เบย์โหลด (DOCK BAY MATRIX)
            </h3>
            <p className="font-mono text-[10px] text-[#d1c6ab]">
              การติดตามการเทียบท่าแบบเรียลไทม์
            </p>
          </div>
        </div>

        {bays.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 rounded-lg border border-dashed border-[#30353d]/60 bg-[#090f15]/40">
            <PackageOpen className="w-10 h-10 text-[#30353d] mb-3" />
            <p className="font-headline text-sm font-bold text-[#dee2ec]">ยังไม่ได้ตั้งค่าลานเทียบ</p>
            <p className="font-mono text-[11px] text-[#d1c6ab] mt-1.5 max-w-sm">
              ยังไม่มีข้อมูลเบย์/ประตูโหลดในระบบ เพิ่มเบย์ในตาราง dock_bays แล้ว
              สถานะรถและความคืบหน้าการโหลดจะแสดงที่นี่แบบเรียลไทม์
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {bays.map((bay) => {
              const isOccupied = bay.status !== 'AVAILABLE';
              const accent = bay.type === 'INBOUND' ? '#facc15' : '#4cd7f6';
              return (
                <div
                  key={bay.id}
                  className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                    isOccupied ? 'bg-[#1b2027] border-[#30353d]' : 'bg-[#090f15]/50 border-dashed border-[#30353d]/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-[#dee2ec]">{bay.name}</span>
                    <span
                      className="font-mono text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: `${accent}26`, color: accent }}
                    >
                      {bay.type}
                    </span>
                  </div>
                  <div className="my-1">
                    <p className="font-mono text-[11px] text-[#dee2ec] font-semibold truncate">{bay.vehicle || '-'}</p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#d1c6ab] mt-1">
                      <span>พาเลท: {bay.pallets}</span>
                      <span className={bay.progress === 100 ? 'text-[#57ec7f] font-bold' : 'text-[#facc15]'}>{bay.eta}</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#090f15] h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bay.progress}%`, backgroundColor: accent }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Movement Stream (ข้อมูลจริง) */}
      <div className="bg-[#171c23] p-5 rounded-xl border border-[#30353d]/70 shadow-xl flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-[#30353d]/50 mb-3">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-[#57ec7f]" />
            <h3 className="font-headline text-base font-bold text-[#dee2ec]">
              รายการเคลื่อนไหวล่าสุด
            </h3>
          </div>
          {logs.length > 0 && (
            <span className="font-mono text-[9px] bg-[#57ec7f]/20 text-[#57ec7f] px-1.5 py-0.5 rounded font-bold">
              LIVE
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <Box className="w-8 h-8 text-[#30353d] mb-2" />
            <p className="font-mono text-[11px] text-[#d1c6ab]">ยังไม่มีรายการเคลื่อนไหว</p>
          </div>
        ) : (
          <div className="space-y-2 font-mono">
            {logs.map((log, i) => {
              const isIn = (log.type || '').toUpperCase() === 'IN';
              return (
                <div
                  key={log.id ?? i}
                  className="p-2.5 rounded bg-[#1b2027] border border-[#30353d]/50 text-xs flex flex-col gap-1 hover:border-[#facc15]/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#facc15] font-bold truncate">{log.docRef || log.sku || '-'}</span>
                    <span className="text-[#d1c6ab] flex items-center gap-1 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {log.date || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#dee2ec] truncate">{log.productName || log.sku || '-'}</span>
                    <span className={`text-[10px] font-semibold flex items-center gap-1 shrink-0 ${isIn ? 'text-[#57ec7f]' : 'text-[#4cd7f6]'}`}>
                      {isIn ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                      {isIn ? 'รับเข้า' : 'จ่ายออก'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#d1c6ab] pt-1 border-t border-[#30353d]/30">
                    <span className="truncate">{log.location && log.location !== '-' ? `ตำแหน่ง: ${log.location}` : 'ไม่ระบุตำแหน่ง'}</span>
                    <span className="text-[#dee2ec] shrink-0">จำนวน {Number(log.qty || 0).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
