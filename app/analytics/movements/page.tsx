'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Undo2, ShieldAlert,
  FileSpreadsheet, FileText, Search, Loader2, Calendar, Download, Upload,
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

type MType = 'IN' | 'OUT' | 'RETURN' | 'DAMAGE';

// Import template columns per type (header row + one example row).
const TEMPLATES: Record<MType, { headers: string[]; example: any[] }> = {
  IN: { headers: ['รหัสสินค้า', 'จำนวน', 'ที่เก็บ', 'ล็อต', 'วันหมดอายุ (YYYY-MM-DD)', 'หมายเหตุ'], example: ['SKU-0001', 10, 'A-01-01', '', '', 'รับจากซัพพลายเออร์'] },
  OUT: { headers: ['รหัสสินค้า', 'จำนวน', 'ราคาขาย', 'เลขที่เอกสาร', 'หมายเหตุ'], example: ['SKU-0001', 5, 120, 'INV-0001', ''] },
  DAMAGE: { headers: ['ชื่อสินค้า', 'จำนวน', 'สาเหตุ', 'หมายเหตุ'], example: ['สินค้าตัวอย่าง A', 2, 'แตกหักระหว่างขนย้าย', ''] },
  RETURN: { headers: ['ชื่อลูกค้า', 'เลขออเดอร์', 'สาเหตุ', 'รหัสสินค้า', 'ชื่อสินค้า', 'จำนวน'], example: ['ลูกค้า A', 'ORD-0001', 'สินค้าชำรุด', 'SKU-0001', 'สินค้าตัวอย่าง A', 1] },
};
interface Row { date: string; type: string; docRef: string; product: string; sku: string; qty: number; location: string; note: string; status: string; }

const TABS: { id: MType; label: string; icon: any; color: string }[] = [
  { id: 'IN', label: 'รับเข้า', icon: ArrowDownToLine, color: 'emerald' },
  { id: 'OUT', label: 'จ่ายออก', icon: ArrowUpFromLine, color: 'rose' },
  { id: 'RETURN', label: 'คืนสินค้า', icon: Undo2, color: 'amber' },
  { id: 'DAMAGE', label: 'ชำรุด', icon: ShieldAlert, color: 'slate' },
];
const COLOR: Record<string, string> = { emerald: 'from-emerald-600 to-teal-600', rose: 'from-rose-500 to-orange-500', amber: 'from-amber-500 to-orange-500', slate: 'from-slate-700 to-slate-500' };

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
    } catch (e: any) { toast.error('ส่งออกไม่สำเร็จ: ' + e.message, { id: t }); }
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
        // Group rows by order_no into one RMA each
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
    } catch (err: any) {
      toast.error('นำเข้าไม่สำเร็จ: ' + err.message, { id: t, duration: 6000 });
    } finally { setImporting(false); }
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden print:p-0">
      <AmbientBackground />
      <style>{`@media print { .no-print{display:none!important} .print-area{box-shadow:none!important;border:none!important} @page{margin:12mm} body{-webkit-print-color-adjust:exact} }`}</style>

      <div className="relative z-10 max-w-[1200px] mx-auto space-y-5">
        <Link href="/analytics" className="no-print inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> วิเคราะห์</Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span className={`grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br ${COLOR[active.color]} text-white shadow-lg`}><active.icon className="w-6 h-6" /></span>
              รายงานการเคลื่อนไหว
            </h1>
            <p className="text-slate-500 font-medium mt-1">ประวัติ รับ / จ่าย / คืน / ชำรุด · ส่งออก Excel &amp; PDF</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button onClick={downloadTemplate} title="ดาวน์โหลดเทมเพลตสำหรับนำเข้า" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
              <Download className="w-5 h-5" /> เทมเพลต
            </button>
            <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold shadow-sm cursor-pointer transition-all border ${importing ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:scale-95'}`}>
              {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} นำเข้าไฟล์
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} disabled={importing} className="hidden" />
            </label>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold shadow hover:bg-emerald-500 active:scale-95 transition-all">
              <FileSpreadsheet className="w-5 h-5" /> Excel
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold shadow hover:bg-slate-800 active:scale-95 transition-all">
              <FileText className="w-5 h-5" /> PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-print flex flex-wrap gap-2">
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-colors ${tab === tb.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <tb.icon className="w-4 h-4" /> {tb.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="no-print flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้า / รหัส / เอกสาร..." className="w-full pl-11 bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-slate-500" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 font-medium outline-none focus:border-slate-500" />
            <span className="text-slate-400">–</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 font-medium outline-none focus:border-slate-500" />
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-black tabular-nums text-slate-900">{summary.count.toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-500">จำนวนรายการ</div>
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-black tabular-nums text-slate-900">{summary.totalQty.toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-500">จำนวนรวม (ชิ้น)</div>
          </div>
        </div>

        {/* Table */}
        <div className="print-area rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="hidden print:block px-5 py-3 border-b border-slate-200 font-black text-slate-900">
            รายงาน{active.label} · {start || 'ทั้งหมด'} – {end || 'ปัจจุบัน'} · {summary.count} รายการ
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">วันที่</th>
                  <th className="text-left px-4 py-3 font-semibold">เอกสาร</th>
                  <th className="text-left px-4 py-3 font-semibold">สินค้า</th>
                  <th className="text-right px-4 py-3 font-semibold">จำนวน</th>
                  <th className="text-left px-4 py-3 font-semibold">ที่เก็บ</th>
                  <th className="text-left px-4 py-3 font-semibold">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin inline" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-slate-400">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.docRef}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.product}{r.status && <span className="ml-2 text-[10px] text-slate-400">({r.status})</span>}</td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums">{r.qty.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.location}</td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[220px] truncate">{r.note}</td>
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
