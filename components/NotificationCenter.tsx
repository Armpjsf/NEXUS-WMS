'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertTriangle, Package, ClipboardList, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/config';

interface Alert {
  id: string;
  type: 'low_stock' | 'pending_damage' | 'cycle_count' | 'transaction_error';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  actionUrl?: string;
}

interface AlertSummary {
  lowStockCount: number;
  pendingDamageCount: number;
  cycleCountDue: number;
  totalUnread: number;
}

interface NotificationCenterProps {
  align?: 'left' | 'right';
}

export default function NotificationCenter({ align = 'left' }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch alerts when dropdown opens
  useEffect(() => {
    // Load dismissed alerts
    try {
        const stored = localStorage.getItem('wms-dismissed-alerts');
        if (stored) setDismissed(JSON.parse(stored));
    } catch (e) {}
    
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  // Initial fetch for badge count
  useEffect(() => {
    fetchAlerts();
    // Refetch every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/alerts'));
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <Package className="w-4 h-4" />;
      case 'pending_damage': return <AlertTriangle className="w-4 h-4" />;
      case 'cycle_count': return <ClipboardList className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'warning': return 'bg-amber-50 border-amber-200 text-amber-700';
      default: return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };

  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));
  const totalUnread = visibleAlerts.length;

  const handleClearAll = () => {
      const newDismissed = [...dismissed, ...alerts.map(a => a.id)];
      // Keep only recent 100 to prevent overflow
      const recentDismissed = newDismissed.slice(-100);
      setDismissed(recentDismissed);
      localStorage.setItem('wms-dismissed-alerts', JSON.stringify(recentDismissed));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
      >
        <Bell className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={cn(
          "absolute top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[100]",
          align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              Notifications
            </h3>
            <button 
                onClick={handleClearAll}
                className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors mr-2"
            >
                Clear All
            </button>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary Bar */}
          {summary && (summary.lowStockCount > 0 || summary.pendingDamageCount > 0) && (
            <div className="flex gap-2 p-3 border-b border-slate-100 bg-slate-50/50 text-xs">
              {summary.lowStockCount > 0 && (
                <span className="px-2 py-1 bg-rose-100 text-rose-600 rounded-lg font-bold">
                  📦 {summary.lowStockCount} Low Stock
                </span>
              )}
              {summary.pendingDamageCount > 0 && (
                <span className="px-2 py-1 bg-amber-100 text-amber-600 rounded-lg font-bold">
                  ⚠️ {summary.pendingDamageCount} Pending
                </span>
              )}
            </div>
          )}

          {/* Alert List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : visibleAlerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No new alerts</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleAlerts.slice(0, 10).map((alert) => (
                  <li key={alert.id}>
                    <Link
                      href={alert.actionUrl || '#'}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors border-l-2",
                        alert.severity === 'critical' ? 'border-l-rose-500' :
                        alert.severity === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg flex-shrink-0",
                        alert.severity === 'critical' ? 'bg-rose-100 text-rose-600' :
                        alert.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      )}>
                        {getIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{alert.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{alert.message}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-300 flex-shrink-0 mt-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {visibleAlerts.length > 0 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
              <Link
                href="/inventory?status=LOW"
                onClick={() => setIsOpen(false)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View All Low Stock Items →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
