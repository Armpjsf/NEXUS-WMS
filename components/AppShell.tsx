'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    </>
  );
}
