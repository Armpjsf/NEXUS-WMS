/**
 * Web Speech Synthesis, Cloud Audio TTS Fallback & Mobile Haptic Feedback (WMS 360 PRO)
 * 100% Zero-cost & offline compatible for Android APK (Capacitor), PWA, and Web.
 */

import { getApiUrl } from '@/lib/config';

/**
 * Check if voice output is supported (either native Web Speech or HTML5 Audio fallback)
 */
export function isVoiceSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return ('speechSynthesis' in window) || (typeof Audio !== 'undefined');
}

let _voices: SpeechSynthesisVoice[] = [];
let _primed = false;
let _activeAudio: HTMLAudioElement | null = null;

function refreshVoices() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      _voices = window.speechSynthesis.getVoices() || [];
    }
  } catch { /* ignore */ }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  } catch { /* ignore */ }
}

/**
 * Unlock TTS on a user gesture. Mobile browsers (iOS Safari, Android Chrome,
 * the Capacitor WebView) block speechSynthesis / Audio until the first user interaction.
 */
export function primeVoice() {
  if (typeof window === 'undefined') return;
  
  if ('speechSynthesis' in window) {
    try {
      refreshVoices();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'th-TH';
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }

  if (typeof Audio !== 'undefined') {
    try {
      // 1-sample silent wav to prime audio playback on mobile browsers
      const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      a.volume = 0;
      a.play().catch(() => {});
    } catch { /* ignore */ }
  }

  _primed = true;
}

export function isVoicePrimed() {
  return _primed;
}

/** Diagnose TTS readiness so the UI can inform the user */
export function getVoiceDiagnostic(): { supported: boolean; total: number; hasThai: boolean; engine: 'native' | 'cloud' } {
  if (!isVoiceSupported()) return { supported: false, total: 0, hasThai: false, engine: 'cloud' };

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    refreshVoices();
    const hasThai = _voices.some(v => (v.lang || '').toLowerCase().startsWith('th') || /thai/i.test(v.name));
    return { supported: true, total: _voices.length, hasThai, engine: 'native' };
  }

  // Audio fallback via /api/tts is supported everywhere
  return { supported: true, total: 1, hasThai: true, engine: 'cloud' };
}

function pickThaiVoice(): SpeechSynthesisVoice | undefined {
  if (_voices.length === 0) refreshVoices();
  return _voices.find(v => v.lang === 'th-TH')
    || _voices.find(v => v.lang && v.lang.toLowerCase().startsWith('th'))
    || _voices.find(v => /thai/i.test(v.name));
}

/**
 * Stop any current speech or audio playback
 */
export function stopVoice() {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch { /* ignore */ }
    }
    if (_activeAudio) {
      try {
        _activeAudio.pause();
        _activeAudio.currentTime = 0;
        _activeAudio = null;
      } catch { /* ignore */ }
    }
  }
}

/**
 * High-quality Cloud Audio Fallback (/api/tts)
 * Works on all Android WebViews, In-App Browsers, and older devices without Web Speech API
 */
export function playAudioFallback(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    stopVoice();
    const audioUrl = getApiUrl(`/api/tts?text=${encodeURIComponent(text.trim().slice(0, 200))}`);
    const audio = new Audio(audioUrl);
    _activeAudio = audio;

    if (onEnd) {
      audio.onended = () => {
        if (_activeAudio === audio) _activeAudio = null;
        onEnd();
      };
    }

    audio.onerror = (e) => {
      console.warn('Audio TTS fallback error:', e);
      if (_activeAudio === audio) _activeAudio = null;
    };

    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(err => console.warn('Audio play prevented by browser:', err));
    }
  } catch (e) {
    console.warn('Failed to play audio fallback:', e);
  }
}

/**
 * Speak Thai text using native browser/Android speech synthesis,
 * with automatic fallback to high-quality cloud audio TTS.
 */
export function speakThai(
  text: string,
  options: { rate?: number; pitch?: number; onEnd?: () => void } = {}
) {
  if (!isVoiceSupported() || !text?.trim()) return;

  const hasNative = typeof window !== 'undefined' && 'speechSynthesis' in window;

  if (hasNative) {
    try {
      stopVoice();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = options.rate || 1.05;
      utterance.pitch = options.pitch || 1.0;

      const thaiVoice = pickThaiVoice();
      if (thaiVoice) utterance.voice = thaiVoice;

      let hasStarted = false;
      utterance.onstart = () => {
        hasStarted = true;
      };

      if (options.onEnd) utterance.onend = options.onEnd;

      utterance.onerror = (e) => {
        console.warn('Native speech error, falling back to audio TTS:', e);
        playAudioFallback(text, options.onEnd);
      };

      window.speechSynthesis.speak(utterance);

      // Watchdog: on WebViews where speechSynthesis exists but does not speak,
      // fallback to audio if speech did not start within 350ms
      setTimeout(() => {
        if (!hasStarted && typeof window !== 'undefined' && !window.speechSynthesis.speaking) {
          playAudioFallback(text, options.onEnd);
        }
      }, 350);

      return;
    } catch (e) {
      console.warn('Native speech synthesis exception, falling back to audio TTS:', e);
    }
  }

  // Fallback for devices without native speechSynthesis
  playAudioFallback(text, options.onEnd);
}

/**
 * Speak picking waypoint instruction in Thai
 * Example: "ลำดับที่ 1 หยิบ กล่องพัสดุ จำนวน 2 ชิ้น ที่พิกัด เอ-ศูนย์-หนึ่ง"
 */
export function speakPickInstruction(item: {
  pickSequence: number;
  productName: string;
  requestedQty: number;
  location: string;
  unit?: string;
}) {
  const locSpoken = item.location
    .replace(/A/g, 'เอ ')
    .replace(/B/g, 'บี ')
    .replace(/C/g, 'ซี ')
    .replace(/D/g, 'ดี ')
    .replace(/-/g, ' ');

  const text = `จุดที่ ${item.pickSequence} หยิบ ${item.productName} ${item.requestedQty} ${item.unit || 'ชิ้น'} ที่พิกัด ${locSpoken}`;
  speakThai(text);
}

/**
 * Speak scan match confirmation
 */
export function speakScanSuccess(productName: string, qty?: number) {
  if (qty !== undefined) {
    speakThai(`สแกน ${productName} จำนวน ${qty} สำเร็จ`);
  } else {
    speakThai(`หยิบ ${productName} สำเร็จ`);
  }
}

/**
 * Speak scan mismatch / error warning
 */
export function speakScanMismatch(barcode?: string, reason?: string) {
  if (reason) {
    speakThai(`แจ้งเตือน ${reason}`);
  } else {
    speakThai('บาร์โค้ดไม่ตรงกับรายการ กรุณาตรวจสอบอีกครั้ง');
  }
}

/**
 * Speak putaway destination prompt
 */
export function speakPutawayLocation(productNameOrBin: string, bin?: string) {
  const targetBin = bin || productNameOrBin;
  const locSpoken = targetBin
    .replace(/A/g, 'เอ ')
    .replace(/B/g, 'บี ')
    .replace(/C/g, 'ซี ')
    .replace(/D/g, 'ดี ')
    .replace(/-/g, ' ');
  if (bin) {
    speakThai(`นำ ${productNameOrBin} ไปจัดเก็บที่ช่อง ${locSpoken}`);
  } else {
    speakThai(`นำไปจัดเก็บที่ช่อง ${locSpoken}`);
  }
}

/**
 * Mobile Tactile Haptic Vibration for Capacitor APK & PWA
 */
export function triggerHaptic(type: 'success' | 'warning' | 'error' = 'success') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'success') {
        navigator.vibrate(60); // short crisp buzz
      } else if (type === 'warning') {
        navigator.vibrate([80, 50, 80]); // double pulse
      } else {
        navigator.vibrate([150, 80, 200]); // long error rumble
      }
    } catch (e) {
      // Ignore vibration permissions error
    }
  }
}

export const vibrateSuccess = () => triggerHaptic('success');
export const vibrateWarning = () => triggerHaptic('warning');
export const vibrateError = () => triggerHaptic('error');
