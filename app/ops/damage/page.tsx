'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, CheckCircle, XCircle, Search, Filter, ArrowLeft, Truck, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

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
  sent_to_hq?: string; // New field to track sent to Head Office status
}

export default function DamagePage() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<DamageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [products, setProducts] = useState<any[]>([]); // Product Dropdown
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      product_name: '',
      quantity: 0,
      unit: '',
      reason: 'Production Defect', // Default internal value
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
              alert(t('success_inbound') || "Recorded"); // Reuse success message or generic
              setShowForm(false);
              fetchRecords();
              setFormData({ ...formData, product_name: '', quantity: 0, notes: '' });
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
                  rowIndex: index, // 0-based index from list corresponds to row in sheet logic
                  status: 'อนุมัติแล้ว', // Keep internal status consistent if backend expects Thai, or switch to English if safe
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
     // Map internal reason values to translation keys if possible
     // Or just return the string if it's custom.
     // Simple mapping for demo:
     if (r.includes("Production")) return t('cause_production');
     if (r === "Production Defect") return t('cause_production');
     if (r === "Transport Damage") return t('cause_transport');
     if (r === "Expired") return t('cause_expired');
     if (r === "Damaged during Use") return t('cause_damaged_use');
     if (r === "Other") return t('cause_other');
     
     // Fallback for Thai hardcoded values in DB
     if (r === "ของเสียจากการผลิต") return t('cause_production');
     if (r === "ของเสียจากการขนส่ง") return t('cause_transport');
     if (r === "ของหมดอายุ") return t('cause_expired');
     if (r === "ชำรุดเสียหายระหว่างการใช้งาน") return t('cause_damaged_use');
     if (r === "อื่นๆ") return t('cause_other');

     return r;
  }

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-[1500px] space-y-7">
      
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700">
        <ArrowLeft className="w-4 h-4" /> {t('back_to_dashboard')}
      </Link>
      
      {/* Header */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-200 bg-white/85 p-6 shadow-xl shadow-amber-900/10 backdrop-blur-xl flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-slate-700" />
        <div>
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Exception Control</p>
            <h1 className="text-3xl font-black text-slate-950 mb-2 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-lg shadow-amber-900/20">
                    <AlertTriangle className="w-6 h-6" />
                </span>
                {t('damage_report_title')}
            </h1>
            <p className="text-slate-500 font-semibold">{t('damage_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/print/damage-report"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            พิมพ์รายงานชำรุด
          </a>
          <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold py-3 px-5 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-amber-900/20"
          >
              <Plus className="w-5 h-5" />
              {showForm ? t('close_form') : t('report_damage_btn')}
          </button>
        </div>
      </div>

      {/* Form Section */}
      {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white/90 p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 backdrop-blur-xl"
          >
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-slate-400 mb-2">{t('found_date')}</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      />
                  </div>
                  <div>
                      <label className="block text-slate-400 mb-2">{t('product')}</label>
                      <select 
                        value={formData.product_name}
                        onChange={e => {
                            const p = products.find(prod => prod.name === e.target.value);
                            setFormData({...formData, product_name: e.target.value, unit: p?.unit || 'pcs'});
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      >
                          <option value="">-- {t('select_product')} --</option>
                          {products.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-slate-400 mb-2">{t('qty')}</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.quantity}
                        onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      />
                  </div>
                  <div>
                      <label className="block text-slate-400 mb-2">{t('col_category')} (Reason)</label>
                      <select 
                        value={formData.reason}
                        onChange={e => setFormData({...formData, reason: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      >
                          <option value="Production Defect">{t('cause_production')}</option>
                          <option value="Transport Damage">{t('cause_transport')}</option>
                          <option value="Expired">{t('cause_expired')}</option>
                          <option value="Damaged during Use">{t('cause_damaged_use')}</option>
                          <option value="Other">{t('cause_other')}</option>
                      </select>
                  </div>
                  <div className="md:col-span-2">
                       <label className="block text-slate-400 mb-2">{t('notes')}</label>
                       <textarea 
                         value={formData.notes}
                         onChange={e => setFormData({...formData, notes: e.target.value})}
                         className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 h-24"
                       />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                      <button type="submit" className="bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold py-3 px-8 rounded-xl transition-all">
                          {t('confirm_record')}
                      </button>
                  </div>
              </form>
          </motion.div>
      )}

      {/* Table Section */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5">
           <div className="overflow-x-auto">
           <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-900 text-white uppercase tracking-wider font-black text-[11px]">
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
                         <tr><td colSpan={8} className="p-8 text-center animate-pulse">{t('processing')}</td></tr>
                    ) : records.length === 0 ? (
                         <tr><td colSpan={8} className="p-8 text-center">{t('no_logs')}</td></tr>
                    ) : (
                        records.map((r, i) => (
                            <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                                <td className="p-4">{r.date}</td>
                                <td className="p-4 font-bold text-slate-900">{r.product_name}</td>
                                <td className="p-4 text-right text-red-400 font-bold">{r.quantity} {r.unit}</td>
                                <td className="p-4">{getReasonLabel(r.reason)}</td>
                                <td className="p-4">{r.reported_by}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        r.status === 'อนุมัติแล้ว' || r.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                    }`}>
                                        {r.status === 'อนุมัติแล้ว' || r.status === 'Approved' ? t('status_approved') : t('status_pending')}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        r.sent_to_hq === 'ส่งกลับแล้ว' || r.sent_to_hq === 'Sent' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                    }`}>
                                        {r.sent_to_hq === 'ส่งกลับแล้ว' || r.sent_to_hq === 'Sent' ? t('status_sent') : t('status_not_sent')}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        {(r.status !== 'อนุมัติแล้ว' && r.status !== 'Approved') ? (
                                            <button 
                                                onClick={() => handleApprove(i, r.status)}
                                                className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors group"
                                                title={t('approve_btn')}
                                            >
                                                <CheckCircle className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                            </button>
                                        ) : (
                                            <span className="text-emerald-400 flex items-center gap-1 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                                <CheckCircle className="w-3.5 h-3.5" /> {t('status_approved')}
                                            </span>
                                        )}
                                        
                                        {(r.sent_to_hq !== 'ส่งกลับแล้ว' && r.sent_to_hq !== 'Sent') ? (
                                            <button 
                                                onClick={() => handleSendToHq(i)}
                                                className="p-2 bg-slate-100 hover:bg-amber-600 hover:text-white rounded-lg transition-colors group"
                                                title={t('mark_as_sent')}
                                            >
                                                <Truck className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                            </button>
                                        ) : (
                                            <span className="text-emerald-400 flex items-center gap-1 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
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
