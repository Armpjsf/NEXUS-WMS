'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Native app (APK) always goes to the mobile UI. Capacitor.isNativePlatform()
    // is reliable; the raw window.Capacitor global can be missing on cold start,
    // which previously sent the APK to the heavy desktop /dashboard.
    const isMobile = Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.innerWidth < 768);
    
    // replace() (not push) so the root spinner never sits in the back stack,
    // avoiding a back-button loop back onto this loading screen.
    router.replace(isMobile ? '/mobile' : '/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}
