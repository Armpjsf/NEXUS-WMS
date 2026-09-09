'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Keyboard, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Shortcut {
  key: string;
  label: string;
  description: string;
  action: () => void;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: Shortcut[] = [
    { key: 'g d', label: 'G then D', description: 'Go to Dashboard', action: () => router.push('/dashboard') },
    { key: 'g i', label: 'G then I', description: 'Go to Inventory', action: () => router.push('/inventory') },
    { key: 'g s', label: 'G then S', description: 'Go to Scan', action: () => router.push('/barcode/scanner') },
    { key: 'n i', label: 'N then I', description: 'New Inbound', action: () => router.push('/ops/receiving') },
    { key: 'n o', label: 'N then O', description: 'New Outbound', action: () => router.push('/ops/outbound') },
    { key: '?', label: '?', description: 'Show Shortcuts', action: () => setShowHelp(true) },
  ];

  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const key = e.key.toLowerCase();

    // Show help
    if (key === '?' || (e.shiftKey && key === '/')) {
      e.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    // Escape to close
    if (key === 'escape') {
      setShowHelp(false);
      setPendingKey(null);
      return;
    }

    // Two-key shortcuts (g + d, etc.)
    if (pendingKey) {
      const combo = `${pendingKey} ${key}`;
      const shortcut = shortcuts.find(s => s.key === combo);
      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
      setPendingKey(null);
      return;
    }

    // Start pending key
    if (key === 'g' || key === 'n') {
      setPendingKey(key);
      // Clear pending after 1.5 seconds
      setTimeout(() => setPendingKey(null), 1500);
    }
  }, [pendingKey, router, shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Pending Key Indicator */}
      <AnimatePresence>
        {pendingKey && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-xl font-mono text-sm shadow-lg z-50"
          >
            <span className="text-indigo-400">{pendingKey.toUpperCase()}</span> + ...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-indigo-600" />
                  Keyboard Shortcuts
                </h2>
                <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                <div className="text-xs text-slate-400 uppercase font-bold mb-2">Navigation</div>
                {shortcuts.filter(s => s.key.startsWith('g')).map(s => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-slate-600 text-sm">{s.description}</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600">
                      {s.label}
                    </kbd>
                  </div>
                ))}

                <div className="text-xs text-slate-400 uppercase font-bold mb-2 mt-4">Actions</div>
                {shortcuts.filter(s => s.key.startsWith('n')).map(s => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-slate-600 text-sm">{s.description}</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600">
                      {s.label}
                    </kbd>
                  </div>
                ))}

                <div className="text-xs text-slate-400 uppercase font-bold mb-2 mt-4">General</div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 text-sm">Show Shortcuts</span>
                  <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600">?</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 text-sm">Close / Cancel</span>
                  <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600">Esc</kbd>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400 text-center">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] font-mono">Esc</kbd> to close
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
