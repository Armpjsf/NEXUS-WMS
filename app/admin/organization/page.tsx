'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Building2, ArrowLeft, Upload, Loader2, Save, Palette } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

const PLANS = ['FREE', 'PRO', 'ENTERPRISE'];
const COLORS = ['#0ea5e9', '#6366f1', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#059669', '#0f172a'];

export default function OrganizationPage() {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('ENTERPRISE');
  const [color, setColor] = useState('#0ea5e9');
  const [logo, setLogo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/org', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setName(d.name || ''); setPlan(d.plan || 'ENTERPRISE');
      setColor(d.brandingColor || '#0ea5e9'); setLogo(d.brandingLogo || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('bucket', 'product-images'); fd.append('prefix', 'org-logo');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'อัปโหลดไม่สำเร็จ');
      setLogo(json.url); toast.success('อัปโหลดโลโก้แล้ว');
    } catch (err: any) { toast.error(err.message); } finally { setUploading(false); e.target.value = ''; }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/org', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, plan, brandingColor: color, brandingLogo: logo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      toast.success('บันทึกการตั้งค่าองค์กรแล้ว');
      window.dispatchEvent(new Event('org-updated'));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-[720px] mx-auto space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> ตั้งค่า</Link>

        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <span className="grid place-items-center w-11 h-11 rounded-2xl text-white shadow-lg" style={{ background: color }}><Building2 className="w-6 h-6" /></span>
            ตั้งค่าองค์กร
          </h1>
          <p className="text-slate-500 font-medium mt-1">ชื่อ โลโก้ และสีแบรนด์ที่แสดงทั่วทั้งระบบ</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-6 space-y-6 shadow-sm">
          {/* Logo + name preview */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200 grid place-items-center overflow-hidden shrink-0">
              {logo ? <img src={logo} alt="logo" className="w-full h-full object-contain" /> : <Building2 className="w-8 h-8 text-slate-300" />}
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">ชื่อองค์กร</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-slate-500" />
              <label className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition-colors ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดโลโก้'}
                <input type="file" accept="image/*" onChange={uploadLogo} disabled={uploading} className="hidden" />
              </label>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Palette className="w-4 h-4" /> สีแบรนด์</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-xl transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`} style={{ background: c }} aria-label={c} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer" />
            </div>
          </div>

          {/* Plan */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">แพ็กเกจ</label>
            <div className="flex gap-2">
              {PLANS.map(p => (
                <button key={p} onClick={() => setPlan(p)} className={`px-4 py-2 rounded-xl font-bold text-sm border transition-colors ${plan === p ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50" style={{ background: color }}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
