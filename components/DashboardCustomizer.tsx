'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, LayoutTemplate } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WidgetConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
}

const widgets: WidgetConfig[] = [
  { id: 'alerts', label: 'Critical Alerts', defaultVisible: true },
  { id: 'quick_actions', label: 'Quick Actions', defaultVisible: true },
  { id: 'stats', label: 'Key Statistics', defaultVisible: true },
  { id: 'charts', label: 'Performance Charts', defaultVisible: true },
  { id: 'recent_activity', label: 'Recent Activity', defaultVisible: true },
];

export function useDashboardCustomization() {
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load config from localStorage
    const saved = localStorage.getItem('dashboard_config');
    if (saved) {
      try {
        setVisibleWidgets(JSON.parse(saved));
      } catch {
        const defaults: Record<string, boolean> = {};
        widgets.forEach(w => defaults[w.id] = w.defaultVisible);
        setVisibleWidgets(defaults);
      }
    } else {
      // Default
      const defaults: Record<string, boolean> = {};
      widgets.forEach(w => defaults[w.id] = w.defaultVisible);
      setVisibleWidgets(defaults);
    }
    setMounted(true);
  }, []);

  const toggleWidget = (id: string) => {
    const newState = { ...visibleWidgets, [id]: !visibleWidgets[id] };
    setVisibleWidgets(newState);
    localStorage.setItem('dashboard_config', JSON.stringify(newState));
  };

  return { visibleWidgets, toggleWidget, mounted };
}

export function DashboardCustomizer({
  visibleWidgets,
  toggleWidget
}: {
  visibleWidgets: Record<string, boolean>;
  toggleWidget: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-slate-700 hover:text-slate-900 rounded-full px-4 py-2 text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
      >
        <LayoutTemplate className="w-3.5 h-3.5 text-emerald-600" />
        <span>Customize</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/80">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Dashboard Widgets</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Show or hide sections</p>
              </div>
              <div className="p-2 space-y-1">
                {widgets.map(w => (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-slate-700">{w.label}</span>
                    {visibleWidgets[w.id] ? (
                      <Eye className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
