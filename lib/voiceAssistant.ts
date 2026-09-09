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

/**
 * Speak Thai text using native browser/Android text-to-speech engine
 */
export function speakThai(
  text: string,
  options: { rate?: number; pitch?: number; onEnd?: () => void } = {}
) {
  if (!isVoiceSupported()) return;

  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = options.rate || 1.05; // Slightly faster for operational speed
    utterance.pitch = options.pitch || 1.0;

    // Find Thai voice if available
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang.includes('th'));
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    if (options.onEnd) {
      utterance.onend = options.onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
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

