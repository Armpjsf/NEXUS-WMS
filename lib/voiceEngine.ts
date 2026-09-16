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

export const sampleVoicePickTasks: VoicePickStep[] = [
  {
    stepIndex: 1,
    locationCode: 'A-01-02-01',
    sku: 'SKU-SOLAR-5K',
    productName: 'อินเวอร์เตอร์ 5 กิโลวัตต์',
    targetQuantity: 2,
    unit: 'เครื่อง',
    checkDigit: '42'
  },
  {
    stepIndex: 2,
    locationCode: 'A-02-01-03',
    sku: 'SKU-ELEC-006',
    productName: 'สายไฟ VCT 100 เมตร',
    targetQuantity: 4,
    unit: 'ม้วน',
    checkDigit: '78'
  },
  {
    stepIndex: 3,
    locationCode: 'B-01-03-02',
    sku: 'SKU-BEV-002',
    productName: 'นมสดพาสเจอร์ไรส์ 2 ลิตร',
    targetQuantity: 6,
    unit: 'ขวด',
    checkDigit: '15'
  }
];
