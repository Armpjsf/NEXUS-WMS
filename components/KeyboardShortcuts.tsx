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
    { key: 'f2', label: 'F2', description: 'เปิดสแกนเนอร์บาร์โค้ด (Open Scanner)', action: () => router.push('/barcode/scanner') },
    { key: 'g d', label: 'G then D', description: 'Go to Dashboard', action: () => router.push('/dashboard') },
    { key: 'g i', label: 'G then I', description: 'Go to Inventory', action: () => router.push('/inventory') },
    { key: 'g s', label: 'G then S', description: 'Go to Scan', action: () => router.push('/barcode/scanner') },
    { key: 'n i', label: 'N then I', description: 'New Inbound', action: () => router.push('/ops/receiving') },
    { key: 'n o', label: 'N then O', description: 'New Outbound', action: () => router.push('/ops/outbound') },
    { key: '?', label: '?', description: 'Show Shortcuts', action: () => setShowHelp(true) },
  ];

  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Global F2 shortcut works even with inputs unless shift/alt
    if (e.key === 'F2' || e.code === 'F2') {
      e.preventDefault();
      router.push('/barcode/scanner');
      return;
    }

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
              className="bg-[#171c23] border border-[#30353d] text-[#dee2ec] rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[#30353d] flex items-center justify-between bg-[#090f15]">
                <h2 className="font-bold text-[#dee2ec] flex items-center gap-2 font-headline">
                  <Keyboard className="w-5 h-5 text-[#facc15]" />
                  Keyboard Shortcuts (คีย์ลัดปฏิบัติการ)
                </h2>
                <button onClick={() => setShowHelp(false)} className="text-[#d1c6ab] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-96 overflow-y-auto font-mono">
                <div className="text-[11px] text-[#facc15] uppercase font-bold tracking-wider mb-2">Shortcuts & Actions</div>
                {shortcuts.map(s => (
                  <div key={s.key} className="flex items-center justify-between py-1 border-b border-[#30353d]/30">
                    <span className="text-[#dee2ec] text-xs font-sans">{s.description}</span>
                    <kbd className="px-2 py-0.5 bg-[#252a32] border border-[#30353d] rounded text-xs font-mono text-[#facc15] font-bold">
                      {s.label}
                    </kbd>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1">
                  <span className="text-[#dee2ec] text-xs font-sans">Close / Cancel</span>
                  <kbd className="px-2 py-0.5 bg-[#252a32] border border-[#30353d] rounded text-xs font-mono text-[#d1c6ab]">Esc</kbd>
                </div>
              </div>

              <div className="p-3 border-t border-[#30353d] bg-[#090f15]">
                <p className="text-[11px] font-mono text-[#d1c6ab] text-center">
                  กด <kbd className="px-1.5 py-0.5 bg-[#252a32] border border-[#30353d] text-[#facc15] rounded text-[10px] font-mono font-bold">Esc</kbd> เพื่อปิดหน้าต่าง
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
