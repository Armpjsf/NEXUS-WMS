'use client';

import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingDown,
  Download,
  Search,
  Printer,
  Package,
  Boxes,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { ValuationSummary, DeadStockItem } from '@/lib/data/valuation';
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50/60">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-md shadow-rose-500/20">
            <ReceiptText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              รายงานมูลค่าสต็อก & Dead Stock (Inventory Valuation)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ประเมินมูลค่าสินค้าคงคลัง คำนวณเงินจม และวิเคราะห์สินค้าที่ไม่เคลื่อนไหวเกินกำหนด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadReport}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
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
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="พิมพ์รายงาน"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">มูลค่าสต็อกตามราคาทุน</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ฿{(data?.totalCostValuation || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            รวม {data?.totalUnits.toLocaleString() || 0} ชิ้น ({data?.totalSkus || 0} SKU)
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">มูลค่าสต็อกราคาขาย</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            ฿{(data?.totalRetailValuation || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            อัตรากำไรขั้นต้นคาดการณ์ ~{data?.estimatedMargin || 0}%
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-rose-100 bg-rose-50/20 shadow-sm">
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

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase">สินค้าวิกฤต (&ge;90 วัน)</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {data?.deadStock90DaysCount || 0} <span className="text-xs text-slate-400 font-normal">รายการ</span>
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">
            แนะนำจัด Flash Sale / Bundle ด่วน
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setFilterDays(0)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 0 ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              )}
            >
              ทั้งหมด ({deadItems.length})
            </button>
            <button
              onClick={() => setFilterDays(30)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 30 ? "bg-white text-amber-800 shadow-sm" : "text-slate-600"
              )}
            >
              ค้าง &ge; 30 วัน ({data?.deadStock30DaysCount || 0})
            </button>
            <button
              onClick={() => setFilterDays(60)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 60 ? "bg-white text-rose-700 shadow-sm" : "text-slate-600"
              )}
            >
              ค้าง &ge; 60 วัน ({data?.deadStock60DaysCount || 0})
            </button>
            <button
              onClick={() => setFilterDays(90)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filterDays === 90 ? "bg-white text-rose-800 shadow-sm" : "text-slate-600"
              )}
            >
              วิกฤต &ge; 90 วัน ({data?.deadStock90DaysCount || 0})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหา SKU, ชื่อสินค้า..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Dead Stock Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase border-b border-slate-100">
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
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    ไม่พบรายการสินค้าที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.sku} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.sku} · {item.category}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {item.location}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {item.stock.toLocaleString()} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ฿{item.costPrice.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-600">
                      ฿{item.totalCostValue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                          item.daysDormant >= 90
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : item.daysDormant >= 60
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {item.daysDormant} วัน
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700 font-medium text-[11px]">
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
