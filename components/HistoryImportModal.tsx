'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { X, Upload, Download, History, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props { isOpen: boolean; onClose: () => void; onSuccess?: () => void }
interface Row { date: string; type: string; sku: string; qty: number; location?: string; ref?: string; note?: string; uom?: string }

export function HistoryImportModal({ isOpen, onClose, onSuccess }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const t = [
      { 'วันที่ (Date: YYYY-MM-DD)': '2026-01-05', 'ประเภท (IN/OUT/DAMAGE/ADJUST)': 'IN', 'รหัสสินค้า (SKU)': 'SKU-001', 'จำนวน (Qty)': 100, 'พิกัด (Location)': 'A-01-01', 'อ้างอิง (Ref)': 'GRN-0001', 'หมายเหตุ (Note)': 'ยกยอดมาจากระบบเดิม', 'หน่วย (UOM)': '' },
      { 'วันที่ (Date: YYYY-MM-DD)': '2026-01-08', 'ประเภท (IN/OUT/DAMAGE/ADJUST)': 'OUT', 'รหัสสินค้า (SKU)': 'SKU-001', 'จำนวน (Qty)': 20, 'พิกัด (Location)': 'A-01-01', 'อ้างอิง (Ref)': 'SO-0007', 'หมายเหตุ (Note)': '', 'หน่วย (UOM)': '' },
      { 'วันที่ (Date: YYYY-MM-DD)': '2026-01-10', 'ประเภท (IN/OUT/DAMAGE/ADJUST)': 'DAMAGE', 'รหัสสินค้า (SKU)': 'SKU-001', 'จำนวน (Qty)': 2, 'พิกัด (Location)': 'A-01-01', 'อ้างอิง (Ref)': 'DMG-01', 'หมายเหตุ (Note)': 'กล่องบุบ', 'หน่วย (UOM)': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(t);
    ws['!cols'] = [{ wch: 24 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_History');
    XLSX.writeFile(wb, 'NEXUS_WMS_Stock_History_Template.xlsx');
    toast.success('ดาวน์โหลดแม่แบบประวัติแล้ว');
  };

  const onFile = (file: File) => {
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const pick = (r: any, ...keys: string[]) => { for (const k of keys) { const f = Object.keys(r).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim()); if (f && r[f] !== '') return r[f]; } return ''; };
        const parsed: Row[] = raw.map(r => {
          let d = pick(r, 'วันที่ (Date: YYYY-MM-DD)', 'วันที่', 'Date', 'date');
          if (d instanceof Date) d = d.toISOString().slice(0, 10); else d = String(d || '').trim();
          return {
            date: d,
            type: String(pick(r, 'ประเภท (IN/OUT/DAMAGE/ADJUST)', 'ประเภท', 'Type', 'type') || '').trim(),
            sku: String(pick(r, 'รหัสสินค้า (SKU)', 'รหัสสินค้า', 'SKU', 'sku') || '').trim(),
            qty: Number(pick(r, 'จำนวน (Qty)', 'จำนวน', 'Qty', 'qty') || 0),
            location: String(pick(r, 'พิกัด (Location)', 'พิกัด', 'Location', 'location') || '').trim(),
            ref: String(pick(r, 'อ้างอิง (Ref)', 'อ้างอิง', 'Ref', 'ref') || '').trim(),
            note: String(pick(r, 'หมายเหตุ (Note)', 'หมายเหตุ', 'Note', 'note') || '').trim(),
            uom: String(pick(r, 'หน่วย (UOM)', 'หน่วย', 'UOM', 'uom') || '').trim(),
          };
        }).filter(r => r.sku && r.qty > 0);
        setRows(parsed);
        toast.success(`อ่านได้ ${parsed.length} รายการ`);
      } catch { toast.error('อ่านไฟล์ไม่สำเร็จ'); }
    };
    reader.readAsBinaryString(file);
  };

  const submit = async () => {
    if (rows.length === 0) return toast.error('อัปโหลดไฟล์ก่อน');
    setImporting(true);
    try {
      const res = await fetch('/api/stock/import-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setResult(d);
      toast.success(d.message || 'นำเข้าประวัติเรียบร้อย');
      onSuccess?.();
    } catch (e: any) { toast.error(e.message); } finally { setImporting(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#171c23] border border-[#30353d] rounded-2xl shadow-2xl max-h-[86vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30353d] sticky top-0 bg-[#171c23]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center"><History className="w-4 h-4" /></div>
            <div><h3 className="font-bold text-[#dee2ec] text-sm">นำเข้าประวัติสต็อก (Migration)</h3><p className="text-[11px] text-[#8a92a6]">รับ/จ่าย/ชำรุด/ปรับ — ระบบคำนวณยอดจากประวัติ</p></div>
          </div>
          <button onClick={onClose} className="p-2 text-[#8a92a6] hover:text-[#dee2ec]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-[11px] text-amber-200">
            ⚠️ กลยุทธ์ B: <b>นำเข้า Product Master ก่อน โดยเว้นช่อง Stock ให้ว่าง/0</b> — แล้วประวัตินี้จะบวก-ลบเป็นยอดคงเหลือจริง (ถ้าตั้งยอดไว้แล้วจะนับซ้ำ)
          </div>

          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="flex-1 py-2.5 rounded-xl bg-[#252a32] border border-[#30353d] text-[#dee2ec] text-xs font-bold flex items-center justify-center gap-1.5"><Download className="w-4 h-4" /> ดาวน์โหลดแม่แบบ</button>
            <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#1b1600] text-xs font-bold flex items-center justify-center gap-1.5"><Upload className="w-4 h-4" /> เลือกไฟล์</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>

          {rows.length > 0 && !result && (
            <div className="rounded-xl border border-[#30353d] bg-[#1b2027] p-3 text-xs">
              <div className="flex items-center justify-between mb-2"><span className="font-bold text-[#dee2ec]">พร้อมนำเข้า {rows.length} รายการ</span></div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {rows.slice(0, 8).map((r, i) => (
                  <div key={i} className="flex justify-between text-[#8a92a6]"><span className="font-mono">{r.date} · <b className={r.type.toUpperCase() === 'IN' ? 'text-[#57ec7f]' : 'text-[#facc15]'}>{r.type}</b> · {r.sku}</span><span className="font-mono">{r.qty}</span></div>
                ))}
                {rows.length > 8 && <div className="text-[#8a92a6] text-center pt-1">… อีก {rows.length - 8} รายการ</div>}
              </div>
              <button onClick={submit} disabled={importing} className="w-full mt-3 py-2.5 rounded-xl bg-[#57ec7f] text-[#0a2012] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} ยืนยันนำเข้าประวัติ
              </button>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-[#30353d] bg-[#1b2027] p-4 text-xs space-y-2">
              <div className="text-[#57ec7f] font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> นำเข้า {result.applied}/{result.total} รายการ</div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {Object.entries(result.byType || {}).map(([k, v]: any) => v > 0 && <span key={k} className="px-2 py-0.5 rounded bg-[#252a32] text-[#dee2ec]">{k}: {v}</span>)}
              </div>
              {result.errorCount > 0 && (
                <div className="text-rose-300"><div className="flex items-center gap-1 font-bold"><AlertTriangle className="w-3.5 h-3.5" /> ข้าม {result.errorCount} รายการ:</div>
                  <div className="max-h-28 overflow-y-auto mt-1 space-y-0.5 text-[11px] text-[#8a92a6]">{result.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}</div>
                </div>
              )}
              <button onClick={onClose} className="w-full mt-1 py-2 rounded-lg bg-[#252a32] text-[#dee2ec] font-bold">ปิด</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
