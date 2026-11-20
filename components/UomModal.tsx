'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Boxes, Plus, RefreshCw, Barcode } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';

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
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const base = uoms.find(u => u.isBase);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-white/90 rounded-[24px] shadow-2xl text-slate-900 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center"><Boxes className="w-4 h-4" /></div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">หน่วยบรรจุ (Pack Hierarchy)</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{product?.name || sku}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-[11px] text-slate-500">สต็อกเก็บเป็น <b className="text-slate-900">{base?.name || 'หน่วยฐาน'}</b> เสมอ — กำหนดว่าหน่วยใหญ่ 1 หน่วยมีกี่ {base?.name || 'ชิ้น'} เพื่อรับ/สั่งเป็นลัง–พาเลทได้</p>

              {/* existing units */}
              <div className="space-y-1.5">
                {loading ? <div className="text-xs text-slate-500 py-3 text-center">กำลังโหลด...</div> :
                  uoms.map((u, i) => (
                    <div key={u.code + i} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${u.isBase ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{u.code}</span>
                        <span className="text-xs text-slate-600">{u.name}</span>
                        {u.barcode && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Barcode className="w-3 h-3" />{u.barcode}</span>}
                      </div>
                      <span className="text-xs font-mono">
                        {u.isBase ? <span className="text-emerald-600 font-bold">หน่วยฐาน</span> : <span className="text-teal-700 font-bold">= {u.factor} {base?.name || 'ชิ้น'}</span>}
                      </span>
                    </div>
                  ))}
              </div>

              {/* add form */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-emerald-600" /> เพิ่มหน่วยบรรจุ</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="รหัส เช่น CARTON" className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 font-mono" />
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อ เช่น ลัง" className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500" />
                  <input value={form.factor} onChange={e => setForm(f => ({ ...f, factor: e.target.value }))} inputMode="numeric" placeholder={`กี่ ${base?.name || 'ชิ้น'} /หน่วย`} className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 font-mono" />
                  <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="บาร์โค้ดลัง (ไม่บังคับ)" className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 font-mono" />
                </div>
                <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors">
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
