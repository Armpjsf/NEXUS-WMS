'use client';

import { useState, useEffect } from 'react';
import {
  ReceiptText,
  AlertTriangle,
  Download,
  Search,
  Printer,
  RefreshCw,
} from 'lucide-react';
import type { ValuationSummary } from '@/lib/data/valuation';
import { exportToExcel } from '@/lib/export/excel';
import { cn } from '@/lib/utils';

export default function ValuationReportPage() {
  const [data, setData] = useState<ValuationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState<number>(0);
  const [search, setSearch] = useState('');

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/valuation');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load valuation report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleExportExcel = () => {
    if (!data || data.deadStockItems.length === 0) return;
    const rows = data.deadStockItems.map((item) => ({
      SKU: item.sku,
      ชื่อสินค้า: item.name,
      หมวดหมู่: item.category,
      ตำแหน่งจัดเก็บ: item.location,
      จำนวนคงคลัง: item.stock,
      หน่วยนับ: item.unit,
      'ราคาทุน (บาท)': item.costPrice,
      'ราคาขาย (บาท)': item.retailPrice,
      'มูลค่าทุนจม (บาท)': item.totalCostValue,
      'มูลค่าราคาขาย (บาท)': item.totalRetailValue,
      'ค้างนาน (วัน)': item.daysDormant,
      วันที่เคลื่อนไหวล่าสุด: item.lastMovedDate,
      คำแนะนำการจัดการ: item.suggestedAction,
    }));
    exportToExcel(rows, `รายงานมูลค่าสต็อกและDeadStock_${new Date().toISOString().slice(0, 10)}`, 'DeadStock');
  };

  const deadItems = data?.deadStockItems || [];
  const filteredItems = deadItems.filter((item) => {
    const matchDays = filterDays === 0 || item.daysDormant >= filterDays;
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchDays && matchSearch;
  });

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Open Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Inventory Valuation & Dead Stock
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/12 border border-rose-500/20 text-rose-600">
                <ReceiptText className="w-5 h-5" />
              </span>
              <span>รายงานมูลค่าสต็อก & Dead Stock (Inventory Valuation)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ประเมินมูลค่าสินค้าคงคลัง คำนวณเงินจม และวิเคราะห์สินค้าที่ไม่เคลื่อนไหวเกินกำหนด
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={loadReport}
              disabled={loading}
              className="p-2.5 rounded-full border border-slate-200/80 bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw className={cn('w-4 h-4 text-emerald-600', loading && 'animate-spin text-rose-600')} />
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold text-xs shadow-sm active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => window.print()}
              className="p-2.5 rounded-full border border-slate-200/80 bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs transition-colors"
              title="พิมพ์รายงาน"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Cards (1 Dark Hero Alert Card + 3 Glass Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="nx-glass-card p-5">
            <div className="text-[11px] font-semibold text-slate-600 uppercase">มูลค่าสต็อกตามราคาทุน</div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1.5">
              ฿{(data?.totalCostValuation || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
              รวม {data?.totalUnits.toLocaleString() || 0} ชิ้น ({data?.totalSkus || 0} SKU)
            </div>
            {!!data?.skusWithoutCost && (
              <div className="text-[11px] font-medium text-amber-700 mt-1.5 tabular-nums">
                ⚠ {data.skusWithoutCost} SKU ยังไม่มีต้นทุน — ไม่นับในยอดนี้
              </div>
            )}
          </div>

          <div className="nx-glass-card p-5">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase">มูลค่าสต็อกราคาขาย</div>
            <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-1.5">
              ฿{(data?.totalRetailValuation || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1 tabular-nums">
              อัตรากำไรขั้นต้นคาดการณ์ ~{data?.estimatedMargin || 0}%
            </div>
          </div>

          {/* Hero Dark Accent Card for Dead Stock Locked Capital */}
          <div className="nx-dark-accent-card p-5">
            <div className="text-[11px] font-semibold text-rose-300 uppercase flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>เงินจมใน Dead Stock (&ge;30 วัน)</span>
            </div>
            <div className="text-2xl font-mono font-bold text-white tabular-nums mt-1.5">
              ฿{(data?.deadStockLockedCapital || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-rose-300 font-medium mt-1 tabular-nums">
              สินค้าค้างนาน {data?.deadStock30DaysCount || 0} รายการ
            </div>
          </div>

          <div className="nx-glass-card p-5">
            <div className="text-[11px] font-semibold text-slate-600 uppercase">สินค้าวิกฤต (&ge;90 วัน)</div>
            <div className="text-2xl font-mono font-bold text-amber-600 tabular-nums mt-1.5">
              {data?.deadStock90DaysCount || 0}{' '}
              <span className="text-xs text-slate-500 font-sans font-normal">รายการ</span>
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">แนะนำจัด Flash Sale / Bundle ด่วน</div>
          </div>
        </div>

        {/* Filters and Search + Dead Stock Table */}
        <div className="nx-glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-full w-full sm:w-auto">
              <button
                onClick={() => setFilterDays(0)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all tabular-nums',
                  filterDays === 0 ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                ทั้งหมด ({deadItems.length})
              </button>
              <button
                onClick={() => setFilterDays(30)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all tabular-nums',
                  filterDays === 30 ? 'bg-amber-500 text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                ค้าง &ge; 30 วัน ({data?.deadStock30DaysCount || 0})
              </button>
              <button
                onClick={() => setFilterDays(60)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all tabular-nums',
                  filterDays === 60 ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                ค้าง &ge; 60 วัน ({data?.deadStock60DaysCount || 0})
              </button>
              <button
                onClick={() => setFilterDays(90)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all tabular-nums',
                  filterDays === 90 ? 'bg-rose-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                วิกฤต &ge; 90 วัน ({data?.deadStock90DaysCount || 0})
              </button>
            </div>

            <div className="relative w-full sm:w-64 print:hidden">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา SKU, ชื่อสินค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/90 border border-slate-200/80 rounded-full focus:outline-none focus:border-emerald-500 text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Dead Stock Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">สินค้า</th>
                  <th className="py-3 px-4">ตำแหน่ง</th>
                  <th className="py-3 px-4 text-right">จำนวนคงคลัง</th>
                  <th className="py-3 px-4 text-right">ราคาทุน</th>
                  <th className="py-3 px-4 text-right">มูลค่าเงินจม (ทุน)</th>
                  <th className="py-3 px-4 text-center">ค้างนาน</th>
                  <th className="py-3 px-4">คำแนะนำการระบายของ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.sku} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.sku} · {item.category}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-500/12 border border-sky-500/20 text-sky-700 font-mono font-semibold text-[11px]">
                          {item.location}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {item.stock.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                        {item.costSource === 'NONE' ? (
                          <span className="text-amber-700 text-[11px] font-sans font-semibold">ไม่มีต้นทุน</span>
                        ) : (
                          <>฿{item.costPrice.toLocaleString()}</>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 tabular-nums">
                        ฿{item.totalCostValue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border tabular-nums',
                            item.daysDormant >= 90
                              ? 'bg-rose-500/12 text-rose-700 border-rose-500/20'
                              : item.daysDormant >= 60
                              ? 'bg-amber-500/15 text-amber-800 border-amber-500/25'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {item.daysDormant} วัน
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 font-medium text-[11px]">{item.suggestedAction}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
