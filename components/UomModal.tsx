'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Boxes, Plus, Trash2, RefreshCw, Barcode } from 'lucide-react';
import toast from 'react-hot-toast';

interface UomRow { code: string; name?: string; factor: number; barcode?: string; isBase?: boolean }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product?: any;         // needs .id or .sku (SKU) and .unit (base unit label)
  onRefresh?: () => void;
}

export function UomModal({ isOpen, onClose, product, onRefresh }: Props) {
  const sku: string = product?.id || product?.sku || '';
  const [uoms, setUoms] = useState<UomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', factor: '', barcode: '' });

  const load = useCallback(async () => {
    if (!sku) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products/uoms?sku=${encodeURIComponent(sku)}`, { cache: 'no-store' });
      const d = await res.json();
      setUoms(Array.isArray(d.uoms) ? d.uoms : []);
    } catch { toast.error('โหลดหน่วยบรรจุไม่สำเร็จ'); } finally { setLoading(false); }
  }, [sku]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const save = async () => {
    const factor = Number(form.factor);
    if (!form.code.trim()) return toast.error('ใส่รหัสหน่วย เช่น CARTON');
    if (!(factor > 0)) return toast.error('จำนวนต่อหน่วยต้องมากกว่า 0');
    setSaving(true);
    try {
      const res = await fetch('/api/products/uoms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, code: form.code.trim().toUpperCase(), name: form.name.trim() || form.code.trim(), factor, barcode: form.barcode.trim() || undefined }),
      });
      const d = await res.json();
      if (d.success === false) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      toast.success(`บันทึกหน่วย ${form.name || form.code} แล้ว`);
      setForm({ code: '', name: '', factor: '', barcode: '' });
      setUoms(Array.isArray(d.uoms) ? d.uoms : uoms);
      onRefresh?.();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const base = uoms.find(u => u.isBase);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            className="w-full max-w-lg bg-[#171c23] border border-[#30353d] rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#30353d]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center justify-center"><Boxes className="w-4 h-4" /></div>
                <div>
                  <h3 className="font-bold text-[#dee2ec] text-sm leading-tight">หน่วยบรรจุ (Pack Hierarchy)</h3>
                  <p className="text-[11px] text-[#8a92a6] font-mono">{product?.name || sku}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-[#8a92a6] hover:text-[#dee2ec]"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-[11px] text-[#8a92a6]">สต็อกเก็บเป็น <b className="text-[#dee2ec]">{base?.name || 'หน่วยฐาน'}</b> เสมอ — กำหนดว่าหน่วยใหญ่ 1 หน่วยมีกี่ {base?.name || 'ชิ้น'} เพื่อรับ/สั่งเป็นลัง–พาเลทได้</p>

              {/* existing units */}
              <div className="space-y-1.5">
                {loading ? <div className="text-xs text-[#8a92a6] py-3 text-center">กำลังโหลด...</div> :
                  uoms.map((u, i) => (
                    <div key={u.code + i} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${u.isBase ? 'bg-[#1b2027] border-[#30353d]' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#dee2ec]">{u.code}</span>
                        <span className="text-xs text-[#8a92a6]">{u.name}</span>
                        {u.barcode && <span className="inline-flex items-center gap-1 text-[10px] text-[#8a92a6]"><Barcode className="w-3 h-3" />{u.barcode}</span>}
                      </div>
                      <span className="text-xs font-mono">
                        {u.isBase ? <span className="text-[#57ec7f]">หน่วยฐาน</span> : <span className="text-indigo-300">= {u.factor} {base?.name || 'ชิ้น'}</span>}
                      </span>
                    </div>
                  ))}
              </div>

              {/* add form */}
              <div className="rounded-xl border border-[#30353d] bg-[#1b2027] p-3 space-y-2.5">
                <div className="text-[11px] font-bold text-[#d1c6ab] flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> เพิ่มหน่วยบรรจุ</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="รหัส เช่น CARTON" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-2.5 py-2 text-xs text-[#dee2ec] outline-none focus:border-indigo-400 font-mono" />
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อ เช่น ลัง" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-2.5 py-2 text-xs text-[#dee2ec] outline-none focus:border-indigo-400" />
                  <input value={form.factor} onChange={e => setForm(f => ({ ...f, factor: e.target.value }))} inputMode="numeric" placeholder={`กี่ ${base?.name || 'ชิ้น'} /หน่วย`} className="bg-[#0f141b] border border-[#30353d] rounded-lg px-2.5 py-2 text-xs text-[#dee2ec] outline-none focus:border-indigo-400 font-mono" />
                  <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="บาร์โค้ดลัง (ไม่บังคับ)" className="bg-[#0f141b] border border-[#30353d] rounded-lg px-2.5 py-2 text-xs text-[#dee2ec] outline-none focus:border-indigo-400 font-mono" />
                </div>
                <button onClick={save} disabled={saving} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} บันทึกหน่วย
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
