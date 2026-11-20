'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Building2, ArrowLeft, Upload, Loader2, Save, Palette } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

const PLANS = ['FREE', 'PRO', 'ENTERPRISE'];
const COLORS = ['#0ea5e9', '#6366f1', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#059669', '#0f172a'];

export default function OrganizationPage() {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('FREE');
  const [canEditPlan, setCanEditPlan] = useState(false);
  const [planUsage, setPlanUsage] = useState<{ limits: Record<string, number>; usage: Record<string, number> } | null>(null);
  const [color, setColor] = useState('#0ea5e9');
  const [logo, setLogo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/org?usage=1', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.planUsage) setPlanUsage(d.planUsage);
      setName(d.name || ''); setPlan(d.plan || 'FREE'); setCanEditPlan(!!d.canEditPlan);
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
    } catch (err) { toast.error(errorMessage(err)); } finally { setUploading(false); e.target.value = ''; }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/org', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, brandingColor: color, brandingLogo: logo, ...(canEditPlan ? { plan } : {}) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
      toast.success('บันทึกการตั้งค่าองค์กรแล้ว');
      window.dispatchEvent(new Event('org-updated'));
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  if (loading) return <div className="theme-nexus-hybrid min-h-screen grid place-items-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="theme-nexus-hybrid min-h-screen px-4 py-6 pb-24 sm:px-6 lg:p-8 relative text-slate-900">
      <div className="max-w-[720px] mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> ตั้งค่า
        </Link>

        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <Building2 className="w-3 h-3 text-sky-600" />
              Organization &amp; Branding
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-2xl text-white shadow-sm shrink-0" style={{ background: color }}><Building2 className="w-5 h-5" /></span>
            ตั้งค่าองค์กร
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">ชื่อ โลโก้ และสีแบรนด์ที่แสดงทั่วทั้งระบบ</p>
        </div>

        <div className="nx-glass-card p-6 space-y-6">
          {/* Logo + name preview */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white/90 border border-slate-200/80 grid place-items-center overflow-hidden shrink-0">
              {logo ? <img src={logo} alt="logo" className="w-full h-full object-contain" /> : <Building2 className="w-8 h-8 text-slate-300" />}
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">ชื่อองค์กร</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/90 border border-slate-200/80 rounded-xl px-4 py-2.5 font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" />
              <label className={`mt-2.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border font-semibold text-xs cursor-pointer transition-colors ${uploading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 shadow-xs'}`}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดโลโก้'}
                <input type="file" accept="image/*" onChange={uploadLogo} disabled={uploading} className="hidden" />
              </label>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Palette className="w-4 h-4" /> สีแบรนด์</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-9 h-9 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`} style={{ background: c }} aria-label={c} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-9 rounded-full border border-slate-200/80 cursor-pointer" />
            </div>
          </div>

          {/* Plan */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">แพ็กเกจ</label>
            <div className="flex gap-2">
              {PLANS.map(p => (
                <button key={p} onClick={() => canEditPlan && setPlan(p)} disabled={!canEditPlan && plan !== p} className={`px-4 py-2 rounded-full font-semibold text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${plan === p ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'}`}>{p}</button>
              ))}
            </div>
            {!canEditPlan && <p className="text-xs text-slate-500 mt-2">เปลี่ยนแพ็กเกจได้เฉพาะผู้ดูแลแพลตฟอร์ม — ติดต่อผู้ให้บริการเพื่ออัปเกรด</p>}
            {planUsage && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {([['products', 'สินค้า (SKU)'], ['users', 'ผู้ใช้'], ['branches', 'สาขา']] as const).map(([key, label]) => {
                  const used = planUsage.usage[key] || 0;
                  const limit = planUsage.limits[key];
                  const unlimited = limit < 0;
                  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
                  return (
                    <div key={key} className="rounded-2xl border border-slate-200/80 bg-white/75 p-3.5">
                      <div className="text-[11px] font-bold text-slate-500">{label}</div>
                      <div className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
                        {used.toLocaleString()} <span className="text-slate-500 font-medium">/ {unlimited ? 'ไม่จำกัด' : limit.toLocaleString()}</span>
                      </div>
                      {!unlimited && (
                        <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-xs font-semibold shadow-sm active:scale-95 transition-all disabled:opacity-50" style={{ background: color }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึก
          </button>
        </div>

        <OrgMembers />
      </div>
    </div>
  );
}

const MEMBER_ROLES = ['Viewer', 'Staff', 'Staff - Inbound', 'Staff - Picker', 'Staff - QC & Pack', 'Staff - Dispatch', 'Staff - Inventory', 'Staff - Outbound', 'Manager', 'Admin', 'Super Admin'];

// Users from OTHER organizations who can switch into this one (org_memberships).
function OrgMembers() {
  const [members, setMembers] = useState<Array<{ userId: string; username: string; role: string; status: string }>>([]);
  const [migrated, setMigrated] = useState(true);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Staff');
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/admin/org-members', { cache: 'no-store' })
    .then(r => r.json()).then(d => { setMembers(d.members || []); setMigrated(d.migrated !== false); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const call = async (method: 'POST' | 'DELETE', body: object, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/org-members', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ไม่สำเร็จ');
      toast.success(ok); setUsername(''); load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className="nx-glass-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">สมาชิกจากองค์กรอื่น</h2>
        <p className="text-sm text-slate-600">ให้ผู้ใช้ที่มีบัญชีในองค์กรอื่นเข้ามาทำงานในองค์กรนี้ได้ — เขาสลับองค์กรได้จากแถบเมนูซ้าย</p>
      </div>
      {!migrated ? (
        <p className="text-sm text-amber-700 bg-amber-500/15 border border-amber-500/25 px-3 py-2 rounded-xl">ต้องรัน sql/20260925_cost_ratelimit_memberships.sql ก่อนใช้งานส่วนนี้</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ชื่อผู้ใช้ (username)"
              className="flex-1 bg-white/90 border border-slate-200/80 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500" />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="bg-white/90 border border-slate-200/80 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500">
              {MEMBER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button disabled={busy || !username.trim()} onClick={() => call('POST', { username: username.trim(), role }, 'เพิ่มสมาชิกแล้ว')}
              className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 transition-colors">เพิ่ม</button>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีสมาชิกจากองค์กรอื่น</p>
          ) : (
            <div className="divide-y divide-slate-200/70 rounded-2xl border border-slate-200/80 bg-white/60 overflow-hidden">
              {members.map(m => (
                <div key={m.userId} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/80 transition-colors">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{m.username}</div>
                    <div className="text-xs text-slate-500">{m.role}{m.status !== 'Active' ? ` · ${m.status}` : ''}</div>
                  </div>
                  <button disabled={busy} onClick={() => confirm(`นำ ${m.username} ออกจากองค์กรนี้?`) && call('DELETE', { userId: m.userId }, 'นำออกแล้ว')}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-rose-700 bg-rose-500/12 border border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-50 transition-colors">นำออก</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
