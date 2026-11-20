'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck, Clock, Box, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from 'lucide-react';
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
        /* เงียบไว้ — ไม่มีเบย์ก็แสดง compact layout */
      }
    })();
    return () => { active = false; };
  }, []);

  // When no bays are configured, do not waste 2/3 screen space
  if (bays.length === 0) {
    return (
      <div className="w-full space-y-4 mb-6">
        {/* Compact Dock Bay Strip */}
        <div className="nx-glass-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-900/5 text-slate-700">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-900">
              Dock Bay Matrix: <span className="text-slate-500 font-normal">ยังไม่ได้ตั้งค่าลานเทียบ (0 Active Bays)</span>
            </span>
          </div>
          <Link
            href="/ops/dock"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors group"
          >
            <span>ตั้งค่าลานเทียบ</span>
            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Full-width Live Movement Stream */}
        <div className="nx-glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Box className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                รายการเคลื่อนไหวล่าสุด (Live Movement Stream)
              </h3>
            </div>
            {logs.length > 0 && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold tracking-wider">
                LIVE
              </span>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <Box className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">ยังไม่มีรายการเคลื่อนไหว</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {logs.map((log, i) => {
                const isIn = (log.type || '').toUpperCase() === 'IN';
                return (
                  <div
                    key={log.id ?? i}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 text-xs flex flex-col justify-between gap-2 hover:border-emerald-300 hover:bg-white transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-700 font-semibold font-mono truncate">{log.docRef || log.sku || '-'}</span>
                      <span className="text-slate-400 flex items-center gap-1 shrink-0 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {log.date || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 my-0.5">
                      <span className="text-slate-900 truncate font-semibold">{log.productName || log.sku || '-'}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                        isIn ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}>
                        {isIn ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                        {isIn ? 'รับเข้า' : 'จ่ายออก'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/70">
                      <span className="truncate">{log.location && log.location !== '-' ? `ตำแหน่ง: ${log.location}` : 'ไม่ระบุตำแหน่ง'}</span>
                      <span className="text-slate-900 shrink-0 font-bold tabular-nums">จำนวน {Number(log.qty || 0).toLocaleString()}</span>
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

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      {/* Dock Bay Matrix */}
      <div className="xl:col-span-2 nx-glass-card p-6 flex flex-col">
        <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              ผังสถานะลานจอดเทียบ &amp; เบย์โหลด (Dock Bay Matrix)
            </h3>
            <p className="text-[11px] text-slate-500">
              การติดตามการเทียบท่าแบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {bays.map((bay) => {
            const isOccupied = bay.status !== 'AVAILABLE';
            const isInbound = bay.type === 'INBOUND';
            const accent = isInbound ? '#10b981' : '#0ea5e9';
            return (
              <div
                key={bay.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isOccupied ? 'bg-slate-50/80 border-slate-200' : 'bg-white border-dashed border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-900">{bay.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isInbound ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}
                  >
                    {bay.type}
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xs text-slate-800 font-semibold truncate">{bay.vehicle || '-'}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 tabular-nums">
                    <span>พาเลท: {bay.pallets}</span>
                    <span className={bay.progress === 100 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-semibold'}>{bay.eta}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2.5">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bay.progress}%`, backgroundColor: accent }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Movement Stream */}
      <div className="nx-glass-card p-6 flex flex-col">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Box className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              รายการเคลื่อนไหวล่าสุด
            </h3>
          </div>
          {logs.length > 0 && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
              LIVE
            </span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <Box className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">ยังไม่มีรายการเคลื่อนไหว</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log, i) => {
              const isIn = (log.type || '').toUpperCase() === 'IN';
              return (
                <div
                  key={log.id ?? i}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 text-xs flex flex-col gap-1.5 hover:border-emerald-300 hover:bg-white transition-all"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-700 font-mono font-semibold truncate">{log.docRef || log.sku || '-'}</span>
                    <span className="text-slate-400 flex items-center gap-1 shrink-0 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {log.date || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-900 font-semibold truncate">{log.productName || log.sku || '-'}</span>
                    <span className={`text-[10px] font-semibold flex items-center gap-1 shrink-0 ${isIn ? 'text-emerald-600' : 'text-sky-600'}`}>
                      {isIn ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                      {isIn ? 'รับเข้า' : 'จ่ายออก'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/70">
                    <span className="truncate">{log.location && log.location !== '-' ? `ตำแหน่ง: ${log.location}` : 'ไม่ระบุตำแหน่ง'}</span>
                    <span className="text-slate-900 font-bold shrink-0 tabular-nums">จำนวน {Number(log.qty || 0).toLocaleString()}</span>
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
