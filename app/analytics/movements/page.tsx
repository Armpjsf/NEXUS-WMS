'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Undo2, ShieldAlert,
  FileSpreadsheet, FileText, Search, Loader2, Calendar, Download, Upload,
} from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

type MType = 'IN' | 'OUT' | 'RETURN' | 'DAMAGE';

const TEMPLATES: Record<MType, { headers: string[]; example: any[] }> = {
  IN: { headers: ['รหัสสินค้า', 'จำนวน', 'ที่เก็บ', 'ล็อต', 'วันหมดอายุ (YYYY-MM-DD)', 'หมายเหตุ'], example: ['SKU-0001', 10, 'A-01-01', '', '', 'รับจากซัพพลายเออร์'] },
  OUT: { headers: ['รหัสสินค้า', 'จำนวน', 'ราคาขาย', 'เลขที่เอกสาร', 'หมายเหตุ'], example: ['SKU-0001', 5, 120, 'INV-0001', ''] },
  DAMAGE: { headers: ['ชื่อสินค้า', 'จำนวน', 'สาเหตุ', 'หมายเหตุ'], example: ['สินค้าตัวอย่าง A', 2, 'แตกหักระหว่างขนย้าย', ''] },
  RETURN: { headers: ['ชื่อลูกค้า', 'เลขออเดอร์', 'สาเหตุ', 'รหัสสินค้า', 'ชื่อสินค้า', 'จำนวน'], example: ['ลูกค้า A', 'ORD-0001', 'สินค้าชำรุด', 'SKU-0001', 'สินค้าตัวอย่าง A', 1] },
};
interface Row { date: string; type: string; docRef: string; product: string; sku: string; qty: number; location: string; note: string; status: string; }

const TABS: { id: MType; label: string; icon: any; color: string }[] = [
  { id: 'IN', label: 'รับเข้า (IN)', icon: ArrowDownToLine, color: 'emerald' },
  { id: 'OUT', label: 'จ่ายออก (OUT)', icon: ArrowUpFromLine, color: 'sky' },
  { id: 'RETURN', label: 'คืนสินค้า (RETURN)', icon: Undo2, color: 'amber' },
  { id: 'DAMAGE', label: 'ชำรุด (DAMAGE)', icon: ShieldAlert, color: 'rose' },
];
const ICON_TONE: Record<string, string> = {
  emerald: 'text-emerald-600',
  sky: 'text-sky-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
};

function fmtDate(d: string) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MovementsReportPage() {
  const [tab, setTab] = useState<MType>('IN');
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState({ count: 0, totalQty: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ type: tab });
      if (start) qs.set('start', start);
      if (end) qs.set('end', end);
      const res = await fetch(`/api/reports/movements?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      setRows(json.rows || []);
      setSummary(json.summary || { count: 0, totalQty: 0 });
    } catch { toast.error('โหลดรายงานไม่สำเร็จ'); } finally { setLoading(false); }
  }, [tab, start, end]);
  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? rows.filter(r => `${r.product} ${r.sku} ${r.docRef} ${r.note}`.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const active = TABS.find(t => t.id === tab)!;

  const exportExcel = async () => {
    if (filtered.length === 0) { toast.error('ไม่มีข้อมูลให้ส่งออก'); return; }
    const t = toast.loading('กำลังสร้าง Excel...');
    try {
      const XLSX = await import('xlsx');
      const data = filtered.map(r => ({
        'วันที่': fmtDate(r.date), 'เอกสาร': r.docRef, 'รหัส': r.sku,
        'สินค้า': r.product, 'จำนวน': r.qty, 'ที่เก็บ': r.location,
        'สถานะ': r.status, 'หมายเหตุ': r.note,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, active.label);
      XLSX.writeFile(wb, `รายงาน_${active.label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('ดาวน์โหลด Excel แล้ว', { id: t });
    } catch (e) { toast.error('ส่งออกไม่สำเร็จ: ' + errorMessage(e), { id: t }); }
  };

  const downloadTemplate = async () => {
    const tpl = TEMPLATES[tab];
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([tpl.headers, tpl.example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, active.label);
    XLSX.writeFile(wb, `เทมเพลต_${active.label}.xlsx`);
    toast.success('ดาวน์โหลดเทมเพลตแล้ว — กรอกข้อมูลแล้วนำเข้าได้เลย');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    const t = toast.loading('กำลังนำเข้า...');
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const dataRows = aoa.slice(1).filter(r => r && r.some(c => c !== '' && c != null));
      if (dataRows.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์');

      let ok = 0;
      if (tab === 'IN' || tab === 'OUT') {
        const items = dataRows.map(r => tab === 'IN'
          ? { sku: String(r[0] || '').trim(), qty: Number(r[1]) || 0, location: r[2] || '', batch: r[3] || '', expiryDate: r[4] || '', docRef: r[5] || '' }
          : { sku: String(r[0] || '').trim(), qty: Number(r[1]) || 0, salePrice: Number(r[2]) || 0, docRef: r[3] || '' })
          .filter(i => i.sku && i.qty > 0);
        if (items.length === 0) throw new Error('ไม่พบรายการที่ถูกต้อง (รหัสสินค้า + จำนวน)');
        const res = await fetch(tab === 'IN' ? '/api/inbound' : '/api/outbound', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error + (json.shortages ? `: ${json.shortages.join(', ')}` : ''));
        ok = items.length;
      } else if (tab === 'DAMAGE') {
        for (const r of dataRows) {
          const product_name = String(r[0] || '').trim();
          const quantity = Number(r[1]) || 0;
          const reason = String(r[2] || '').trim() || 'นำเข้าจากไฟล์';
          if (!product_name || quantity <= 0) continue;
          const res = await fetch('/api/damage', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name, quantity, reason, notes: r[3] || '' }),
          });
          if (res.ok) ok++;
        }
      } else if (tab === 'RETURN') {
        const groups: Record<string, any> = {};
        for (const r of dataRows) {
          const key = String(r[1] || 'NO-ORDER');
          if (!groups[key]) groups[key] = { customerName: r[0] || '', orderNo: r[1] || '', reason: r[2] || '', items: [] };
          const qty = Number(r[5]) || 0;
          if (qty > 0) groups[key].items.push({ sku: String(r[3] || '').trim(), name: r[4] || r[3] || '', qty });
        }
        for (const g of Object.values(groups) as any[]) {
          if (g.items.length === 0) continue;
          const res = await fetch('/api/returns', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g),
          });
          if (res.ok) ok += g.items.length;
        }
      }

      toast.success(`นำเข้าสำเร็จ ${ok} รายการ`, { id: t });
      load();
    } catch (err) {
      toast.error('นำเข้าไม่สำเร็จ: ' + errorMessage(err), { id: t, duration: 6000 });
    } finally { setImporting(false); }
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative text-slate-900 print:p-0 print:bg-white">
      <style>{`@media print { .no-print{display:none!important} .print-area{box-shadow:none!important;border:1px solid #cbd5e1!important;background:#fff!important} @page{margin:12mm} body{-webkit-print-color-adjust:exact} }`}</style>

      <div className="max-w-[1500px] mx-auto space-y-5">
        <Link
          href="/analytics"
          className="no-print inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> วิเคราะห์
        </Link>

        {/* Open Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Movement Register
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <active.icon className={`w-7 h-7 ${ICON_TONE[active.color]}`} />
              <span>รายงานการเคลื่อนไหว</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">ประวัติ รับ / จ่าย / คืน / ชำรุด · ส่งออก Excel &amp; PDF</p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={downloadTemplate}
              title="ดาวน์โหลดเทมเพลตสำหรับนำเข้า"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 text-xs font-semibold shadow-xs transition-all"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" /> เทมเพลต
            </button>
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-xs cursor-pointer transition-all border ${importing ? 'bg-slate-200 text-slate-500 border-slate-200' : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border-white/90'}`}>
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <Upload className="w-3.5 h-3.5 text-sky-600" />} นำเข้าไฟล์
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} disabled={importing} className="hidden" />
            </label>
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* Pill Tabs & Filters */}
        <div className="no-print nx-glass-card p-4 space-y-3.5">
          <div className="flex flex-wrap gap-2">
            {TABS.map(tb => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold text-xs border transition-all",
                  tab === tb.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white/75 text-slate-600 border-white/90 hover:bg-white hover:text-slate-900'
                )}
              >
                <tb.icon className="w-3.5 h-3.5" /> {tb.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาสินค้า / รหัส / เอกสาร..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/85 border border-white/90 rounded-full text-sm text-slate-900 placeholder:text-slate-400 shadow-xs outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/85 border border-white/90 rounded-full px-4 py-1.5 shadow-xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input type="date" value={start} onChange={e => setStart(e.target.value)} className="bg-transparent text-slate-700 text-xs py-1 font-semibold outline-none" />
              <span className="text-slate-400">–</span>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="bg-transparent text-slate-700 text-xs py-1 font-semibold outline-none" />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="nx-glass-card p-5">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">จำนวนรายการ</div>
            <div className="text-3xl font-bold tabular-nums text-slate-900 mt-1">{summary.count.toLocaleString()}</div>
          </div>
          <div className="nx-glass-card p-5">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">จำนวนรวม (ชิ้น)</div>
            <div className="text-3xl font-bold tabular-nums text-emerald-700 mt-1">{summary.totalQty.toLocaleString()}</div>
          </div>
        </div>

        {/* Table */}
        <div className="print-area nx-glass-card overflow-hidden">
          <div className="hidden print:block px-5 py-3 border-b border-slate-200 font-bold text-slate-900">
            รายงาน{active.label} · {start || 'ทั้งหมด'} – {end || 'ปัจจุบัน'} · {summary.count} รายการ
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-700">
              <thead>
                <tr className="bg-slate-50/80 sticky top-0 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
                  <th className="text-left px-5 py-3.5">วันที่</th>
                  <th className="text-left px-5 py-3.5">เอกสาร</th>
                  <th className="text-left px-5 py-3.5">สินค้า</th>
                  <th className="text-right px-5 py-3.5">จำนวน</th>
                  <th className="text-left px-5 py-3.5">ที่เก็บ</th>
                  <th className="text-left px-5 py-3.5">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-14 text-slate-500"><Loader2 className="w-6 h-6 animate-spin inline text-emerald-600" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-14 text-slate-500">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-sky-700">{r.docRef}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {r.product}
                      {r.status && <span className="ml-2 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{r.status}</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900 tabular-nums">{r.qty.toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{r.location}</td>
                    <td className="px-5 py-3 text-slate-500 max-w-[240px] truncate">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
