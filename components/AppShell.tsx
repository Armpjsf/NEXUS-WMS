'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import GlobalAIAssistant from '@/components/GlobalAIAssistant';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Detect the native (Capacitor) app after mount to avoid hydration mismatch.
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const isAuthOrMobile = pathname === '/login' || pathname.startsWith('/mobile');

  if (isAuthOrMobile) {
    return (
      <main id="main-content" className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <Sidebar />
      <main id="main-content" className="min-h-screen pt-20 transition-all duration-300 md:pl-72 md:pt-0">
        {children}
      </main>
      {/* In the mobile app, some hub links open full desktop pages (e.g. Direct
          Issue) that have no mobile equivalent. Give native users a persistent
          way back to the mobile home so they never get stranded. */}
      {isNative && (
        <Link
          href="/mobile"
          className="fixed bottom-4 right-4 z-[70] inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
        >
          <Smartphone className="w-4 h-4" />
          โหมดมือถือ
        </Link>
      )}
      {/* AI assistant is off by default (reads the whole catalog per message =
          heavy Disk IO). Re-enable later with NEXT_PUBLIC_AI_ENABLED = 'true'. */}
      {process.env.NEXT_PUBLIC_AI_ENABLED === 'true' && <GlobalAIAssistant />}
    </>
  );
}
