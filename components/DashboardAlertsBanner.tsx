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

  useEffect(() => {
    fetchAlerts();
  }, []);

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
        <div className="bg-gradient-to-r from-rose-500 to-rose-600 rounded-2xl p-4 shadow-lg shadow-rose-500/20 animate-in slide-in-from-top duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="text-white">
                <p className="font-bold">{visibleAlerts[0]?.title}</p>
                <p className="text-sm text-rose-100">{visibleAlerts[0]?.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={visibleAlerts[0]?.actionUrl || '/inventory?status=LOW'}
                className="px-4 py-2 bg-white text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-50 transition-colors flex items-center gap-1"
              >
                View <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={dismissAll}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Summary Pills */}
      {(hasLowStock || hasPendingDamage) && visibleAlerts.length === 0 && (
        <div className="flex gap-3 flex-wrap">
          {hasLowStock && (
            <Link
              href="/inventory?status=LOW"
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105",
                summary.lowStockCount > 5 
                  ? "bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200"
                  : "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              {summary.lowStockCount} สินค้าใกล้หมด
            </Link>
          )}
          {hasPendingDamage && (
            <Link
              href="/ops/damage"
              className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-all hover:scale-105"
            >
              <AlertTriangle className="w-4 h-4" />
              {summary.pendingDamageCount} รอการอนุมัติของเสีย
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
