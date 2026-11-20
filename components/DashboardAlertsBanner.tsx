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
    <div className="space-y-3">
      {/* Critical Alerts Banner */}
      {visibleAlerts.length > 0 && (
        <div className="nx-glass-card !bg-rose-50/85 text-rose-950 !border-rose-200/90 p-4 animate-in slide-in-from-top duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{visibleAlerts[0]?.title}</p>
                <p className="text-xs text-rose-700 mt-0.5">{visibleAlerts[0]?.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={visibleAlerts[0]?.actionUrl || '/inventory?status=LOW'}
                className="px-4 py-2 bg-rose-600 text-white rounded-full text-xs font-semibold hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                ดูรายละเอียด <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={dismissAll}
                className="p-1.5 text-rose-500 hover:text-rose-800 hover:bg-rose-100 rounded-full transition-colors"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Summary Pills */}
      {(hasLowStock || hasPendingDamage) && visibleAlerts.length === 0 && (
        <div className="flex gap-2.5 flex-wrap text-xs">
          {hasLowStock && (
            <Link
              href="/inventory?status=LOW"
              className={cn(
                "nx-glass-card !rounded-full px-4 py-2 font-semibold flex items-center gap-2 transition-all tabular-nums",
                summary.lowStockCount > 5
                  ? "!bg-rose-50/85 text-rose-700 !border-rose-200/90 hover:!bg-rose-100/90"
                  : "!bg-amber-50/85 text-amber-800 !border-amber-200/90 hover:!bg-amber-100/90"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.lowStockCount} สินค้าใกล้หมดสต็อก
            </Link>
          )}
          {hasPendingDamage && (
            <Link
              href="/ops/damage"
              className="nx-glass-card !rounded-full px-4 py-2 font-semibold flex items-center gap-2 !bg-amber-50/85 text-amber-800 !border-amber-200/90 hover:!bg-amber-100/90 transition-all tabular-nums"
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
