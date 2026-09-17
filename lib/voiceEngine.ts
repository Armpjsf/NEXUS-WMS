/**
 * Voice-Directed Picking Engine & Web Speech API Helpers
 * Hands-Free Audio Guidance for Warehouse Pickers
 */

export interface VoicePickStep {
  stepIndex: number;
  locationCode: string;
  sku: string;
  productName: string;
  targetQuantity: number;
  unit: string;
  checkDigit: string; // เลขทวนสอบ 2-3 หลักที่ติดอยู่หน้าเชลฟ์
}

export function synthesizePickSpeech(step: VoicePickStep): string {
  return `ไปพิกัด ${step.locationCode} หยิบ ${step.productName} จำนวน ${step.targetQuantity} ${step.unit} เลขทวนสอบ ${step.checkDigit}`;
}

export function synthesizeConfirmSuccess(step: VoicePickStep): string {
  return `ถูกต้อง หยิบสำเร็จ ${step.targetQuantity} ชิ้น ต่อไป`;
}

export function synthesizeErrorSpeech(): string {
  return `รหัสทวนสอบไม่ถูกต้อง กรุณาตรวจสอบพิกัดอีกครั้ง`;
}

export const sampleVoicePickTasks: VoicePickStep[] = [];
