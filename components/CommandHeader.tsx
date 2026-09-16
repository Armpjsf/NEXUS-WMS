'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/config';
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
    <header className="fixed top-0 left-0 md:left-80 right-0 h-16 bg-[#090f15]/95 backdrop-blur-md border-b border-[#30353d]/50 z-40 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu Toggle & Barcode Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded bg-[#252a32] border border-[#30353d] text-[#dee2ec] hover:text-[#facc15]"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d1c6ab] w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="สแกนบาร์โค้ด, พิมพ์รหัสพาเลท (PLT-), SKU, หรือเลขตู้... [กด Enter]"
            className="w-full bg-[#171c23] border border-[#30353d] rounded px-3 pl-9 py-1.5 text-xs text-[#dee2ec] placeholder-[#d1c6ab]/50 focus:outline-none focus:border-[#facc15] font-mono transition-colors"
          />
        </div>
      </div>

      {/* Right: Telemetry Strip, Audio/Contrast, Alerts, User Avatar */}
      <div className="flex items-center gap-4">
        <div className="hidden xl:flex flex-col text-right text-[11px] font-mono leading-tight">
          <span className="text-[#dee2ec] font-semibold">{currentTime || '-- | --:--:-- น.'}</span>
          <span className="text-[#57ec7f] flex items-center justify-end gap-1.5">
            <Activity className="w-3 h-3 animate-pulse text-[#57ec7f]" />
            ระบบออนไลน์
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mute toggle */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className="p-1.5 rounded bg-[#252a32] border border-[#30353d] text-[#d1c6ab] hover:text-[#dee2ec] transition-colors"
            title={audioMuted ? "เปิดเสียงเตือน" : "โหมดตัดเสียงเตือน"}
            type="button"
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-[#ffb4ab]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* High contrast / Display toggle */}
          <button
            onClick={toggleHighContrast}
            className={`p-1.5 rounded border transition-colors ${
              highContrast 
                ? "bg-[#facc15]/20 border-[#facc15]/60 text-[#facc15]" 
                : "bg-[#252a32] border-[#30353d] text-[#d1c6ab] hover:text-[#dee2ec]"
            }`}
            title={highContrast ? "ปิดโหมดคอนทราสต์สูง" : "เปิดโหมดคอนทราสต์สูง (High Contrast)"}
            type="button"
          >
            <SunMedium className="w-4 h-4" />
          </button>

          {/* Notification bell with count */}
          <div className="relative">
            <button
              onClick={() => router.push('/ops')}
              className="p-1.5 rounded bg-[#252a32] border border-[#30353d] text-[#d1c6ab] hover:text-[#facc15] transition-colors"
              title="การแจ้งเตือนระบบ"
              type="button"
            >
              <Bell className="w-4 h-4" />
            </button>
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#93000a] text-[#ffdad6] rounded-full text-[9px] flex items-center justify-center font-mono font-bold">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </div>

          {/* User profile avatar */}
          <div 
            onClick={() => router.push('/admin/users')}
            className="w-8 h-8 rounded-full bg-[#facc15] text-[#1b1600] flex items-center justify-center font-bold text-xs cursor-pointer ml-1 ring-1 ring-[#ffe083]/40 hover:scale-105 transition-transform"
            title={session?.user?.name || 'Operator Profile'}
          >
            {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <User className="w-4 h-4 text-[#1b1600]" />}
          </div>
        </div>
      </div>
    </header>
  );
}
