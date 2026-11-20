'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { 
  ScanLine, 
  Volume2, 
  VolumeX, 
  SunMedium, 
  Bell, 
  User, 
  Menu,
  Activity
} from 'lucide-react';

interface CommandHeaderProps {
  onToggleSidebar?: () => void;
}

export default function CommandHeader({ onToggleSidebar }: CommandHeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isHybrid = !pathname?.startsWith('/print') && pathname !== '/login' && !pathname?.startsWith('/mobile');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [audioMuted, setAudioMuted] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const loadAlerts = async () => {
      try {
        const res = await fetch(getApiUrl('/api/alerts'), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const critical = (data.alerts || []).filter((a: any) => a.severity === 'critical').length;
        if (active) setAlertCount(critical || (data.alerts?.length ?? 0));
      } catch {
        /* เงียบไว้ — ไม่ต้องโชว์ตัวเลขปลอมถ้าโหลดไม่ได้ */
      }
    };
    loadAlerts();
    const t = setInterval(loadAlerts, 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const toggleHighContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    if (typeof document !== 'undefined') {
      if (next) {
        document.documentElement.classList.add('contrast-125');
      } else {
        document.documentElement.classList.remove('contrast-125');
      }
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const day = now.getDate();
      const month = thaiMonths[now.getMonth()];
      const year = now.getFullYear() + 543;
      const timeStr = now.toTimeString().split(' ')[0];
      setCurrentTime(`${day} ${month} ${year} | ${timeStr} น. (UTC+7)`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header
      style={{ top: 'var(--safe-top, 0px)' }}
      className={cn(
        "fixed top-0 left-0 md:left-80 right-0 h-16 border-b z-40 px-4 md:px-6 flex items-center justify-between gap-4 transition-colors",
        isHybrid
          ? "theme-nexus-hybrid bg-white/55 backdrop-blur-xl border-white/60 text-slate-900"
          : "backdrop-blur-md bg-[#090f15]/95 border-[#30353d]/50"
      )}
    >
      {/* Left: Mobile Menu Toggle & Barcode Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleSidebar}
          className={cn(
            "md:hidden p-2 border transition-colors",
            isHybrid
              ? "rounded-full bg-white/80 border-white text-slate-700 hover:text-slate-900 hover:bg-white shadow-xs"
              : "rounded bg-[#252a32] border-[#30353d] text-[#dee2ec] hover:text-[#facc15]"
          )}
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <ScanLine className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4", isHybrid ? "text-slate-400" : "text-[#d1c6ab]")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="สแกนบาร์โค้ด, พิมพ์รหัสพาเลท (PLT-), SKU, หรือเลขตู้... [กด Enter]"
            className={cn(
              "w-full border pl-10 pr-4 py-1.5 text-xs focus:outline-none transition-all",
              isHybrid
                ? "rounded-full bg-white/85 border-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                : "rounded bg-[#171c23] border-[#30353d] text-[#dee2ec] placeholder-[#d1c6ab]/50 focus:border-[#facc15] font-mono"
            )}
          />
        </div>
      </div>

      {/* Right: Telemetry Strip, Audio/Contrast, Alerts, User Avatar */}
      <div className="flex items-center gap-4">
        <div className="hidden xl:flex flex-col text-right text-[11px] font-mono leading-tight">
          <span className={cn("font-semibold tabular-nums", isHybrid ? "text-slate-700" : "text-[#dee2ec]")}>
            {currentTime || '-- | --:--:-- น.'}
          </span>
          <span className={cn("flex items-center justify-end gap-1.5", isHybrid ? "text-emerald-700 font-medium" : "text-[#57ec7f]")}>
            <Activity className={cn("w-3 h-3 animate-pulse", isHybrid ? "text-emerald-600" : "text-[#57ec7f]")} />
            ระบบออนไลน์
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mute toggle */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className={cn(
              "p-1.5 border transition-colors",
              isHybrid
                ? "rounded-full bg-white/80 border-white text-slate-600 hover:text-slate-900 hover:bg-white shadow-xs"
                : "rounded bg-[#252a32] border-[#30353d] text-[#d1c6ab] hover:text-[#dee2ec]"
            )}
            title={audioMuted ? "เปิดเสียงเตือน" : "โหมดตัดเสียงเตือน"}
            type="button"
          >
            {audioMuted ? (
              <VolumeX className={cn("w-4 h-4", isHybrid ? "text-rose-500" : "text-[#ffb4ab]")} />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* High contrast / Display toggle */}
          <button
            onClick={toggleHighContrast}
            className={cn(
              "p-1.5 border transition-colors",
              isHybrid
                ? highContrast
                  ? "rounded-full bg-amber-50/90 border-amber-300 text-amber-700 shadow-xs"
                  : "rounded-full bg-white/80 border-white text-slate-600 hover:text-slate-900 hover:bg-white shadow-xs"
                : highContrast
                  ? "rounded bg-[#facc15]/20 border-[#facc15]/60 text-[#facc15]"
                  : "rounded bg-[#252a32] border-[#30353d] text-[#d1c6ab] hover:text-[#dee2ec]"
            )}
            title={highContrast ? "ปิดโหมดคอนทราสต์สูง" : "เปิดโหมดคอนทราสต์สูง (High Contrast)"}
            type="button"
          >
            <SunMedium className="w-4 h-4" />
          </button>

          {/* Notification bell with count */}
          <div className="relative">
            <button
              onClick={() => router.push('/ops')}
              className={cn(
                "p-1.5 border transition-colors",
                isHybrid
                  ? "rounded-full bg-white/80 border-white text-slate-600 hover:text-slate-900 hover:bg-white shadow-xs"
                  : "rounded bg-[#252a32] border-[#30353d] text-[#d1c6ab] hover:text-[#facc15]"
              )}
              title="การแจ้งเตือนระบบ"
              type="button"
            >
              <Bell className="w-4 h-4" />
            </button>
            {alertCount > 0 && (
              <span className={cn(
                "absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[9px] flex items-center justify-center font-mono font-bold",
                isHybrid ? "bg-rose-500 text-white" : "bg-[#93000a] text-[#ffdad6]"
              )}>
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </div>

          {/* User profile avatar */}
          <div 
            onClick={() => router.push('/admin/users')}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer ml-1 hover:scale-105 transition-transform",
              isHybrid
                ? "bg-slate-900 text-white ring-2 ring-emerald-500/20"
                : "bg-[#facc15] text-[#1b1600] ring-1 ring-[#ffe083]/40"
            )}
            title={session?.user?.name || 'Operator Profile'}
          >
            {session?.user?.name ? (
              session.user.name.charAt(0).toUpperCase()
            ) : (
              <User className={cn("w-4 h-4", isHybrid ? "text-white" : "text-[#1b1600]")} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
