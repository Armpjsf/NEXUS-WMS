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
        className="bg-[#1b2027] hover:bg-[#252a32] border border-[#30353d] text-[#d1c6ab] hover:text-[#facc15] rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all shadow-sm flex items-center gap-2"
      >
        <LayoutTemplate className="w-3.5 h-3.5 text-[#facc15]" />
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
              className="absolute right-0 top-full mt-2 w-64 bg-[#171c23] border border-[#30353d] rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-[#30353d] bg-[#090f15]">
                <h3 className="font-bold text-[#dee2ec] text-xs font-mono uppercase tracking-wider">Dashboard Widgets</h3>
                <p className="text-[11px] text-[#8a92a6] font-mono">Show or hide sections</p>
              </div>
              <div className="p-2 space-y-1">
                {widgets.map(w => (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-[#252a32] rounded-lg transition-colors text-left"
                  >
                    <span className="text-xs text-[#dee2ec] font-mono">{w.label}</span>
                    {visibleWidgets[w.id] ? (
                      <Eye className="w-3.5 h-3.5 text-[#facc15]" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-[#8a92a6]/40" />
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
