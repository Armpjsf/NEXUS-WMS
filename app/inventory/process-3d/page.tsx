'use client';

import { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Box, LayoutGrid, Sparkles, RefreshCw, Layers, Building2 } from 'lucide-react';
import { getApiUrl } from '@/lib/config';

// Three.js simulator dynamic import without SSR
const WarehouseProcessSimulator3D = dynamic(
  () => import('@/components/warehouse/WarehouseProcessSimulator3D'),
  {
    ssr: false,
    loading: () => (
      <div className="nx-glass-card h-[760px] w-full flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-slate-700 font-semibold text-sm">กำลังโหลด NEXUS 3D Process Simulator &amp; Digital Twin...</span>
      </div>
    ),
  }
);

interface BranchOption {
  id: string;
  name: string;
}

export default function Process3DPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-nexus-hybrid min-h-screen flex items-center justify-center">
          <div className="nx-glass-card px-6 py-4 text-slate-700 font-semibold text-sm flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromUrl = searchParams.get('branchId') || '';

  const [branches, setBranches] = useState<BranchOption[]>([
    { id: 'hq', name: 'สำนักงานใหญ่ (HQ)' },
  ]);
  const [currentBranch, setCurrentBranch] = useState<string>(fromUrl || 'hq');

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl('/api/branches'))
      .then((r) => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (cancelled) return;
        const parsed: BranchOption[] = [
          { id: 'hq', name: 'สำนักงานใหญ่ (HQ)' },
          ...(Array.isArray(list)
            ? list
                .filter((b) => b && (b.id || b.code) && String(b.id || b.code).toLowerCase() !== 'hq')
                .map((b) => ({
                  id: String(b.id || b.code),
                  name: String(b.name || b.id || b.code),
                }))
            : []),
        ];
        setBranches(parsed);

        if (fromUrl) {
          setCurrentBranch(fromUrl);
        } else {
          // Prefer fmc or first configured branch if available, otherwise hq
          const preferred =
            parsed.find((b) => b.id.toLowerCase() === 'fmc') ||
            parsed.find((b) => b.id.toLowerCase() === 'urt') ||
            parsed[0];
          if (preferred) setCurrentBranch(preferred.id);
        }
      })
      .catch(() => {
        if (!cancelled && fromUrl) setCurrentBranch(fromUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [fromUrl]);

  const handleBranchChange = (nextBranch: string) => {
    setCurrentBranch(nextBranch);
    const params = new URLSearchParams(searchParams.toString());
    params.set('branchId', nextBranch);
    router.replace(`/inventory/process-3d?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="theme-nexus-hybrid min-h-screen text-slate-900 p-4 md:p-6 lg:p-8 relative">
      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* Top Control HUD */}
        <header className="nx-glass-card flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 lg:p-5">
          <div className="flex items-center gap-3.5">
            <Link
              href={`/inventory/map?branchId=${encodeURIComponent(currentBranch)}`}
              className="p-2.5 bg-white/85 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-slate-200/80 shadow-xs transition-colors"
              title="กลับไปผังคลัง 2D/3D Slotting"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="nx-dark-accent-card w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
              <Box className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">
                  3D Process Simulator &amp; Smart AI Digital Twin
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 border border-amber-500/25">
                  Autonomous Fleet
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/12 text-sky-800 border border-sky-500/25">
                  AI Route Ribbon
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/12 text-rose-700 border border-rose-500/25">
                  Live Heatmap
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                จำลองคลังสินค้าอัจฉริยะ 3D เชื่อมต่อผังแร็คจริง พร้อมฝูงรถโฟล์กลิฟต์อัตโนมัติ (FL-01..03), เส้นทางนำทางหยิบสินค้า, โหมดสแกน Heatmap และคลิกตรวจสอบวัตถุ 3D รายจุด
              </p>
            </div>
          </div>

          {/* Branch Selector & Quick Navigation Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/85 border border-slate-200/90 rounded-full px-3.5 py-1.5 shadow-xs">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-semibold text-slate-500">สาขา:</span>
              <select
                value={currentBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer pr-1"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.id.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <Link
              href={`/inventory/map?branchId=${encodeURIComponent(currentBranch)}`}
              className="px-4 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 shadow-xs rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
              2D/3D Slotting Map
            </Link>
            <Link
              href="/ops/control-tower"
              className="px-4 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 shadow-xs rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              Control Tower
            </Link>
            <Link
              href="/inventory"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              สต็อกสินค้า
            </Link>
          </div>
        </header>

        {/* 3D Simulator Container */}
        <main className="w-full">
          <WarehouseProcessSimulator3D branchId={currentBranch} defaultTheme="light" />
        </main>
      </div>
    </div>
  );
}
