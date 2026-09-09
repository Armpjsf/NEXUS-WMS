'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { User, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AmbientBackground />

      <div className="w-full max-w-md relative z-10">
        <div className="relative overflow-hidden bg-white/85 backdrop-blur-2xl border border-slate-200 rounded-[1.75rem] p-8 md:p-10 shadow-2xl shadow-slate-900/10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-700 via-teal-500 to-amber-500" />
          
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-slate-950 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-slate-900/25 mb-4 ring-4 ring-cyan-500/20 overflow-hidden p-2">
               <img src="/logo.png" alt="NEXUS WMS Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">NEXUS WMS</h1>
            <p className="text-xs font-bold text-cyan-600 uppercase tracking-widest mt-1">Smart Warehouse Execution</p>
            <p className="text-slate-500 text-xs mt-2 font-medium">กรุณาลงชื่อเข้าใช้เพื่อเข้าสู่ระบบ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
             {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
             )}

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                   </div>
                   <input
                     type="text"
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 block pl-12 p-4 outline-none transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                     placeholder="Enter your username"
                     required
                   />
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                   </div>
                   <input
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 block pl-12 p-4 outline-none transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                     placeholder="••••••••"
                     required
                   />
                </div>
             </div>

             <button
               type="submit"
               disabled={loading}
               className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl p-4 transition-all duration-200 shadow-lg shadow-blue-700/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
             >
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
               {!loading && <ArrowRight className="w-5 h-5" />}
             </button>
             
             <div className="text-center">
                 <a href="/onboarding" className="text-sm font-bold text-cyan-600 hover:text-cyan-700">ยังไม่มีองค์กร? สมัครใช้งาน →</a>
                 <p className="text-xs text-slate-400 font-medium mt-4">Inventory Management System v1.0</p>
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
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        </div>
    }>
        <LoginForm />
    </Suspense>
  );
}
