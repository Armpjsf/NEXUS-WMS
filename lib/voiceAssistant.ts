/**
 * Web Speech Synthesis & Mobile Haptic Feedback (WMS 360 PRO)
 * 100% Zero-cost & offline compatible for Android APK (Capacitor), PWA, and Web.
 */

/**
 * Check if Web Speech API is supported
 */
export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Voices load asynchronously on most engines (getVoices() is empty on first
// call), so cache them and refresh when the browser fires `voiceschanged`.
let _voices: SpeechSynthesisVoice[] = [];
let _primed = false;
function refreshVoices() {
  try { _voices = window.speechSynthesis.getVoices() || []; } catch { /* ignore */ }
}
if (isVoiceSupported()) {
  refreshVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch { /* ignore */ }
}

/**
 * Unlock TTS on a user gesture. Mobile browsers (iOS Safari, Android Chrome,
 * the Capacitor WebView) block speechSynthesis until the first speak() happens
 * inside a real tap — so call this from an onClick/onPointerDown handler once.
 * After priming, later async speaks (auto-narration) are allowed.
 */
export function primeVoice() {
  if (_primed || !isVoiceSupported()) return;
  try {
    refreshVoices();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.lang = 'th-TH';
    window.speechSynthesis.speak(u);
    _primed = true;
  } catch { /* ignore */ }
}

export function isVoicePrimed() { return _primed; }

/** Diagnose TTS readiness so the UI can tell the user what to fix. */
export function getVoiceDiagnostic(): { supported: boolean; total: number; hasThai: boolean } {
  if (!isVoiceSupported()) return { supported: false, total: 0, hasThai: false };
  refreshVoices();
  const hasThai = _voices.some(v => (v.lang || '').toLowerCase().startsWith('th') || /thai/i.test(v.name));
  return { supported: true, total: _voices.length, hasThai };
}

function pickThaiVoice(): SpeechSynthesisVoice | undefined {
  if (_voices.length === 0) refreshVoices();
  return _voices.find(v => v.lang === 'th-TH')
    || _voices.find(v => v.lang && v.lang.toLowerCase().startsWith('th'))
    || _voices.find(v => /thai/i.test(v.name));
}

/**
 * Speak Thai text using native browser/Android text-to-speech engine
 */
export function speakThai(
  text: string,
  options: { rate?: number; pitch?: number; onEnd?: () => void } = {}
) {
  if (!isVoiceSupported()) return;

  const doSpeak = () => {
    try {
      window.speechSynthesis.cancel(); // stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = options.rate || 1.05;
      utterance.pitch = options.pitch || 1.0;
      const thaiVoice = pickThaiVoice();
      if (thaiVoice) utterance.voice = thaiVoice; // else default engine handles Thai text
      if (options.onEnd) utterance.onend = options.onEnd;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // If voices haven't loaded yet, wait one tick for `voiceschanged` then speak.
  if (_voices.length === 0) {
    refreshVoices();
    if (_voices.length === 0) { setTimeout(doSpeak, 250); return; }
  }
  doSpeak();
}

/**
 * Stop any current speech
 */
export function stopVoice() {
  if (isVoiceSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // ignore
    }
  }
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
  // Format location letters for clear Thai pronunciation (e.g. A-01-02 -> เอ ศูนย์หนึ่ง ศูนย์สอง)
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

