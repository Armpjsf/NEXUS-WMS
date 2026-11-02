'use client';

import { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Box, LayoutGrid, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';

// Three.js simulator dynamic import without SSR
const WarehouseProcessSimulator3D = dynamic(
  () => import('@/components/warehouse/WarehouseProcessSimulator3D'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[760px] w-full rounded-2xl border border-slate-800 bg-[#0c1015] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-slate-400 font-bold text-sm">กำลังโหลด NEXUS 3D Process Simulator & Digital Twin...</span>
      </div>
    ),
  }
);

function useCurrentBranch(): string {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get('branchId') || '';
  const [branch, setBranch] = useState<string>(fromUrl || 'URT');

  useEffect(() => {
    if (fromUrl) {
      setBranch(fromUrl);
      return;
    }
    let cancelled = false;
    fetch(getApiUrl('/api/branches'))
      .then(r => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (cancelled) return;
        const ids = Array.isArray(list) ? list.map(b => b.id || b.code).filter(Boolean) : [];
        setBranch(ids.includes('URT') ? 'URT' : ids[0] || 'MAIN');
      })
      .catch(() => !cancelled && setBranch('URT'));
    return () => { cancelled = true; };
  }, [fromUrl]);

  return branch;
}

export default function Process3DPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
          <div className="text-slate-400 font-bold text-sm flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
            กำลังโหลด 3D Digital Twin...
          </div>
        </div>
      }
    >
      <Process3DContent />
    </Suspense>
  );
}

function Process3DContent() {
  const currentBranch = useCurrentBranch();

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-4 md:p-6 lg:p-8 relative">
      <AmbientBackground />

      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* Top Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 p-4 lg:p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <Link
              href="/inventory/map"
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-colors"
              title="กลับไปผังคลัง 2D/3D Slotting"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg lg:text-xl font-black text-white tracking-wide">
                  3D Process Simulator & SOP Digital Twin
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Interactive SOP
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  สาขา: {currentBranch}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                จำลองกระบวนการทำงานในคลังสินค้าแบบ 3D สเต็ปต่อสเต็ป 1-10 พร้อมมาตรฐาน SOP, ตรวจสอบ QC, และระบบฝึกอบรมเสมือนจริง
              </p>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/inventory/map"
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LayoutGrid className="w-4 h-4 text-teal-400" />
              2D/3D Slotting Map
            </Link>
            <Link
              href="/ops/control-tower"
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Control Tower
            </Link>
            <Link
              href="/inventory"
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              สต็อกสินค้า
            </Link>
          </div>
        </header>

        {/* 3D Simulator Container */}
        <main className="w-full">
          <WarehouseProcessSimulator3D />
        </main>
      </div>
    </div>
  );
}
