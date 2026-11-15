'use client';

import { useEffect, useState } from 'react';
import { MapPin, Truck, Package, Wallet, RefreshCw } from 'lucide-react';

interface Prov { province: string; trips: number; pieces: number; freight: number; customers: number; }
interface Data { totals: { trips: number; pieces: number; freight: number; provinces: number }; provinces: Prov[]; }

const baht = (n: number) => `฿${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function OutboundSummaryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/analytics/outbound-summary', { cache: 'no-store' })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const maxTrips = Math.max(1, ...(data?.provinces || []).map(p => p.trips));

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-[#dee2ec] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#4cd7f6]" /> สรุปงานส่งรายจังหวัด
          </h1>
          <p className="text-sm text-[#8a92a6] mt-0.5">ส่งไปจังหวัดไหน กี่ครั้ง กี่ชิ้น เป็นเงินค่าขนส่งเท่าไร</p>
        </div>
        <button onClick={() => location.reload()} className="p-2 rounded-xl text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#1b2027] border border-[#30353d]">
          <RefreshCw className={`w-4 h-4 text-[#facc15] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'จังหวัดปลายทาง', value: data?.totals.provinces ?? 0, icon: MapPin, color: 'text-[#4cd7f6]' },
          { label: 'จำนวนเที่ยว/ครั้ง', value: data?.totals.trips ?? 0, icon: Truck, color: 'text-[#facc15]' },
          { label: 'รวมชิ้น', value: (data?.totals.pieces ?? 0).toLocaleString(), icon: Package, color: 'text-[#57ec7f]' },
          { label: 'รวมค่าขนส่ง', value: baht(data?.totals.freight ?? 0), icon: Wallet, color: 'text-[#facc15]' },
        ].map((c, i) => (
          <div key={i} className="rounded-xl border border-[#30353d] bg-[#171c23] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[#8a92a6]">
              <c.icon className={`w-4 h-4 ${c.color}`} /> {c.label}
            </div>
            <div className="text-2xl font-mono font-black text-[#dee2ec] mt-2 tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#30353d] bg-[#171c23] overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-[#30353d] text-xs font-mono font-bold uppercase tracking-wider text-[#d1c6ab]">
          รายจังหวัด ({data?.provinces.length ?? 0})
        </div>
        {loading ? (
          <div className="p-10 text-center text-[#8a92a6] font-mono text-sm">กำลังโหลด...</div>
        ) : (data?.provinces.length ?? 0) === 0 ? (
          <div className="p-10 text-center text-[#8a92a6] font-mono text-sm">ยังไม่มีข้อมูลงานส่ง</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] font-mono uppercase text-[#8a92a6] border-b border-[#30353d] bg-[#1b2027]">
                <tr>
                  <th className="text-left py-2.5 pl-5">จังหวัด/ปลายทาง</th>
                  <th className="text-right py-2.5 px-3">เที่ยว</th>
                  <th className="text-right py-2.5 px-3">ชิ้น</th>
                  <th className="text-right py-2.5 px-3">ลูกค้า</th>
                  <th className="text-right py-2.5 pr-5">ค่าขนส่ง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30353d]/50">
                {data!.provinces.map((p, i) => (
                  <tr key={i} className="hover:bg-[#1b2027]/60 transition-colors">
                    <td className="py-2.5 pl-5">
                      <div className="text-[#dee2ec] font-semibold">{p.province}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-[#090f15] border border-[#30353d] overflow-hidden max-w-[220px]">
                        <div className="h-full bg-[#4cd7f6]" style={{ width: `${(p.trips / maxTrips) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#dee2ec] tabular-nums">{p.trips.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#d1c6ab] tabular-nums">{p.pieces.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#8a92a6] tabular-nums">{p.customers.toLocaleString()}</td>
                    <td className="py-2.5 pr-5 text-right font-mono font-bold text-[#facc15] tabular-nums">{baht(p.freight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
