'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  actionUrl?: string;
}

interface AlertSummary {
  lowStockCount: number;
  pendingDamageCount: number;
}

export default function DashboardAlertsBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchAlerts = async () => {
    try {
      const res = await fetch(getApiUrl('/api/alerts'));
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts?.filter((a: Alert) => a.severity === 'critical') || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const dismissAll = () => {
    const newDismissed = new Set(dismissed);
    alerts.forEach(a => newDismissed.add(a.id));
    setDismissed(newDismissed);
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  const hasLowStock = summary && summary.lowStockCount > 0;
  const hasPendingDamage = summary && summary.pendingDamageCount > 0;

  // Nothing to show
  if (!hasLowStock && !hasPendingDamage && visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Critical Alerts Banner */}
      {visibleAlerts.length > 0 && (
        <div className="bg-[#93000a] text-[#ffdad6] border border-[#ffb4ab]/50 rounded-xl p-4 shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-black/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-[#ffdad6]" />
              </div>
              <div>
                <p className="font-bold text-white font-headline">{visibleAlerts[0]?.title}</p>
                <p className="text-xs text-[#ffdad6] font-mono">{visibleAlerts[0]?.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={visibleAlerts[0]?.actionUrl || '/inventory?status=LOW'}
                className="px-3.5 py-1.5 bg-[#facc15] text-[#1b1600] rounded-lg text-xs font-mono font-bold hover:bg-[#eec200] transition-colors flex items-center gap-1"
              >
                ดูรายละเอียด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={dismissAll}
                className="p-1.5 text-white/70 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Summary Pills */}
      {(hasLowStock || hasPendingDamage) && visibleAlerts.length === 0 && (
        <div className="flex gap-2.5 flex-wrap font-mono text-xs">
          {hasLowStock && (
            <Link
              href="/inventory?status=LOW"
              className={cn(
                "px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all border",
                summary.lowStockCount > 5 
                  ? "bg-[#93000a]/40 text-[#ffdad6] border-[#ffb4ab]/40 hover:bg-[#93000a]/60"
                  : "bg-[#eec200]/20 text-[#facc15] border-[#facc15]/40 hover:bg-[#eec200]/30"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.lowStockCount} สินค้าใกล้หมดสต็อก
            </Link>
          )}
          {hasPendingDamage && (
            <Link
              href="/ops/damage"
              className="px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 bg-[#eec200]/20 text-[#facc15] border border-[#facc15]/40 hover:bg-[#eec200]/30 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.pendingDamageCount} รอการอนุมัติของเสีย
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
