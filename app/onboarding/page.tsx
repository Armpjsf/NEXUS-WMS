'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Building2, ArrowRight, Loader2, CheckCircle2, Warehouse } from 'lucide-react';
import { errorMessage } from '@/lib/errors';

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
    } catch (e) { toast.error(errorMessage(e)); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 text-slate-900">
      <div className="w-full max-w-md space-y-6">
        <div className="nx-dark-accent-card p-6 text-center">
          <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
            <Warehouse className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">สร้างคลังของคุณ</h1>
          <p className="text-slate-300 text-sm font-medium mt-1">สมัครใช้งาน NEXUS — พร้อมข้อมูลตัวอย่างให้เริ่มได้ทันที</p>
        </div>

        {done ? (
          <div className="nx-glass-card p-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-black text-slate-900">พร้อมใช้งานแล้ว!</h2>
            <p className="text-slate-500 text-sm mt-1">กำลังพาไปหน้าเข้าสู่ระบบ...</p>
          </div>
        ) : (
          <div className="nx-glass-card p-6 sm:p-7 space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">ชื่อองค์กร / บริษัท</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="เช่น อัลฟ่า คลังสินค้า จำกัด"
                  className="w-full min-h-[44px] pl-11 pr-4 py-2.5 bg-white/90 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-400 placeholder:font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">แพ็กเกจ</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className={`min-h-[56px] rounded-2xl border p-2.5 text-left transition-all ${
                      plan === p.id
                        ? 'border-emerald-500 bg-emerald-500/12 ring-1 ring-emerald-500/30 text-slate-900'
                        : 'border-slate-200 bg-white/75 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-sm text-slate-900">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-5 space-y-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">บัญชีผู้ดูแล</div>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้ (username)"
                className="w-full min-h-[44px] bg-white/90 border border-slate-200 rounded-2xl px-4 py-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-400"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                className="w-full min-h-[44px] bg-white/90 border border-slate-200 rounded-2xl px-4 py-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-400"
              />
            </div>

            <button
              onClick={submit}
              disabled={loading}
              className="w-full min-h-[48px] py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {loading ? 'กำลังสร้าง...' : 'สร้างองค์กร'}
            </button>

            <p className="text-center text-sm text-slate-500">
              มีบัญชีแล้ว? <Link href="/login" className="text-emerald-700 hover:text-emerald-800 font-bold">เข้าสู่ระบบ</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
