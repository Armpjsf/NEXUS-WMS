'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { User, Lock, ArrowRight, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const errorParam = searchParams.get('error');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorParam === 'CredentialsSignin' ? 'Invalid username or password' : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid username or password');
        setLoading(false);
      } else {
        // Fetch session to inspect role
        let role = '';
        try {
          const sessionRes = await fetch('/api/auth/session');
          const sessionData = await sessionRes.json();
          role = sessionData?.user?.role || '';
        } catch {
          // ignore session fetch error
        }

        const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768;
        let targetUrl = callbackUrl;

        // Staff/Warehouse workers or mobile devices go straight to /mobile
        if (role === 'Staff' || role === 'User' || isMobile) {
          try {
            const pathname = callbackUrl.startsWith('http')
              ? new URL(callbackUrl).pathname
              : callbackUrl;

            if (!pathname.startsWith('/mobile')) {
              targetUrl = '/mobile';
            }
          } catch (e) {
            targetUrl = '/mobile';
          }
        } else {
          // Admin/Manager on desktop go to /dashboard
          if (targetUrl === '/' || targetUrl.startsWith('/mobile')) {
            targetUrl = '/dashboard';
          }
        }
        window.location.href = targetUrl;
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-slate-900">
      <div className="w-full max-w-md">
        <div className="nx-glass-card overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Login Hero Accent */}
          <div className="nx-dark-accent-card p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 p-2 flex items-center justify-center shrink-0">
              <img src="/nexus-icon.png" alt="NEXUS WMS Logo" className="w-full h-full object-contain drop-shadow" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1.5">
                <ShieldCheck className="w-3 h-3" />
                Smart Warehouse Execution
              </span>
              <h1 className="text-xl font-black text-white tracking-tight leading-tight">NEXUS WMS</h1>
              <p className="text-slate-300 text-xs mt-0.5 font-medium">กรุณาลงชื่อเข้าใช้เพื่อเข้าสู่ระบบ</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 bg-rose-500/12 border border-rose-500/25 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[48px] bg-white/90 border border-slate-200 text-slate-900 text-sm rounded-2xl focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 block pl-12 pr-4 py-3.5 outline-none transition-all font-bold placeholder:font-medium placeholder:text-slate-400"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] bg-white/90 border border-slate-200 text-slate-900 text-sm rounded-2xl focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 block pl-12 pr-4 py-3.5 outline-none transition-all font-bold placeholder:font-medium placeholder:text-slate-400"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full py-3.5 px-6 transition-all duration-200 shadow-lg shadow-emerald-600/25 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>

            <div className="text-center pt-1">
              <a href="/onboarding" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
                ยังไม่มีองค์กร? สมัครใช้งาน →
              </a>
              <p className="text-xs text-slate-400 font-medium mt-3">Inventory Management System v1.0</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
