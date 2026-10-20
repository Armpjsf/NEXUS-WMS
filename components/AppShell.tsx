'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import CommandHeader from '@/components/CommandHeader';
import GlobalAIAssistant from '@/components/GlobalAIAssistant';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Detect native (Capacitor), standalone PWA, or mobile device after mount to avoid hydration mismatch.
  const [isNative, setIsNative] = useState(false);
  const [hasSafeAreaShield, setHasSafeAreaShield] = useState(false);

  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    setIsNative(native);

    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      (window.navigator as any)?.standalone === true;

    const ua = window.navigator?.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isMobileDevice = native || standalone || isIOS || isAndroid;

    // Measure browser-reported env(safe-area-inset-top)
    let envSafeTop = 0;
    try {
      const probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.top = '0';
      probe.style.height = '0';
      probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      document.body.appendChild(probe);
      envSafeTop = parseFloat(window.getComputedStyle(probe).paddingTop || '0') || 0;
      document.body.removeChild(probe);
    } catch {
      envSafeTop = 0;
    }

    const root = document.documentElement;
    if (native || standalone || (isMobileDevice && (pathname === '/login' || pathname.startsWith('/mobile')))) {
      // Smart fallback when WebView / older mobile browser reports 0px for env(safe-area-inset-top):
      // - iOS Dynamic Island / Notch: 48px top, 20px bottom
      // - Android Capacitor / Cutout / Status Bar: 28px top, 16px bottom
      const fallbackTop = isIOS ? '48px' : '28px';
      const fallbackBottom = isIOS ? '20px' : '16px';
      root.style.setProperty('--app-safe-top', envSafeTop > 0 ? `${envSafeTop}px` : fallbackTop);
      root.style.setProperty('--app-safe-bottom', fallbackBottom);
      setHasSafeAreaShield(true);
    } else {
      root.style.setProperty('--app-safe-top', '0px');
      root.style.setProperty('--app-safe-bottom', '0px');
      setHasSafeAreaShield(envSafeTop > 0);
    }
  }, [pathname]);

  const isAuthOrMobile = pathname === '/login' || pathname.startsWith('/mobile');

  if (isAuthOrMobile) {
    return (
      <>
        {hasSafeAreaShield && <div className="mobile-status-bar-shield" aria-hidden="true" />}
        <main
          id="main-content"
          className={`mobile-shell min-h-screen bg-[#0f141b] ${pathname === '/login' ? 'pt-safe pb-safe' : ''}`}
        >
          {children}
        </main>
      </>
    );
  }

  return (
    <>
      {(isNative || hasSafeAreaShield) && <div className="mobile-status-bar-shield" aria-hidden="true" />}
      <Sidebar />
      <CommandHeader />
      <main
        id="main-content"
        style={isNative ? { paddingTop: 'calc(4rem + var(--safe-top, 0px))' } : undefined}
        className={`min-h-screen pt-16 transition-all duration-300 md:pl-80 bg-[#0f141b] ${isNative ? 'mobile-shell' : ''}`}
      >
        {children}
      </main>
      {/* In the mobile app, some hub links open full desktop pages (e.g. Direct
          Issue) that have no mobile equivalent. Give native users a persistent
          way back to the mobile home so they never get stranded. */}
      {isNative && (
        <Link
          href="/mobile"
          style={{ bottom: 'calc(1rem + var(--safe-bottom, 0px))' }}
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
