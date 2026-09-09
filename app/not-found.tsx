import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-2xl mb-4">
        404
      </div>
      <h2 className="text-xl font-bold text-white mb-1">ไม่พบหน้าที่คุณต้องการ</h2>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        หน้าที่คุณกำลังเข้าถึงอาจถูกย้าย ลบ หรือระบุ URL ไม่ถูกต้อง
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30"
      >
        <Home className="w-4 h-4" />
        <span>กลับสู่หน้าหลัก</span>
      </Link>
    </div>
  );
}
