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
    const rows = data.deadStockItems.map(item => ({
      'SKU': item.sku,
      'ชื่อสินค้า': item.name,
      'หมวดหมู่': item.category,
      'ตำแหน่งจัดเก็บ': item.location,
      'จำนวนคงคลัง': item.stock,
      'หน่วยนับ': item.unit,
      'ราคาทุน (บาท)': item.costPrice,
      'ราคาขาย (บาท)': item.retailPrice,
      'มูลค่าทุนจม (บาท)': item.totalCostValue,
      'มูลค่าราคาขาย (บาท)': item.totalRetailValue,
      'ค้างนาน (วัน)': item.daysDormant,
      'วันที่เคลื่อนไหวล่าสุด': item.lastMovedDate,
      'คำแนะนำการจัดการ': item.suggestedAction,
    }));
    exportToExcel(rows, `รายงานมูลค่าสต็อกและDeadStock_${new Date().toISOString().slice(0, 10)}`, 'DeadStock');
  };

  const deadItems = data?.deadStockItems || [];
  const filteredItems = deadItems.filter(item => {
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-[#1b2027]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-md shadow-rose-500/20">
            <ReceiptText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#dee2ec] tracking-tight">
              รายงานมูลค่าสต็อก & Dead Stock (Inventory Valuation)
            </h1>
            <p className="text-xs text-[#8a92a6] font-medium mt-0.5">
              ประเมินมูลค่าสินค้าคงคลัง คำนวณเงินจม และวิเคราะห์สินค้าที่ไม่เคลื่อนไหวเกินกำหนด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadReport}
            disabled={loading}
            className="p-2.5 rounded-xl border border-[#30353d] bg-[#171c23] text-[#d1c6ab] hover:bg-[#1b2027] transition-colors"
            title="รีเฟรช"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-rose-600")} />
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="p-2.5 rounded-xl border border-[#30353d] bg-[#171c23] text-[#d1c6ab] hover:bg-[#1b2027] transition-colors"
            title="พิมพ์รายงาน"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 bg-[#171c23] rounded-2xl border border-[#30353d]/80 shadow-sm">
          <div className="text-[11px] font-bold text-[#8a92a6] uppercase">มูลค่าสต็อกตามราคาทุน</div>
          <div className="text-2xl font-black text-[#dee2ec] mt-1">
            ฿{(data?.totalCostValuation || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8a92a6] mt-0.5">
            รวม {data?.totalUnits.toLocaleString() || 0} ชิ้น ({data?.totalSkus || 0} SKU)
          </div>
          {!!data?.skusWithoutCost && (
            <div className="text-[11px] text-amber-400 mt-1">
              ⚠ {data.skusWithoutCost} SKU ยังไม่มีต้นทุน — ไม่นับในยอดนี้ (ตั้งราคาทุนที่หน้าสินค้า หรือรับเข้าจาก PO)
            </div>
          )}
        </div>

        <div className="p-4 bg-[#171c23] rounded-2xl border border-[#30353d]/80 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">มูลค่าสต็อกราคาขาย</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            ฿{(data?.totalRetailValuation || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            อัตรากำไรขั้นต้นคาดการณ์ ~{data?.estimatedMargin || 0}%
          </div>
        </div>

        <div className="p-4 bg-[#171c23] rounded-2xl border border-rose-500/20 bg-rose-500/10/20 shadow-sm">
          <div className="text-[11px] font-bold text-rose-600 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>เงินจมใน Dead Stock (&ge;30 วัน)</span>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            ฿{(data?.deadStockLockedCapital || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-500 font-medium mt-0.5">
            สินค้าค้างนาน {data?.deadStock30DaysCount || 0} รายการ
          </div>
        </div>

        <div className="p-4 bg-[#171c23] rounded-2xl border border-[#30353d]/80 shadow-sm">
          <div className="text-[11px] font-bold text-[#8a92a6] uppercase">สินค้าวิกฤต (&ge;90 วัน)</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {data?.deadStock90DaysCount || 0} <span className="text-xs text-[#8a92a6] font-normal">รายการ</span>
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">
            แนะนำจัด Flash Sale / Bundle ด่วน
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-[#171c23] rounded-3xl border border-[#30353d]/80 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-[#30353d] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#252a32] rounded-xl overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setFilterDays(0)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 0 ? "bg-[#171c23] text-[#dee2ec] shadow-sm" : "text-[#d1c6ab]"
              )}
            >
              ทั้งหมด ({deadItems.length})
            </button>
            <button
              onClick={() => setFilterDays(30)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 30 ? "bg-[#171c23] text-amber-800 shadow-sm" : "text-[#d1c6ab]"
              )}
            >
              ค้าง &ge; 30 วัน ({data?.deadStock30DaysCount || 0})
            </button>
            <button
              onClick={() => setFilterDays(60)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 60 ? "bg-[#171c23] text-rose-700 shadow-sm" : "text-[#d1c6ab]"
              )}
            >
              ค้าง &ge; 60 วัน ({data?.deadStock60DaysCount || 0})
            </button>
            <button
              onClick={() => setFilterDays(90)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 90 ? "bg-[#171c23] text-rose-800 shadow-sm" : "text-[#d1c6ab]"
              )}
            >
              วิกฤต &ge; 90 วัน ({data?.deadStock90DaysCount || 0})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8a92a6] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหา SKU, ชื่อสินค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#1b2027] border border-[#30353d] rounded-xl focus:bg-[#171c23] focus:outline-none"
            />
          </div>
        </div>

        {/* Dead Stock Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1b2027]/80 text-[#8a92a6] font-bold uppercase border-b border-[#30353d]">
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
            <tbody className="divide-y divide-[#30353d]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#8a92a6]">
                    ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.sku} className="hover:bg-[#1b2027] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#dee2ec]">{item.name}</div>
                      <div className="text-[11px] text-[#8a92a6] font-mono">
                        {item.sku} · {item.category}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-[#252a32] text-[#d1c6ab] font-mono text-[11px]">
                        {item.location}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-[#dee2ec]">
                      {item.stock.toLocaleString()} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-[#d1c6ab]">
                      {item.costSource === 'NONE'
                        ? <span className="text-amber-400 text-[11px]">ไม่มีต้นทุน</span>
                        : <>฿{item.costPrice.toLocaleString()}</>}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600">
                      ฿{item.totalCostValue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                          item.daysDormant >= 90
                            ? "bg-rose-500/20 text-rose-800 border border-rose-500/30"
                            : item.daysDormant >= 60
                            ? "bg-amber-500/20 text-amber-800 border border-amber-500/30"
                            : "bg-[#252a32] text-[#d1c6ab]"
                        )}
                      >
                        {item.daysDormant} วัน
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[#d1c6ab] font-medium text-[11px]">
                        {item.suggestedAction}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
