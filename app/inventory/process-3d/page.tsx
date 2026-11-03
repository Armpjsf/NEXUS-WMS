'use client';

import { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Box, LayoutGrid, Sparkles, RefreshCw, Layers, Building2 } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { getApiUrl } from '@/lib/config';

// Three.js simulator dynamic import without SSR
const WarehouseProcessSimulator3D = dynamic(
  () => import('@/components/warehouse/WarehouseProcessSimulator3D'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[760px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-slate-600 font-bold text-sm">กำลังโหลด NEXUS 3D Process Simulator & Digital Twin...</span>
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
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-600 font-bold text-sm flex items-center gap-2">
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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-6 lg:p-8 relative">
      <AmbientBackground />

      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* Top Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl border border-slate-200/90 p-4 lg:p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href={`/inventory/map?branchId=${encodeURIComponent(currentBranch)}`}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-colors"
              title="กลับไปผังคลัง 2D/3D Slotting"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Box className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg lg:text-xl font-black text-slate-900 tracking-wide">
                  3D Process Simulator & SOP Digital Twin
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Interactive SOP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                จำลองกระบวนการทำงานในคลังสินค้าแบบ 3D สเต็ปต่อสเต็ป 1-10 เชื่อมต่อผังแร็ค สต็อกจริง และใบสั่งเบิกจ่ายจริงแบบเรียลไทม์
              </p>
            </div>
          </div>

          {/* Branch Selector & Quick Navigation Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-bold text-slate-500">สาขา:</span>
              <select
                value={currentBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer pr-1"
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
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LayoutGrid className="w-4 h-4 text-teal-600" />
              2D/3D Slotting Map
            </Link>
            <Link
              href="/ops/control-tower"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Control Tower
            </Link>
            <Link
              href="/inventory"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-4 h-4 text-emerald-600" />
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
