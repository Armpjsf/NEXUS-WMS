'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseBarcodeScannerOptions {
  onScan?: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number; // Maximum ms between keystrokes to consider it a barcode scanner
  playSound?: boolean;
}

export function useBarcodeScanner(options: UseBarcodeScannerOptions = {}) {
  const {
    onScan,
    minChars = 3,
    maxIntervalMs = 45, // Barcode readers type very fast (usually <30ms per character)
    playSound = true
  } = options;

  const [lastScanned, setLastScanned] = useState<string>('');
  const [scanCount, setScanCount] = useState<number>(0);
  const [isHardwareActive, setIsHardwareActive] = useState<boolean>(true);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Web Audio Beep generator
  const playBeep = useCallback((success: boolean = true) => {
    if (!playSound || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 1850 : 350, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.12 : 0.25));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.12 : 0.25));
    } catch {
      // Audio autoplay might be blocked
    }
  }, [playSound]);

  useEffect(() => {
    if (!isHardwareActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter key indicates end of barcode string
      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= minChars) {
          setLastScanned(barcode);
          setScanCount(prev => prev + 1);
          playBeep(true);
          if (onScan) onScan(barcode);
        }
        return;
      }

      // If interval between keys is too long, reset buffer (it was a human typing manually)
      if (interval > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHardwareActive, minChars, maxIntervalMs, onScan, playBeep]);

  return {
    lastScanned,
    scanCount,
    isHardwareActive,
    setIsHardwareActive,
    playBeep,
    manualSubmit: (barcode: string) => {
      const clean = barcode.trim();
      if (clean.length >= minChars) {
        setLastScanned(clean);
        setScanCount(prev => prev + 1);
        playBeep(true);
        if (onScan) onScan(clean);
      }
    }
  };
}
