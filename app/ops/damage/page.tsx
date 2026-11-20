'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, CheckCircle, ArrowLeft, Truck, Printer, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import BinQuickSelect from '@/components/stock/BinQuickSelect';

interface DamageRecord {
  date: string;
  product_name: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  reported_by: string;
  status: string;
  approved_by: string;
  approved_date: string;
  sent_to_hq?: string;
}

export default function DamagePage() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<DamageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      product_name: '',
      location: '',
      quantity: 0,
      unit: '',
      reason: 'Production Defect',
      notes: ''
  });

  const fetchRecords = async () => {
      setLoading(true);
      try {
          const res = await fetch('/api/damage');
          const json = await res.json();
          if (Array.isArray(json)) setRecords(json);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const fetchProducts = async () => {
      try {
          const res = await fetch('/api/products');
          const json = await res.json();
          if (Array.isArray(json)) setProducts(json);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
      fetchRecords();
      fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.product_name || formData.quantity <= 0) return alert("Please fill incomplete fields.");

      try {
          const res = await fetch('/api/damage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData)
          });
          if (res.ok) {
              alert(t('success_inbound') || "Recorded");
              setShowForm(false);
              fetchRecords();
              setFormData({ ...formData, product_name: '', quantity: 0, notes: '', location: '' });
          } else {
              alert("Error: " + res.statusText);
          }
      } catch (e) {
          alert("Error: " + e);
      }
  };

  const handleApprove = async (index: number, currentStatus: string) => {
      if (currentStatus === t('status_approved')) return;
      if (!confirm(t('confirm_approve'))) return;

      try {
          const res = await fetch('/api/damage', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  rowIndex: index,
                  status: 'อนุมัติแล้ว',
                  approver: 'Admin'
              })
          });
          if (res.ok) {
              fetchRecords();
          }
      } catch (e) {
          alert("Error updating status");
      }
  };

  const handleSendToHq = async (index: number) => {
      if (!confirm("ยืนยันส่งสินค้าชำรุดนี้กลับสำนักงานใหญ่?")) return;

      try {
          const res = await fetch('/api/damage', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  rowIndex: index,
                  sent_to_hq: 'ส่งกลับแล้ว'
              })
          });
          if (res.ok) {
              fetchRecords();
          } else {
              alert("Failed to update HQ status");
          }
      } catch (e) {
          alert("Error updating status");
      }
  };

  const getReasonLabel = (r: string) => {
     if (r.includes("Production")) return t('cause_production');
     if (r === "Production Defect") return t('cause_production');
     if (r === "Transport Damage") return t('cause_transport');
     if (r === "Expired") return t('cause_expired');
     if (r === "Damaged during Use") return t('cause_damaged_use');
     if (r === "Other") return t('cause_other');

     if (r === "ของเสียจากการผลิต") return t('cause_production');
     if (r === "ของเสียจากการขนส่ง") return t('cause_transport');
     if (r === "ของหมดอายุ") return t('cause_expired');
     if (r === "ชำรุดเสียหายระหว่างการใช้งาน") return t('cause_damaged_use');
     if (r === "อื่นๆ") return t('cause_other');

     return r;
  };

  const pendingCount = records.filter(r => r.status !== 'อนุมัติแล้ว' && r.status !== 'Approved').length;
  const approvedCount = records.length - pendingCount;
  const totalDamagedUnits = records.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {t('back_to_dashboard')}
        </Link>

        {/* Open Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Exception Control
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <AlertTriangle className="w-7 h-7 text-rose-600 shrink-0" />
              <span>{t('damage_report_title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('damage_subtitle')}</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href="/print/damage-report"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/80 hover:bg-white border border-white/90 text-slate-700 hover:text-slate-900 font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition-all shadow-xs text-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              พิมพ์รายงานชำรุด
            </a>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-full flex items-center gap-2 transition-all shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" />
              {showForm ? t('close_form') : t('report_damage_btn')}
            </button>
          </div>
        </div>

        {/* Summary Strip with 1 Hero Dark Accent Alert Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="nx-dark-accent-card p-5 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pending Action
              </div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t('status_pending')}</p>
              <div className="text-3xl font-bold text-white tabular-nums mt-1">{pendingCount.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="nx-glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">{t('status_approved')}</p>
              <div className="text-3xl font-bold text-emerald-700 tabular-nums">{approvedCount.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">รายการอนุมัติแล้ว</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 text-emerald-700">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="nx-glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">{t('qty')}</p>
              <div className="text-3xl font-bold text-rose-600 tabular-nums">{totalDamagedUnits.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">{records.length.toLocaleString()} เคสทั้งหมด</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-rose-500/12 border border-rose-500/20 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Form Section */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="nx-glass-card p-6"
          >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('found_date')}</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('product')}</label>
                <select
                  value={formData.product_name}
                  onChange={e => {
                    const p = products.find(prod => prod.name === e.target.value);
                    setFormData({ ...formData, product_name: e.target.value, unit: p?.unit || 'pcs', location: '' });
                  }}
                  className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                >
                  <option value="">-- {t('select_product')} --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              {formData.product_name && (() => {
                const p = products.find(prod => prod.name === formData.product_name);
                return (
                  <div className="md:col-span-2 p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl">
                    <BinQuickSelect
                      sku={p?.sku || p?.id || formData.product_name}
                      selectedBin={formData.location}
                      onSelectBin={bin => setFormData({ ...formData, location: bin })}
                      mode="picking"
                      theme="light"
                      label="ของเสียหยิบจากช่องไหน (ไม่เลือก = ระบบเลือกตาม FEFO/FIFO ตอนอนุมัติ):"
                    />
                  </div>
                );
              })()}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('qty')}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('col_category')} (Reason)</label>
                <select
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                >
                  <option value="Production Defect">{t('cause_production')}</option>
                  <option value="Transport Damage">{t('cause_transport')}</option>
                  <option value="Expired">{t('cause_expired')}</option>
                  <option value="Damaged during Use">{t('cause_damaged_use')}</option>
                  <option value="Other">{t('cause_other')}</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{t('notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-white/85 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 h-24"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-6 rounded-full transition-all shadow-sm text-xs"
                >
                  {t('confirm_record')}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Table Section */}
        <div className="nx-glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 sticky top-0 text-slate-600 uppercase tracking-wider font-semibold text-[11px] border-b border-slate-200/80">
                <tr>
                  <th className="p-4">{t('date')}</th>
                  <th className="p-4">{t('product')}</th>
                  <th className="p-4 text-right">{t('qty')}</th>
                  <th className="p-4">{t('col_category')}</th>
                  <th className="p-4">{t('reporter')}</th>
                  <th className="p-4 text-center">{t('col_status')}</th>
                  <th className="p-4 text-center">{t('sent_to_hq')}</th>
                  <th className="p-4 text-center">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500 animate-pulse">{t('processing')}</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">{t('no_logs')}</td></tr>
                ) : (
                  records.map((r, i) => (
                    <tr key={i} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-4 text-slate-500 font-mono text-xs whitespace-nowrap">{r.date}</td>
                      <td className="p-4 font-semibold text-slate-900">{r.product_name}</td>
                      <td className="p-4 text-right text-rose-600 font-bold tabular-nums">{r.quantity.toLocaleString()} {r.unit}</td>
                      <td className="p-4 text-slate-700">{getReasonLabel(r.reason)}</td>
                      <td className="p-4 text-slate-600">{r.reported_by}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          r.status === 'อนุมัติแล้ว' || r.status === 'Approved'
                            ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-800 border-amber-500/25'
                        }`}>
                          {r.status === 'อนุมัติแล้ว' || r.status === 'Approved' ? t('status_approved') : t('status_pending')}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          r.sent_to_hq === 'ส่งกลับแล้ว' || r.sent_to_hq === 'Sent'
                            ? 'bg-emerald-500/12 text-emerald-700 border-emerald-500/20'
                            : 'bg-slate-900/6 text-slate-600 border-slate-200'
                        }`}>
                          {r.sent_to_hq === 'ส่งกลับแล้ว' || r.sent_to_hq === 'Sent' ? t('status_sent') : t('status_not_sent')}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {(r.status !== 'อนุมัติแล้ว' && r.status !== 'Approved') ? (
                            <button
                              onClick={() => handleApprove(i, r.status)}
                              className="p-2 bg-white hover:bg-emerald-600 text-slate-600 hover:text-white border border-slate-200 rounded-full transition-colors shadow-xs"
                              title={t('approve_btn')}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-1 text-xs font-bold bg-emerald-500/12 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <CheckCircle className="w-3.5 h-3.5" /> {t('status_approved')}
                            </span>
                          )}

                          {(r.sent_to_hq !== 'ส่งกลับแล้ว' && r.sent_to_hq !== 'Sent') ? (
                            <button
                              onClick={() => handleSendToHq(i)}
                              className="p-2 bg-white hover:bg-amber-600 text-slate-600 hover:text-white border border-slate-200 rounded-full transition-colors shadow-xs"
                              title={t('mark_as_sent')}
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-1 text-xs font-bold bg-emerald-500/12 px-2.5 py-1 rounded-full border border-emerald-500/20">
                              <Truck className="w-3.5 h-3.5" /> {t('status_sent')}
                            </span>
                          )}
                        </div>
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
