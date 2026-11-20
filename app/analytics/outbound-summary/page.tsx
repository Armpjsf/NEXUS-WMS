'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Truck, Package, Wallet, RefreshCw, ArrowLeft } from 'lucide-react';

interface Prov { province: string; trips: number; pieces: number; freight: number; customers: number; }
interface Data { totals: { trips: number; pieces: number; freight: number; provinces: number }; provinces: Prov[]; }

const baht = (n: number) => `฿${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function OutboundSummaryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/analytics/outbound-summary', { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const maxTrips = Math.max(1, ...(data?.provinces || []).map(p => p.trips));

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <Link
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> วิเคราะห์
        </Link>

        {/* Open Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Outbound Logistics
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <MapPin className="w-7 h-7 text-sky-600 shrink-0" />
              <span>สรุปงานส่งรายจังหวัด</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">ส่งไปจังหวัดไหน กี่ครั้ง กี่ชิ้น เป็นเงินค่าขนส่งเท่าไร</p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 text-xs font-semibold shadow-xs transition-all w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'จังหวัดปลายทาง', value: (data?.totals.provinces ?? 0).toLocaleString(), icon: MapPin, tone: 'bg-sky-500/12 border-sky-500/20 text-sky-700' },
            { label: 'จำนวนเที่ยว/ครั้ง', value: (data?.totals.trips ?? 0).toLocaleString(), icon: Truck, tone: 'bg-amber-500/15 border-amber-500/25 text-amber-700' },
            { label: 'รวมชิ้น', value: (data?.totals.pieces ?? 0).toLocaleString(), icon: Package, tone: 'bg-emerald-500/12 border-emerald-500/20 text-emerald-700' },
          ].map((c, i) => (
            <div key={i} className="nx-glass-card p-5 flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">{c.label}</div>
                <div className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{c.value}</div>
              </div>
              <div className={`p-2.5 rounded-2xl border ${c.tone}`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
          ))}

          {/* 1 Hero Dark Accent Card for Freight Total */}
          <div className="nx-dark-accent-card p-5 flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">รวมค่าขนส่ง</div>
              <div className="text-3xl font-bold text-white mt-2 tabular-nums">{baht(data?.totals.freight ?? 0)}</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="nx-glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/70 text-xs font-bold uppercase tracking-wider text-slate-700 tabular-nums">
            รายจังหวัด ({data?.provinces.length ?? 0})
          </div>
          {loading ? (
            <div className="p-10 text-center text-slate-500 text-sm">กำลังโหลด...</div>
          ) : (data?.provinces.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">ยังไม่มีข้อมูลงานส่ง</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-700">
                <thead className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200/80 bg-slate-50/80 sticky top-0">
                  <tr>
                    <th className="text-left py-3.5 pl-6">จังหวัด/ปลายทาง</th>
                    <th className="text-right py-3.5 px-4">เที่ยว</th>
                    <th className="text-right py-3.5 px-4">ชิ้น</th>
                    <th className="text-right py-3.5 px-4">ลูกค้า</th>
                    <th className="text-right py-3.5 pr-6">ค่าขนส่ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.provinces.map((p, i) => (
                    <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="py-3.5 pl-6">
                        <div className="text-slate-900 font-semibold">{p.province}</div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-200/80 overflow-hidden max-w-[220px]">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(p.trips / maxTrips) * 100}%` }} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">{p.trips.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right text-slate-700 tabular-nums">{p.pieces.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right text-slate-500 tabular-nums">{p.customers.toLocaleString()}</td>
                      <td className="py-3.5 pr-6 text-right font-bold text-amber-700 tabular-nums">{baht(p.freight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
