'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

// Route-level error boundary. Instead of Next's blank "client-side exception"
// white screen, show a friendly recovery card. The reload button also clears
// the service-worker caches so a stale chunk (common right after a deploy)
// heals on the next load.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  const hardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* ignore */ }
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center text-2xl mb-4">⚠️</div>
      <h2 className="text-lg font-bold mb-1">เกิดข้อผิดพลาดชั่วคราว</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        ระบบสะดุดเล็กน้อย (มักเกิดหลังอัปเดตเวอร์ชันใหม่) ลองโหลดหน้าใหม่อีกครั้ง
      </p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className="px-5 py-2.5 bg-slate-200 text-slate-800 text-sm font-bold rounded-xl active:scale-95 transition-transform">
          ลองอีกครั้ง
        </button>
        <button onClick={hardReload} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-blue-600/30">
          <RefreshCw className="w-4 h-4" /> โหลดหน้าใหม่
        </button>
      </div>
    </div>
  );
}
