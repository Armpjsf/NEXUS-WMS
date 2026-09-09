'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Building2, ArrowRight, Loader2, CheckCircle2, Warehouse } from 'lucide-react';

const PLANS = [
  { id: 'FREE', name: 'Free', desc: 'เริ่มต้นใช้งาน' },
  { id: 'PRO', name: 'Pro', desc: 'ทีมขนาดกลาง' },
  { id: 'ENTERPRISE', name: 'Enterprise', desc: 'หลายสาขา' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState('FREE');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!orgName || !username || !password) { toast.error('กรอกข้อมูลให้ครบ'); return; }
    if (password.length < 6) { toast.error('รหัสผ่านอย่างน้อย 6 ตัว'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, plan, adminUsername: username, adminPassword: password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'สมัครไม่สำเร็จ');
      setDone(true);
      toast.success('สร้างองค์กรสำเร็จ!');
      setTimeout(() => router.push('/login'), 1800);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-grid place-items-center w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white shadow-xl shadow-cyan-500/25 mb-4">
            <Warehouse className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">สร้างคลังของคุณ</h1>
          <p className="text-slate-500 font-medium mt-1">สมัครใช้งาน WMS 360 — พร้อมข้อมูลตัวอย่างให้เริ่มได้ทันที</p>
        </div>

        {done ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-900">พร้อมใช้งานแล้ว!</h2>
            <p className="text-slate-500 mt-1">กำลังพาไปหน้าเข้าสู่ระบบ...</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-7 space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">ชื่อองค์กร / บริษัท</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="เช่น ดีดี คลังสินค้า" className="w-full pl-11 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-cyan-500" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">แพ็กเกจ</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map(p => (
                  <button key={p.id} onClick={() => setPlan(p.id)} className={`rounded-xl border p-2.5 text-left transition-colors ${plan === p.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="font-bold text-sm text-slate-800">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">บัญชีผู้ดูแล</div>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ชื่อผู้ใช้ (username)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-800 outline-none focus:border-cyan-500" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-800 outline-none focus:border-cyan-500" />
            </div>

            <button onClick={submit} disabled={loading} className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {loading ? 'กำลังสร้าง...' : 'สร้างองค์กร'}
            </button>

            <p className="text-center text-sm text-slate-400">มีบัญชีแล้ว? <Link href="/login" className="text-cyan-600 font-bold">เข้าสู่ระบบ</Link></p>
          </div>
        )}
      </div>
    </div>
  );
}
