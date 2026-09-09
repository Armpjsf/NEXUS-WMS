'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Home, 
  PackageCheck, 
  Boxes, 
  Box, 
  ClipboardCheck, 
  ShieldCheck, 
  Truck,
  Navigation
} from 'lucide-react';

import { useLanguage } from '@/components/providers/LanguageProvider';
import MobileDialogHost from '@/components/ui/MobileDialog';

export default function MobileNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || 'Staff';

  // Tailor bottom navigation based on employee's section role
  const getNavItems = () => {
    switch (role) {
      case 'Staff - Inbound':
        return [
          { href: '/mobile', label: 'หน้าหลัก', icon: Home },
          { href: '/mobile/receiving', label: 'รับสินค้าเข้า', icon: PackageCheck },
          { href: '/mobile/inventory', label: 'ค้นหาสต็อก', icon: Box },
        ];
      case 'Staff - Picker':
        return [
          { href: '/mobile', label: 'หน้าหลัก', icon: Home },
          { href: '/mobile/picking', label: 'หยิบของ (Wave)', icon: Boxes },
          { href: '/mobile/inventory', label: 'ค้นหาสต็อก', icon: Box },
        ];
      case 'Staff - QC & Pack':
        return [
          { href: '/mobile', label: 'หน้าหลัก', icon: Home },
          { href: '/mobile/orders', label: 'ตรวจ QC & แพ็ก', icon: ShieldCheck },
          { href: '/mobile/inventory', label: 'ค้นหาสต็อก', icon: Box },
        ];
      case 'Staff - Dispatch':
        return [
          { href: '/mobile', label: 'หน้าหลัก', icon: Home },
          { href: '/mobile/orders', label: 'ส่งมอบขนส่ง', icon: Truck },
          { href: '/mobile/jobs', label: 'คนขับ POD', icon: Navigation },
          { href: '/mobile/inventory', label: 'ค้นหาสต็อก', icon: Box },
        ];
      case 'Staff - Inventory':
        return [
          { href: '/mobile', label: 'หน้าหลัก', icon: Home },
          { href: '/mobile/cycle-count', label: 'ตรวจนับสต็อก', icon: ClipboardCheck },
          { href: '/mobile/inventory', label: 'ค้นหาสต็อก', icon: Box },
        ];
      default:
        // Super Admin, Admin, Manager, and general Staff see full operations
        return [
          { href: '/mobile', label: 'หน้าหลัก', icon: Home },
          { href: '/mobile/receiving', label: 'รับของ', icon: PackageCheck },
          { href: '/mobile/picking', label: 'หยิบของ', icon: Boxes },
          { href: '/mobile/orders', label: 'QC & แพ็ก', icon: ShieldCheck },
          { href: '/mobile/inventory', label: 'สต็อก', icon: Box },
          { href: '/mobile/cycle-count', label: 'ตรวจนับ', icon: ClipboardCheck },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* App-styled alert/confirm host for all mobile pages */}
      <MobileDialogHost />
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 z-50 shadow-[0_-2px_12px_rgba(15,23,42,0.06)]">
        <div className="flex justify-around items-center h-16">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
