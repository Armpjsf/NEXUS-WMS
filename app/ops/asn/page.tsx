'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Plus, Truck, Trash2, PackageCheck, X, Calendar } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

interface AsnItem {
  sku: string;
  name: string;
  expectedQty: number;
}
interface Asn {
  id: string;
  asnNo: string;
  supplier: string;
  poNumber: string;
  eta?: string;
  status: string;
  receiptId?: string;
  items: AsnItem[];
  createdAt: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอรับ', cls: 'bg-amber-500/15 text-amber-800 border-amber-500/25' },
  RECEIVED: { label: 'รับแล้ว', cls: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20' },
  CANCELLED: { label: 'ยกเลิก', cls: 'bg-rose-500/12 text-rose-700 border-rose-500/20' },
};

export default function AsnPage() {
  const [asns, setAsns] = useState<Asn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await (await fetch('/api/asn', { cache: 'no-store' })).json();
      setAsns(d.asns || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const receive = async (a: Asn) => {
    if (!confirm(`สร้างใบรับเข้าจาก ${a.asnNo}? จะเข้าสู่คิวรับเข้า (Receiving) เพื่อสแกน/จัดเก็บ`)) return;
    setBusy(a.id);
    try {
      const d = await (
        await fetch('/api/asn/receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asnId: a.id }),
        })
      ).json();
      if (d.error) throw new Error(d.error);
      toast.success(d.message || 'สร้างใบรับแล้ว');
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Open Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/ops"
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>ปฏิบัติการ</span>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-700">
                  <Truck className="w-5 h-5" />
                </span>
                <span>ASN แจ้งของเข้าล่วงหน้า</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Advanced Shipping Notice → แปลงเป็นใบรับเข้าอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> สร้าง ASN
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="p-2.5 rounded-full bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 shadow-xs transition disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ASN List */}
        <main className="space-y-3">
          {loading && asns.length === 0 ? (
            <div className="nx-glass-card text-center text-slate-600 py-16 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-emerald-600" /> กำลังโหลด...
            </div>
          ) : asns.length === 0 ? (
            <div className="nx-glass-card text-center text-slate-600 py-16 text-sm">
              ยังไม่มี ASN — กด &quot;สร้าง ASN&quot; เพื่อเริ่ม
            </div>
          ) : (
            asns.map((a) => {
              const st = STATUS[a.status] || STATUS.PENDING;
              const units = a.items.reduce((s, i) => s + i.expectedQty, 0);
              return (
                <div key={a.id} className="nx-glass-card p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-sm">{a.asnNo}</span>
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 tabular-nums">
                        {a.supplier || 'ไม่ระบุผู้ขาย'}
                        {a.poNumber ? ` · PO ${a.poNumber}` : ''}
                        {a.eta ? ` · ETA ${a.eta}` : ''} · {a.items.length} รายการ / {units} ชิ้น
                      </div>
                    </div>
                    {a.status === 'PENDING' && (
                      <button
                        onClick={() => receive(a)}
                        disabled={busy === a.id}
                        className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                      >
                        {busy === a.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PackageCheck className="w-4 h-4" />
                        )}
                        รับเข้า
                      </button>
                    )}
                    {a.status === 'RECEIVED' && (
                      <span className="text-xs font-mono text-slate-500">→ ใบรับ {a.receiptId?.slice(0, 8)}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>

      {showCreate && (
        <CreateAsn
          onClose={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateAsn({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pos, setPos] = useState<any[]>([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [eta, setEta] = useState('');
  const [items, setItems] = useState<{ sku: string; name: string; qty: string }[]>([
    { sku: '', name: '', qty: '' },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/po/create', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.orders)) setPos(d.orders);
      })
      .catch(() => {});
  }, []);

  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId);
    const po = pos.find((p) => p.id === poId);
    if (!po) return;
    setPoNumber(po.po_number || '');
    setSupplier(po.supplier || '');
    const poLines = Array.isArray(po.items_json) ? po.items_json : [];
    if (poLines.length > 0) {
      setItems(
        poLines.map((l: any) => ({
          sku: String(l.sku || l.id || l.name || ''),
          name: String(l.name || l.sku || ''),
          qty: String(l.qty || 1),
        }))
      );
    }
  };

  const setItem = (i: number, k: string, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  const save = async () => {
    const clean = items
      .filter((i) => i.sku.trim() && Number(i.qty) > 0)
      .map((i) => ({ sku: i.sku.trim(), name: i.name.trim() || i.sku.trim(), qty: Number(i.qty) }));
    if (clean.length === 0) return toast.error('ใส่สินค้าอย่างน้อย 1 รายการ (sku + จำนวน)');
    setSaving(true);
    try {
      const d = await (
        await fetch('/api/asn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplier, poNumber, eta: eta || null, items: clean }),
        })
      ).json();
      if (d.success === false) throw new Error(d.error);
      toast.success(`สร้าง ${d.asnNo} แล้ว`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-900">สร้าง ASN ใหม่</h3>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              ดึงข้อมูลจากใบสั่งซื้อ (PO)
            </label>
            <select
              value={selectedPoId}
              onChange={(e) => handleSelectPo(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
            >
              <option value="">— เลือก PO ที่มีในระบบ หรือกรอกเองด้านล่าง —</option>
              {pos.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.po_number} · {p.supplier || 'ไม่ระบุผู้ขาย'} ({(p.items_json || []).length} รายการ)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="ผู้ขาย (Supplier)"
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
            />
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="เลข PO (ถ้ามี)"
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <Calendar className="w-4 h-4" /> ETA
            <input
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
            />
          </label>
          <div className="text-[11px] font-semibold text-slate-600 uppercase pt-2">รายการสินค้า</div>
          {items.map((it, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={it.sku}
                onChange={(e) => setItem(i, 'sku', e.target.value)}
                placeholder="SKU"
                className="flex-1 bg-slate-50/70 border border-slate-200/80 rounded-xl px-2.5 py-2 text-sm font-mono text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
              />
              <input
                value={it.name}
                onChange={(e) => setItem(i, 'name', e.target.value)}
                placeholder="ชื่อ (ไม่บังคับ)"
                className="flex-1 bg-slate-50/70 border border-slate-200/80 rounded-xl px-2.5 py-2 text-sm text-slate-900 outline-none focus:bg-white focus:border-emerald-500"
              />
              <input
                value={it.qty}
                onChange={(e) => setItem(i, 'qty', e.target.value)}
                inputMode="numeric"
                placeholder="จำนวน"
                className="w-20 bg-slate-50/70 border border-slate-200/80 rounded-xl px-2 py-2 text-sm font-mono text-center text-slate-900 tabular-nums outline-none focus:bg-white focus:border-emerald-500"
              />
              <button
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                className="p-2 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setItems([...items, { sku: '', name: '', qty: '' }])}
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="w-full mt-2 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} บันทึก ASN
          </button>
        </div>
      </div>
    </div>
  );
}
