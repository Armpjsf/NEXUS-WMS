'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Compass,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Award,
  Layers,
  ChevronRight,
  ChevronLeft,
  Info,
  Maximize2,
  Minimize2,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  Truck,
  Box,
  Volume2,
  VolumeX,
} from 'lucide-react';

export type ProcessStation = {
  id: number;
  stepNumber: number;
  titleTh: string;
  titleEn: string;
  subtitle: string;
  area: string;
  coords: [number, number, number]; // 3D world coordinates [x, y, z]
  camPos: [number, number, number];  // Camera offset position [x, y, z]
  description: string;
  keyTerms: { term: string; meaning: string }[];
  qcChecklist: string[];
  safetyRules: string[];
  kpi: { label: string; target: string; current: string; unit: string };
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  liveMetrics: {
    queueCount: number;
    hourlyThroughput: number;
    status: 'OPTIMAL' | 'BUSY' | 'BOTTLENECK';
  };
};

export const PROCESS_STATIONS: ProcessStation[] = [
  {
    id: 1,
    stepNumber: 1,
    titleTh: '1. รับสินค้าเข้า',
    titleEn: 'Inbound Receiving & Unloading',
    subtitle: 'ตรวจรับตู้สินค้าและเทียบเอกสาร ASN',
    area: 'Dock 01 - Inbound Staging',
    coords: [-22, 1.2, 14],
    camPos: [-22, 9, 24],
    description: 'เทียบรถบรรทุกเข้าช่องโหลด (Dock Leveler) ตรวจนับจำนวนกล่อง/พาเลท เทียบกับใบกำกับส่งของ (Delivery Note) และ ASN ในระบบ WMS พร้อมออกรหัส LPN (License Plate Number) ประจำพาเลท',
    keyTerms: [
      { term: 'ASN', meaning: 'Advanced Shipping Notice (เอกสารแจ้งส่งสินค้าล่วงหน้า)' },
      { term: 'LPN', meaning: 'License Plate Number (รหัสบาร์โค้ดประจำพาเลท)' },
      { term: 'Dock Leveler', meaning: 'สะพานปรับระดับท้ายรถบรรทุกไฮดรอลิก' }
    ],
    qcChecklist: [
      'ตรวจเช็คซีลล็อคตู้คอนเทนเนอร์ตรงตามเอกสารก่อนเปิดตู้',
      'สภาพบรรจุภัณฑ์ภายนอกต้องสมบูรณ์ ไม่เปียกชื้น ไม่ยุบ และไม่มีรอยกรีด',
      'สแกนบาร์โค้ด LPN ทุกพาเลทเพื่อยืนยันพิกัดรับเข้าในระบบ WMS'
    ],
    safetyRules: [
      'สวมหมวกนิรภัย (Hard Hat) เสื้อสะท้อนแสง และรองเท้าหัวเหล็กตลอดเวลาในลานโหลด',
      'ต้องวางลิ่มหนุนล้อรถบรรทุก (Wheel Chock) และดึงเบรกมือก่อนเริ่มขนถ่าย'
    ],
    kpi: { label: 'เวลาขนถ่ายเฉลี่ย', target: '< 25 นาที/คัน', current: '18.4', unit: 'นาที' },
    quiz: {
      question: 'หากตรวจพบกล่องสินค้ามีรอยฉีกขาดหรือมีคราบเปียกชื้นตั้งแต่ตอนเปิดตู้ขนส่ง ควรปฏิบัติตาม SOP อย่างไร?',
      options: [
        'รับเข้าสู่ระบบไปก่อน แล้วค่อยแจ้งหัวหน้าในวันรุ่งขึ้น',
        'ถ่ายภาพหลักฐาน ทำบันทึก Damage Report และแยกสินค้าเข้าโซนกักกัน (Hold/Quarantine Zone)',
        'ปฏิเสธการรับสินค้าทั้งคันรถและไล่รถบรรทุกกลับทันที'
      ],
      correctIndex: 1,
      explanation: 'ตามระเบียบ WMS มาตรฐาน ต้องบันทึกรูปภาพ ออก Damage Report และแยกเข้าโซนกักกัน (Hold) ห้ามรับเข้าสต็อกปกติโดยเด็ดขาด'
    },
    liveMetrics: { queueCount: 4, hourlyThroughput: 140, status: 'OPTIMAL' }
  },
  {
    id: 2,
    stepNumber: 2,
    titleTh: '2. ตรวจรับคุณภาพ (QC)',
    titleEn: 'Quality Control & Handover',
    subtitle: 'สุ่มตรวจความสมบูรณ์และวันหมดอายุ',
    area: 'Station QC - Inbound Gate',
    coords: [-15, 1.2, 10],
    camPos: [-15, 7, 18],
    description: 'นำตัวอย่างเข้าสถานี QC เพื่อตรวจสอบตามเกณฑ์สุ่ม AQL ตรวจเช็คบาร์โค้ด SKU, ล็อตการผลิต (Lot Number) และวันหมดอายุ (Expiry Date) ให้มีอายุคงเหลือ (Shelf-life) ตามข้อตกลงของลูกค้า',
    keyTerms: [
      { term: 'AQL', meaning: 'Acceptable Quality Limit (เกณฑ์มาตรฐานสุ่มตรวจ)' },
      { term: 'Shelf-life', meaning: 'อายุการเก็บรักษาขั้นต่ำของสินค้า' },
      { term: 'Batch/Lot', meaning: 'รหัสรุ่นการผลิตเพื่อการตรวจสอบย้อนกลับ' }
    ],
    qcChecklist: [
      'ตรวจสอบวันหมดอายุ (Expiry Date) ต้องคงเหลือไม่น้อยกว่า 75% ของอายุสินค้า',
      'ทดสอบยิงสแกนบาร์โค้ด SKU ระดับชิ้น/กล่อง ต้องอ่านได้รวดเร็วคมชัด',
      'ติดป้ายสติ๊กเกอร์สถานะ "QC PASSED" สีเขียวก่อนปล่อยเข้าโซนจัดเก็บ'
    ],
    safetyRules: [
      'ใช้คัตเตอร์เซฟตี้ที่มีระบบดึงใบมีดกลับอัตโนมัติเมื่อกรีดเทปกล่อง',
      'ห้ามปีนขึ้นบนพาเลทเพื่อตรวจของ ให้ใช้บันไดตรวจสินค้ามาตรฐาน'
    ],
    kpi: { label: 'QC Pass Rate', target: '≥ 99.5%', current: '99.8', unit: '%' },
    quiz: {
      question: 'ข้อใดคือเกณฑ์มาตรฐานวันหมดอายุ (Shelf-life) ของสินค้าทั่วไปในการรับเข้าคลังเพื่อไม่ให้เกิดสต็อกเดดแอร์?',
      options: [
        'ต้องมีอายุคงเหลือไม่น้อยกว่า 75% ของอายุสินค้าทั้งหมด',
        'เหลืออายุอย่างน้อย 7 วันก็สามารถรับเข้าได้ทันที',
        'ไม่จำเป็นต้องเช็ควันหมดอายุถ้าแพ็คเกจยังดูใหม่'
      ],
      correctIndex: 0,
      explanation: 'มาตรฐานการบริหารคลังสินค้า สินค้าทั่วไปต้องมี Shelf-life คงเหลือ ≥ 75% เพื่อให้มีระยะเวลาเพียงพอในการกระจายและจำหน่ายต่อ'
    },
    liveMetrics: { queueCount: 2, hourlyThroughput: 85, status: 'OPTIMAL' }
  },
  {
    id: 3,
    stepNumber: 3,
    titleTh: '3. จัดเก็บเข้าชั้น (Putaway)',
    titleEn: 'Directed Putaway to Racks',
    subtitle: 'โฟล์กลิฟต์ยกพาเลทเข้าแร็คตามพิกัดชี้แนะ',
    area: 'Aisle A & B - High-Bay Racks',
    coords: [-8, 2.5, 2],
    camPos: [-8, 12, 12],
    description: 'รถโฟล์กลิฟต์และ Reach Truck สแกน LPN พาเลท ระบบ WMS จะคำนวณอัลกอริทึม Velocity Slotting เพื่อชี้นำพิกัด Bin ที่เหมาะสมที่สุด (สินค้าขายดีไว้ชั้นล่างใกล้ทางออก สินค้าหนักอยู่ชั้น 1-2)',
    keyTerms: [
      { term: 'Directed Putaway', meaning: 'ระบบ WMS กำหนดพิกัดวางสินค้าให้อัตโนมัติ' },
      { term: 'Velocity Slotting', meaning: 'การวางสินค้าตามอัตราความถี่ในการเคลื่อนย้าย' },
      { term: 'Bin Location', meaning: 'พิกัดจัดเก็บ (โซน-แถว-ชั้น-ช่อง)' }
    ],
    qcChecklist: [
      'สแกนป้ายบาร์โค้ดประจำช่องเก็บ (Bin Barcode) เพื่อยืนยันว่าวางตรงพิกัดจริง',
      'จัดวางพาเลทให้อยู่กึ่งกลางคานแร็คพอดี ไม่ล้ำขอบคานหน้า-หลังเกิน 5 ซม.',
      'ห้ามวางซ้อนพาเลทเกินความสูงและน้ำหนักปลอดภัยที่ระบุไว้ประจำเบย์'
    ],
    safetyRules: [
      'จำกัดความเร็วรถโฟล์กลิฟต์ในทางเดินไม่เกิน 10 กม./ชม.',
      'บีบแตรให้สัญญาณเสียงทุกครั้งที่ถึงจุดตัดทางแยก หรือมีมุมอับสายตา'
    ],
    kpi: { label: 'Putaway Accuracy', target: '99.9%', current: '99.95', unit: '%' },
    quiz: {
      question: 'การนำสินค้าประเภท Fast-Moving (สินค้าหมุนเวียนเร็ว เบิกบ่อย) ไปเก็บไว้ที่ตำแหน่งใดถูกต้องตามหลักการ WMS?',
      options: [
        'เก็บไว้ชั้นบนสุดในส่วนลึกสุดของคลังเพื่อประหยัดพื้นที่',
        'เก็บไว้ที่ชั้นระดับสายตาหรือระดับพื้น และอยู่ใกล้กับโซนเบิก/แพ็คสินค้ามากที่สุด',
        'กระจายเก็บสุ่มไว้หลายๆ ช่องโดยไม่ต้องคำนึงถึงความถี่ในการเบิก'
      ],
      correctIndex: 1,
      explanation: 'หลักการ Velocity Slotting สินค้า Fast-Moving ต้องอยู่ชั้นล่างและใกล้เส้นทางสัญจรหลักเพื่อลดระยะเวลาเดินทางของคนและรถ'
    },
    liveMetrics: { queueCount: 8, hourlyThroughput: 92, status: 'BUSY' }
  },
  {
    id: 4,
    stepNumber: 4,
    titleTh: '4. ปล่อยออเดอร์ (Wave Release)',
    titleEn: 'Wave Planning & Order Allocation',
    subtitle: 'รวมกลุ่มออเดอร์และตัดสต็อกอัตโนมัติ',
    area: 'Control Tower & Server Terminal',
    coords: [2, 1.5, -4],
    camPos: [2, 7, 5],
    description: 'ศูนย์ควบคุมปฏิบัติการ (Control Tower) รวมกลุ่มออเดอร์ (Wave Batching) ตามรอบรถ รอบเวลาจัดส่ง หรือโซนปลายทาง WMS จะทำการ Allocate สต็อกแบบ Real-Time และส่ง Pick List เข้าสู่มือถือพนักงาน',
    keyTerms: [
      { term: 'Wave Planning', meaning: 'การจัดรอบการทำงานเป็นระลอกตามเวลาตัดรอบ' },
      { term: 'Stock Allocation', meaning: 'การล็อคจองสต็อกในระบบเพื่อป้องกันการหยิบชนกัน' },
      { term: 'Cut-Off Time', meaning: 'เวลาปิดรับออเดอร์สำหรับรถรอบนั้นๆ' }
    ],
    qcChecklist: [
      'ตรวจสอบสินค้าในออเดอร์ต้องมีสต็อกครบ 100% จึงจะปล่อย Wave สมบูรณ์',
      'เช็คเวลาขนส่ง (SLA Cut-off) ปล่อยรอบงานเร่งด่วนตาม Priority',
      'ตรวจสอบไม่ให้เกิดความแออัดของคนหยิบในแถวแร็คเดียวกัน (Congestion Balancing)'
    ],
    safetyRules: [
      'ตรวจสอบระบบจ่ายกระแสไฟสำรอง (UPS) ของแม่ข่าย WMS ให้อยู่ในสถานะพร้อมใช้',
      'สำรองข้อมูลการตัดสต็อกทุก 15 นาที ป้องกันข้อมูลคำสั่งซื้อสูญหาย'
    ],
    kpi: { label: 'Wave Cycle Time', target: '< 5 นาที', current: '3.2', unit: 'นาที' },
    quiz: {
      question: 'ประโยชน์ที่สำคัญที่สุดของการจัดกลุ่มออเดอร์ด้วย "Wave Planning" ในระบบ WMS คืออะไร?',
      options: [
        'ช่วยให้ปล่อยงานทีละออเดอร์เดี่ยวๆ โดยไม่ต้องคิดคำนวณ',
        'รวมออเดอร์ที่มีเส้นทางเดินหรือรอบรถเดียวกัน เพื่อลดระยะทางเดินซ้ำซ้อนของพนักงานหยิบ',
        'ชะลองานให้พนักงานคลังได้หยุดพักเป็นรอบๆ'
      ],
      correctIndex: 1,
      explanation: 'Wave Planning ช่วยประมวลผลออเดอร์นับร้อยใบ รวมเป็นเส้นทางเดินหยิบเดียวกัน (Batch Picking) ทำให้ลดเวลาเดินในคลังได้มากกว่า 40%'
    },
    liveMetrics: { queueCount: 45, hourlyThroughput: 320, status: 'OPTIMAL' }
  },
  {
    id: 5,
    stepNumber: 5,
    titleTh: '5. หยิบสินค้า (Order Picking)',
    titleEn: 'Optimized Batch & Zone Picking',
    subtitle: 'พนักงานเดินหยิบตามเส้นทางสั้นที่สุด',
    area: 'Aisle C - Picking Totes',
    coords: [5, 1.2, 5],
    camPos: [5, 8, 14],
    description: 'พนักงานใช้เครื่องสแกนพกพา (Handheld RF / Mobile App) นำทางตามอัลกอริทึม Shortest-Path สแกน Bin พิกัด และสแกนบาร์โค้ดตัวสินค้าเพื่อตัดยอดทันที แล้วบรรจุลงตะกร้า Tote ประจำออเดอร์',
    keyTerms: [
      { term: 'Pick-to-Tote', meaning: 'การหยิบสินค้าลงตะกร้าลำเลียงที่มีบาร์โค้ดกำกับ' },
      { term: 'Pick-Face', meaning: 'ตำแหน่งช่องด้านหน้าแร็คสำหรับหยิบของชิ้นย่อย' },
      { term: 'Route Optimization', meaning: 'การจัดลำดับการเดินหยิบเพื่อไม่ให้เดินย้อนศร' }
    ],
    qcChecklist: [
      'ต้องสแกนบาร์โค้ดตัวสินค้าทุกชิ้น ห้ามกด Manual Overwrite โดยไม่จำเป็น',
      'ตรวจนับจำนวนชิ้นให้ครบถ้วนก่อนยืนยันกดจบรายการในเครื่องสแกน',
      'ตรวจสอบบรรจุภัณฑ์สินค้าไม่บุบ ไม่ฉีกขาด และบาร์โค้ดยังอ่านได้'
    ],
    safetyRules: [
      'ยกกล่องหนักด้วยท่างอเข่าหลังตรง (Ergonomic Lifting Technique)',
      'ห้ามปีนขึ้นชั้นวางแร็คเด็ดขาด หากของอยู่สูงต้องใช้บันไดติดล้อเซฟตี้'
    ],
    kpi: { label: 'Picking Accuracy', target: '99.98%', current: '99.96', unit: '%' },
    quiz: {
      question: 'หากพนักงานสแกนสินค้าแล้วเครื่องสแกนส่งเสียงเตือน "Wrong SKU Code" พนักงานควรทำอย่างไร?',
      options: [
        'วางสินค้านั้นลงในตะกร้าไปก่อน เพราะคิดว่าระบบอาจบันทึกผิด',
        'วางสินค้านั้นกลับเข้าที่เดิม ตรวจสอบรหัสบนหน้าจอและป้ายพิกัดอีกครั้ง หากไม่ตรงให้แจ้งหัวหน้างานทันที',
        'พิมพ์บาร์โค้ดใหม่มาแปะทับแล้วสแกนซ้ำ'
      ],
      correctIndex: 1,
      explanation: 'หากระบบเตือนว่าผิด SKU ต้องวางกลับที่เดิมและตรวจสอบทันที ห้ามหยิบปนลงตะกร้าเด็ดขาดเพื่อป้องกันส่งของผิดให้ลูกค้า'
    },
    liveMetrics: { queueCount: 16, hourlyThroughput: 185, status: 'BUSY' }
  },
  {
    id: 6,
    stepNumber: 6,
    titleTh: '6. สายพานลำเลียง (Conveyor)',
    titleEn: 'Motorized Roller Conveyor',
    subtitle: 'ลำเลียงตะกร้าส่งต่อไปยังสถานีแพ็ค',
    area: 'Main Spine Conveyor Line',
    coords: [12, 1.1, 4],
    camPos: [12, 7, 12],
    description: 'ตะกร้าสินค้าถูกวางขึ้นสายพานลูกกลิ้งอัตโนมัติ (Motorized Roller Conveyor) ลำเลียงข้ามโซนไปยังพื้นที่บรรจุหีบห่อ มีเซ็นเซอร์โฟโตอิเล็กทริกตรวจจับความเร็วและการติดขัดตลอดแนวสายพาน',
    keyTerms: [
      { term: 'Conveyor Accumulation', meaning: 'การจัดระยะห่างกล่องบนสายพานอัตโนมัติ' },
      { term: 'Photo-Eye Sensor', meaning: 'เซ็นเซอร์แสงตรวจจับตำแหน่งกล่องพัสดุ' },
      { term: 'E-Stop', meaning: 'ปุ่มหยุดการทำงานของสายพานกรณีฉุกเฉิน' }
    ],
    qcChecklist: [
      'ระยะห่างระหว่างตะกร้าบนสายพานต้องไม่น้อยกว่า 30 ซม. ป้องกันการชนกระแทก',
      'สินค้าภายในตะกร้าต้องไม่ล้นพ้นขอบบนของตะกร้า Tote',
      'ป้ายบาร์โค้ดประจำตะกร้าต้องหันออกด้านข้างในมุมที่สแกนเนอร์สายพานอ่านได้'
    ],
    safetyRules: [
      'ห้ามเอื้อมมือหรือโน้มตัวเข้าไปในแนวสายพานขณะมอเตอร์กำลังทำงาน',
      'ปุ่มหยุดฉุกเฉิน (E-Stop) ทุกจุดต้องไม่มีสิ่งของบดบังและพร้อมกดหยุดใน 1 วินาที'
    ],
    kpi: { label: 'Conveyor Uptime', target: '≥ 99.8%', current: '99.9', unit: '%' },
    quiz: {
      question: 'หากสังเกตเห็นตะกร้าสินค้าติดขัด (Conveyor Jam) บนสายพาน สิ่งแรกที่ต้องทำตามหลักความปลอดภัยคืออะไร?',
      options: [
        'ใช้มือเอื้อมไปดึงตะกร้าออกทันทีขณะสายพานยังหมุนอยู่',
        'กดปุ่ม Emergency Stop (E-Stop) ให้สายพานหยุดสนิทก่อน แล้วจึงค่อยเคลียร์ตะกร้า',
        'ปล่อยทิ้งไว้ให้มอเตอร์ดันตะกร้าหลุดออกไปเอง'
      ],
      correctIndex: 1,
      explanation: 'ต้องกดปุ่มหยุดฉุกเฉิน (E-Stop) ให้สายพานหยุดหมุนโดยสมบูรณ์ก่อนเข้าไปแก้ไขสิ่งติดขัด เพื่อป้องกันอุบัติเหตุอวัยวะถูกหนีบ'
    },
    liveMetrics: { queueCount: 6, hourlyThroughput: 280, status: 'OPTIMAL' }
  },
  {
    id: 7,
    stepNumber: 7,
    titleTh: '7. บรรจุหีบห่อ (Packing)',
    titleEn: 'Protective Packaging & Slip Insertion',
    subtitle: 'ห่อกันกระแทก ปิดผนึก และแนบใบเสร็จ',
    area: 'Station Pack-03',
    coords: [18, 1.2, 2],
    camPos: [18, 7, 10],
    description: 'พนักงานประจำโต๊ะแพ็คสแกนตะกร้า หน้าจอจะแสดงขนาดกล่องมาตรฐาน (Box Size A-E) ใส่แผ่นกันกระแทก (Air Pillow) ห่อหุ้มสินค้า แนบใบเสร็จหรือ Delivery Slip และปิดผนึกเทปกาวแบบตัว H',
    keyTerms: [
      { term: 'Void Fill', meaning: 'วัสดุกันกระแทกเติมเต็มช่องว่างในกล่อง' },
      { term: 'H-Taping', meaning: 'การปิดเทปแนวยาวและปิดขอบกล่องทั้งสองข้าง' },
      { term: 'Packing Slip', meaning: 'ใบแจ้งรายการสิ่งของในพัสดุ' }
    ],
    qcChecklist: [
      'ใส่แผ่นกันกระแทกจนแน่น ไม่ให้สินค้าขยับตัวได้เมื่อเขย่ากล่องเบาๆ',
      'แนบใบเสร็จ/Delivery Slip ตรงตามชื่อและที่อยู่ของผู้รับจริง',
      'ปิดเทปกาวแบบตัว H แน่นหนา ไม่ให้มีช่องเปิดที่มือสามารถล้วงได้'
    ],
    safetyRules: [
      'เก็บคัตเตอร์และเครื่องยิงเทปเข้าช่องใส่เครื่องมือทุกครั้งหลังใช้เสร็จ',
      'ปรับระดับความสูงของโต๊ะแพ็คให้เหมาะสมกับสรีระ เพื่อป้องกันอาการปวดหลัง'
    ],
    kpi: { label: 'Packing Speed', target: '< 50 วินาที/กล่อง', current: '42.0', unit: 'วิ' },
    quiz: {
      question: 'การปิดผนึกกล่องพัสดุด้วยวิธี "H-Taping" มีวัตถุประสงค์หลักเพื่อสิ่งใด?',
      options: [
        'เพื่อความสวยงามเพียงอย่างเดียว',
        'เพื่อป้องกันฝุ่นละออง ความชื้น และป้องกันไม่ให้เกิดช่องเปิดที่สามารถล้วงขโมยของระหว่างขนส่งได้',
        'เพื่อประหยัดการใช้เทปกาวให้เหลือน้อยที่สุด'
      ],
      correctIndex: 1,
      explanation: 'H-Taping คือการปิดเทปแนวกลางและปิดมุมขอบทั้ง 2 ข้าง ช่วยเพิ่มความแข็งแรงของกล่องและป้องกันการโจรกรรมสินค้าระหว่างทาง'
    },
    liveMetrics: { queueCount: 5, hourlyThroughput: 72, status: 'OPTIMAL' }
  },
  {
    id: 8,
    stepNumber: 8,
    titleTh: '8. ชั่งน้ำหนัก & ติดฉลาก',
    titleEn: 'Weighing & Shipping Label Application',
    subtitle: 'ตรวจน้ำหนักป้องกันของขาดเกินและพิมพ์ AWB',
    area: 'Weigh & Scan Auto Line',
    coords: [22, 1.1, -2],
    camPos: [22, 7, 6],
    description: 'กล่องวิ่งผ่านเครื่องชั่งน้ำหนักแบบ Real-Time และเครื่องวัดมิติสามมิติ (Dimensioner) เพื่อเทียบกับน้ำหนักมาตรฐานในระบบ ป้องกันการลืมใส่ของ จากนั้นแขนกลหรือพนักงานจะติดป้ายขนส่ง (Shipping Label / AWB)',
    keyTerms: [
      { term: 'Weight Tolerance', meaning: 'เกณฑ์ความคลาดเคลื่อนของน้ำหนักที่ยอมรับได้ (±3%)' },
      { term: 'AWB', meaning: 'Air Waybill / Shipping Label ป้ายจ่าหน้าพร้อมบาร์โค้ด' },
      { term: 'Dimensioner', meaning: 'เครื่องเลเซอร์สแกนวัดมิติความกว้าง ยาว สูง' }
    ],
    qcChecklist: [
      'ค่าน้ำหนักชั่งจริงต้องต่างจากค่าน้ำหนักมาตรฐานในระบบไม่เกิน ±3%',
      'ติดป้าย Shipping Label บนพื้นผิวที่เรียบที่สุด ไม่ติดทับรอยพับหรือมุมกล่อง',
      'บาร์โค้ด Tracking Number ต้องคมชัด ไม่เบลอ และไม่มีรอยพับทับตัวบาร์โค้ด'
    ],
    safetyRules: [
      'ห้ามวางมือหรือสัมผัสถาดชั่งน้ำหนักขณะระบบกำลังอ่านค่า',
      'ตรวจเช็คสายไฟและระบบเลเซอร์สแกนเนอร์ให้ได้มาตรฐานความปลอดภัย'
    ],
    kpi: { label: 'Weight Variance', target: '< 2.0%', current: '0.8', unit: '%' },
    quiz: {
      question: 'หากระบบเครื่องชั่งตรวจพบว่าน้ำหนักพัสดุเบากว่าน้ำหนักมาตรฐานในระบบเกิน 5% บ่งชี้ถึงข้อใด?',
      options: [
        'น้ำหนักกล่องลดลงตามสภาพอากาศ สามารถปล่อยผ่านได้เลย',
        'มีความเสี่ยงสูงที่สินค้าภายในกล่องจะขาด หรือหยิบสินค้าไม่ครบตามออเดอร์ ต้องกักกล่องเพื่อตรวจสอบซ้ำ',
        'ให้เพิ่มวัสดุกันกระแทกเข้าไปให้หนักเท่าเดิมโดยไม่ต้องดูของข้างใน'
      ],
      correctIndex: 1,
      explanation: 'น้ำหนักที่เบาผิดปกติเป็นสัญญาณเตือนว่าหยิบของไม่ครบ ต้องเข้าสู่กระบวนการ Rework เพื่อเปิดตรวจเช็คของจริงทันที'
    },
    liveMetrics: { queueCount: 3, hourlyThroughput: 240, status: 'OPTIMAL' }
  },
  {
    id: 9,
    stepNumber: 9,
    titleTh: '9. คัดแยกปลายทาง (Sortation)',
    titleEn: 'Destination Sorter & Hub Routing',
    subtitle: 'คัดแยกลงช่องทางตามศูนย์กระจายสินค้าปลายทาง',
    area: 'Dispatch Sorting Chutes (กทม./เหนือ/อีสาน/ใต้)',
    coords: [25, 1.3, -8],
    camPos: [25, 9, 0],
    description: 'เครื่องอ่านบาร์โค้ดมุมกว้าง (Omni-directional Scanner) อ่าน Tracking No. บนกล่อง และสั่งการใบผลัก (Sorter Diverter) คัดแยกลงราง Chute ตามปลายทาง เช่น สายเหนือ, สายอีสาน, สายใต้ หรือส่งตรงกทม.',
    keyTerms: [
      { term: 'Sorter Chute', meaning: 'รางเลื่อนลาดเอียงสำหรับรองรับพัสดุแต่ละเส้นทาง' },
      { term: 'Hub Routing', meaning: 'การจับคู่รหัสไปรษณีย์เข้ากับศูนย์กระจายสินค้าปลายทาง' },
      { term: 'Mis-sort Rate', meaning: 'อัตราการคัดแยกผิดช่องทาง' }
    ],
    qcChecklist: [
      'กล่องพัสดุตกลงในรางเลื่อนปลายทางอย่างนุ่มนวล ไม่กระแทกเสียหาย',
      'ไม่มีกล่องตกค้างหรือไหลกองสะสมหน้าปากรางคัดแยก',
      'สุ่มสแกนตรวจเช็คกล่องในรางคัดแยกให้ตรงกับรอบรถสายส่งปลายทาง'
    ],
    safetyRules: [
      'ห้ามยื่นมือหรือนำสิ่งกีดขวางไปแหย่บริเวณแขนผลักพัสดุ (Diverter Arm)',
      'ระวังพัสดุตกหล่นจากรางเลื่อน สวมรองเท้าเซฟตี้ตลอดเวลา'
    ],
    kpi: { label: 'Mis-sort Rate', target: '< 0.02%', current: '0.008', unit: '%' },
    quiz: {
      question: 'หากพัสดุถูกคัดแยกลงช่องทางผิดปลายทาง (เช่น พัสดุเชียงใหม่หลุดไปขึ้นรถสายสงขลา) จะก่อให้เกิดผลกระทบใด?',
      options: [
        'ไม่มีผลกระทบ เพราะอย่างไรก็อยู่ในประเทศไทย',
        'เกิดการส่งผิดเส้นทาง (Misroute) ทำให้การจัดส่งล่าช้าหลายวัน และเสียค่าขนส่งซ้ำซ้อนอย่างมาก',
        'ระบบ TMS จะเปลี่ยนที่อยู่ผู้รับให้เป็นสงขลาโดยอัตโนมัติ'
      ],
      correctIndex: 1,
      explanation: 'Mis-sort ก่อให้เกิดปัญหาสินค้าตีวน (Misroute) ลูกค้าได้รับของล่าช้า และบริษัทต้องแบกรับต้นทุนค่าขนย้ายกลับศูนย์'
    },
    liveMetrics: { queueCount: 12, hourlyThroughput: 310, status: 'OPTIMAL' }
  },
  {
    id: 10,
    stepNumber: 10,
    titleTh: '10. โหลดขึ้นรถส่ง (Dispatch)',
    titleEn: 'Staging & Vehicle Loading (Outbound)',
    subtitle: 'ตรวจนับยอดรวมขึ้นรถและล็อคซีลประตูตู้',
    area: 'Dock 04 - Outbound Dispatch',
    coords: [28, 1.2, -15],
    camPos: [28, 8, -6],
    description: 'พนักงานลำเลียงกล่องขึ้นรถขนส่ง NEXUS Fleet จัดเรียงตามน้ำหนักและหลัก First-In Last-Out (FILO) สแกนปิด Manifest ใบกำกับการขนส่ง ล็อคประตูตู้และบันทึกหมายเลขซีล (Seal Lock) เข้าสู่ระบบ TMS ทันที',
    keyTerms: [
      { term: 'FILO / LIFO', meaning: 'First-In Last-Out (ของส่งจุดแรกสุดต้องวางอยู่หน้าประตูท้ายรถ)' },
      { term: 'Manifest', meaning: 'ใบกำกับการขนถ่ายระบุรายการพัสดุทั้งหมดบนคันรถ' },
      { term: 'Seal Lock', meaning: 'ซีลล็อคประตูตู้รถพร้อมหมายเลขรหัสป้องกันเปิด' }
    ],
    qcChecklist: [
      'ตรวจนับยอดกล่องจริงตรงกับยอดรวมในใบ Manifest 100%',
      'จัดวางพัสดุหนักไว้ด้านล่าง พัสดุเบาไว้ด้านบน ล็อคด้วยสายรัดบาร์กั้นของ',
      'ถ่ายรูปรหัสซีลล็อคประตูตู้รถ และบันทึกลงระบบก่อนรถเคลื่อนตัวออกจากท่า'
    ],
    safetyRules: [
      'ห้ามยืนอยู่บริเวณท้ายรถขณะที่รถบรรทุกกำลังถอยเทียบช่องโหลดเด็ดขาด',
      'ตรวจสอบพื้นตู้รถต้องสะอาด แห้ง ไม่มีตะปูหรือรอยรั่วซึมก่อนเริ่มโหลด'
    ],
    kpi: { label: 'On-Time Dispatch', target: '≥ 98.5%', current: '99.1', unit: '%' },
    quiz: {
      question: 'สำหรับการส่งของแบบหลายจุดปลายทาง (Multi-Drop Delivery) ควรจัดเรียงพัสดุขึ้นรถด้วยหลักการใด?',
      options: [
        'วางสินค้าที่จะส่งจุดแรกสุดไว้ด้านในสุดของตู้รถ',
        'วางสินค้าตามหลัก First-In Last-Out (FILO) โดยของที่จะส่งจุดแรกสุดต้องอยู่หน้าประตูท้ายรถเพื่อหยิบลงได้ทันที',
        'วางกองรวมกันตรงไหนก็ได้ที่มีที่ว่าง'
      ],
      correctIndex: 1,
      explanation: 'หลักการ FILO ของส่งจุดแรกต้องอยู่หน้าสุด เพื่อให้คนขับเปิดประตูแล้วหยิบส่งได้ทันที ไม่ต้องรื้อค้นพัสดุจุดอื่นให้เสียหายหรือเสียเวลา'
    },
    liveMetrics: { queueCount: 18, hourlyThroughput: 160, status: 'OPTIMAL' }
  }
];

export default function WarehouseProcessSimulator3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlayingTour, setIsPlayingTour] = useState<boolean>(false);
  const [tourSpeed, setTourSpeed] = useState<1 | 2 | 5>(1);
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SOP' | 'LIVE' | 'QUIZ'>('SOP');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  // Three.js internal references
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    parcelMesh: THREE.Group;
    workers: THREE.Group[];
    stationPins: THREE.Group[];
    stationBeacons: THREE.Mesh[];
    targetCamPos: THREE.Vector3;
    targetCamLookAt: THREE.Vector3;
    currentLookAt: THREE.Vector3;
    isUserInteracting: boolean;
    mousePos: { x: number; y: number };
    spherical: { radius: number; theta: number; phi: number };
    orbitCenter: THREE.Vector3;
  } | null>(null);

  const currentStation = PROCESS_STATIONS[currentStepIdx];

  // Helper sound synthesiser (Web Audio API)
  const playChime = useCallback((type: 'step' | 'correct' | 'wrong') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'step') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'correct') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch {}
  }, [soundEnabled]);

  // Handle station transition
  const goToStation = useCallback((idx: number) => {
    const nextIdx = Math.max(0, Math.min(PROCESS_STATIONS.length - 1, idx));
    setCurrentStepIdx(nextIdx);
    playChime('step');

    if (!threeRef.current) return;
    const s = PROCESS_STATIONS[nextIdx];
    threeRef.current.targetCamPos.set(s.camPos[0], s.camPos[1], s.camPos[2]);
    threeRef.current.targetCamLookAt.set(s.coords[0], s.coords[1], s.coords[2]);
    threeRef.current.orbitCenter.set(s.coords[0], s.coords[1], s.coords[2]);
  }, [playChime]);

  // Auto-tour timer
  useEffect(() => {
    if (!isPlayingTour) return;
    const intervalMs = (6000 / tourSpeed);
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev >= PROCESS_STATIONS.length - 1) {
          setIsPlayingTour(false);
          return 0;
        }
        const next = prev + 1;
        goToStation(next);
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlayingTour, tourSpeed, goToStation]);

  // Initialize Three.js 3D Virtual Facility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 300);
    const initialStation = PROCESS_STATIONS[0];
    camera.position.set(initialStation.camPos[0], initialStation.camPos[1], initialStation.camPos[2]);

    const targetCamPos = new THREE.Vector3().copy(camera.position);
    const targetCamLookAt = new THREE.Vector3(initialStation.coords[0], initialStation.coords[1], initialStation.coords[2]);
    const currentLookAt = new THREE.Vector3().copy(targetCamLookAt);
    const orbitCenter = new THREE.Vector3().copy(targetCamLookAt);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
    dirLight.position.set(20, 40, 25);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    const d = 40;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const blueFillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    blueFillLight.position.set(-30, 20, -20);
    scene.add(blueFillLight);

    // 4. Warehouse Floor with Industrial Safety Markings
    const floorGeo = new THREE.PlaneGeometry(80, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x141a29,
      roughness: 0.45,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Subtle floor grid
    const gridHelper = new THREE.GridHelper(80, 40, 0x1e293b, 0x0f172a);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Safety yellow pathway borders
    const safetyStripeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const safetyWalkwayGeo = new THREE.PlaneGeometry(65, 0.25);
    const stripe1 = new THREE.Mesh(safetyWalkwayGeo, safetyStripeMat);
    stripe1.rotation.x = -Math.PI / 2;
    stripe1.position.set(2, 0.02, 6.5);
    scene.add(stripe1);

    const stripe2 = new THREE.Mesh(safetyWalkwayGeo, safetyStripeMat);
    stripe2.rotation.x = -Math.PI / 2;
    stripe2.position.set(2, 0.02, -6.5);
    scene.add(stripe2);

    // 5. Build Facility Structural Elements (Walls, Docks, Trusses)
    // Back wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const backWallGeo = new THREE.BoxGeometry(80, 8, 1);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 4, -25);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall with dock doors
    const leftWallGeo = new THREE.BoxGeometry(1, 8, 50);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-40, 4, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Inbound Dock Roll-up Door (Left)
    const dockDoorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const dockDoor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 7), dockDoorMat);
    dockDoor.position.set(-39.4, 2.75, 14);
    scene.add(dockDoor);

    // Outbound Dock Roll-up Door (Right)
    const dockDoorOutMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4 });
    const dockDoorOut = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 7), dockDoorOutMat);
    dockDoorOut.position.set(39.4, 2.75, -15);
    scene.add(dockDoorOut);

    // 6. Build Inbound & Outbound Transport Trucks (NEXUS Fleet)
    const createTruck = (x: number, z: number, rotY: number, colorHex: number) => {
      const truckGroup = new THREE.Group();
      // Cab
      const cabMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 2.8), cabMat);
      cab.position.set(0, 1.8, 0);
      cab.castShadow = true;
      truckGroup.add(cab);

      // Windshield
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 2.4), glassMat);
      glass.position.set(1.76, 2.2, 0);
      truckGroup.add(glass);

      // Cargo Container Box
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(7, 3.8, 3.0), boxMat);
      cargo.position.set(-5.3, 2.3, 0);
      cargo.castShadow = true;
      cargo.receiveShadow = true;
      truckGroup.add(cargo);

      // Chassis & Wheels
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
      [-1.5, -4, -7.5].forEach((wx) => {
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.4, 16), wheelMat);
        w1.rotation.x = Math.PI / 2;
        w1.position.set(wx, 0.65, 1.45);
        w1.castShadow = true;
        truckGroup.add(w1);

        const w2 = w1.clone();
        w2.position.z = -1.45;
        truckGroup.add(w2);
      });

      truckGroup.position.set(x, 0, z);
      truckGroup.rotation.y = rotY;
      scene.add(truckGroup);
      return truckGroup;
    };

    createTruck(-44, 14, 0, 0xf59e0b); // Inbound Truck outside Dock 1
    createTruck(44, -15, Math.PI, 0x10b981); // Outbound Truck outside Dock 4

    // 7. Pallet Racks (Aisle A & B)
    const createRack = (x: number, z: number, tiers: number, length: number) => {
      const rackGroup = new THREE.Group();
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.4 });
      const beamMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
      const cartonColors = [0xb45309, 0x92400e, 0x78350f, 0xd97706];

      // Vertical Upright Columns
      [-length / 2, length / 2].forEach((px) => {
        [-1, 1].forEach((pz) => {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.18, tiers * 1.8 + 0.5, 0.18), steelMat);
          col.position.set(px, (tiers * 1.8 + 0.5) / 2, pz);
          col.castShadow = true;
          rackGroup.add(col);
        });
      });

      // Horizontal Beams & Pallet Loads
      for (let t = 1; t <= tiers; t++) {
        const y = t * 1.7;
        // Front & Back Beams
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(length, 0.15, 0.1), beamMat);
        b1.position.set(0, y, 1);
        rackGroup.add(b1);
        const b2 = b1.clone();
        b2.position.z = -1;
        rackGroup.add(b2);

        // Pallets & Loaded Boxes
        const boxCount = 3;
        for (let b = 0; b < boxCount; b++) {
          const bx = -length / 2 + (length / boxCount) * (b + 0.5);
          // Wooden pallet
          const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.8), woodMat);
          pallet.position.set(bx, y + 0.08, 0);
          pallet.castShadow = true;
          pallet.receiveShadow = true;
          rackGroup.add(pallet);

          // Carton box atop pallet
          const color = cartonColors[(b + t) % cartonColors.length];
          const cMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.5), cMat);
          box.position.set(bx, y + 0.65, 0);
          box.castShadow = true;
          box.receiveShadow = true;
          rackGroup.add(box);
        }
      }

      rackGroup.position.set(x, 0, z);
      scene.add(rackGroup);
      return rackGroup;
    };

    createRack(-8, 2, 4, 6.5);
    createRack(-8, -2, 4, 6.5);
    createRack(-8, -7, 3, 6.5);

    // 8. Industrial Forklift
    const forkliftGroup = new THREE.Group();
    const flBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const flMastMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });

    const flBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.5), flBodyMat);
    flBody.position.set(0, 0.9, 0);
    flBody.castShadow = true;
    forkliftGroup.add(flBody);

    // Cage overhead
    const flCage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), flMastMat);
    flCage.position.set(-0.2, 2.3, 0);
    forkliftGroup.add(flCage);

    // Mast & Forks
    const flMast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 1.2), flMastMat);
    flMast.position.set(1.3, 1.8, 0);
    forkliftGroup.add(flMast);

    const flFork = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.8), flMastMat);
    flFork.position.set(2.0, 0.4, 0);
    flFork.castShadow = true;
    forkliftGroup.add(flFork);

    // Carried Pallet on forks
    const carriedPallet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
    carriedPallet.position.set(2.1, 0.5, 0);
    forkliftGroup.add(carriedPallet);

    const carriedBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0xb45309 }));
    carriedBox.position.set(2.1, 0.95, 0);
    carriedBox.castShadow = true;
    forkliftGroup.add(carriedBox);

    forkliftGroup.position.set(-4, 0, 2);
    forkliftGroup.rotation.y = Math.PI / 4;
    scene.add(forkliftGroup);

    // 9. Workstations: QC Desk, Control Tower, Packing Tables
    const createWorkbench = (x: number, z: number, colorHex: number, withMonitor: boolean = true) => {
      const benchGroup = new THREE.Group();
      const topMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
      const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });

      const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 1.5), topMat);
      top.position.set(0, 1.0, 0);
      top.castShadow = true;
      top.receiveShadow = true;
      benchGroup.add(top);

      [-1.3, 1.3].forEach((lx) => {
        [-0.6, 0.6].forEach((lz) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.92, 12), legMat);
          leg.position.set(lx, 0.46, lz);
          benchGroup.add(leg);
        });
      });

      if (withMonitor) {
        // Monitor
        const monMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.4, 8), legMat);
        stand.position.set(-0.6, 1.25, 0.2);
        benchGroup.add(stand);

        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.06), monMat);
        mon.position.set(-0.6, 1.6, 0.2);
        benchGroup.add(mon);

        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.42), screenMat);
        screen.position.set(-0.6, 1.6, 0.235);
        benchGroup.add(screen);
      }

      benchGroup.position.set(x, 0, z);
      scene.add(benchGroup);
      return benchGroup;
    };

    createWorkbench(-15, 10, 0x1e293b, true); // QC Station
    createWorkbench(2, -4, 0x0f172a, true);   // Control Tower Desk
    createWorkbench(18, 2, 0x334155, true);   // Packing Workbench

    // 10. Long Motorized Conveyor Line
    const conveyorGroup = new THREE.Group();
    const convFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

    const convLength = 14;
    const convBed = new THREE.Mesh(new THREE.BoxGeometry(convLength, 0.25, 1.4), convFrameMat);
    convBed.position.set(0, 0.9, 0);
    convBed.castShadow = true;
    conveyorGroup.add(convBed);

    // Rollers
    for (let r = -convLength / 2 + 0.3; r < convLength / 2; r += 0.4) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.35, 12), rollerMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(r, 1.05, 0);
      conveyorGroup.add(roller);
    }

    // Legs
    for (let lx = -convLength / 2 + 1; lx < convLength / 2; lx += 4) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 1.3), convFrameMat);
      leg.position.set(lx, 0.45, 0);
      conveyorGroup.add(leg);
    }

    conveyorGroup.position.set(11, 0, 4);
    scene.add(conveyorGroup);

    // 11. Sorting Chutes (Station 9)
    const sorterGroup = new THREE.Group();
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
    [-2, 0, 2].forEach((cz, idx) => {
      const chute = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 1.2), chuteMat);
      chute.rotation.z = -0.3;
      chute.position.set(idx * 0.4, 0.8, cz);
      chute.castShadow = true;
      sorterGroup.add(chute);

      // Destination Bin Basket
      const basketMat = new THREE.MeshStandardMaterial({ color: idx === 0 ? 0xef4444 : idx === 1 ? 0x3b82f6 : 0x10b981 });
      const basket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.0), basketMat);
      basket.position.set(2.2 + idx * 0.4, 0.4, cz);
      basket.castShadow = true;
      sorterGroup.add(basket);
    });
    sorterGroup.position.set(25, 0, -8);
    scene.add(sorterGroup);

    // 12. Stylized 3D Workers (Helmet + High-Vis Vest)
    const workers: THREE.Group[] = [];
    const createWorker = (x: number, z: number, rotY: number) => {
      const worker = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8 });
      const vestMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 }); // Neon Green Vest
      const helmetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 }); // Yellow Safety Helmet
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

      // Body (Torso)
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), vestMat);
      torso.position.set(0, 1.05, 0);
      torso.castShadow = true;
      worker.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
      head.position.set(0, 1.55, 0);
      worker.add(head);

      // Hard Hat Helmet
      const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), helmetMat);
      helmet.position.set(0, 1.7, 0);
      worker.add(helmet);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16), helmetMat);
      brim.position.set(0, 1.63, 0.04);
      worker.add(brim);

      // Legs
      [-0.14, 0.14].forEach((lx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), pantsMat);
        leg.position.set(lx, 0.35, 0);
        leg.castShadow = true;
        worker.add(leg);
      });

      worker.position.set(x, 0, z);
      worker.rotation.y = rotY;
      scene.add(worker);
      workers.push(worker);
      return worker;
    };

    createWorker(-21, 12, Math.PI / 2); // Receiving worker
    createWorker(-15, 8.5, 0);          // QC worker
    createWorker(6, 3.5, -Math.PI / 2); // Picking worker
    createWorker(18, 0.8, 0);           // Packing worker
    createWorker(27, -13, -Math.PI / 2); // Outbound loader worker

    // 13. Interactive 3D Station Number Badges (Pins ① - ⑩)
    const stationPins: THREE.Group[] = [];
    const stationBeacons: THREE.Mesh[] = [];

    PROCESS_STATIONS.forEach((s) => {
      const pinGroup = new THREE.Group();

      // Glowing circular beacon base on the floor
      const beaconGeo = new THREE.RingGeometry(0.8, 1.1, 32);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.set(s.coords[0], 0.03, s.coords[2]);
      scene.add(beacon);
      stationBeacons.push(beacon);

      // Pin Mast
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), mastMat);
      mast.position.set(s.coords[0], s.coords[1] + 1.2, s.coords[2]);
      pinGroup.add(mast);

      // Pin Head (Torus / Sphere with badge number)
      const badgeMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.4,
        roughness: 0.2,
      });
      const badge = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), badgeMat);
      badge.position.set(s.coords[0], s.coords[1] + 2.2, s.coords[2]);
      pinGroup.add(badge);

      pinGroup.userData = { stationId: s.id };
      scene.add(pinGroup);
      stationPins.push(pinGroup);
    });

    // 14. THE ANIMATED GOLDEN ORDER PARCEL (Flowing Box)
    const parcelGroup = new THREE.Group();
    const goldBoxMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.4,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
    });
    const parcelBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), goldBoxMat);
    parcelBox.castShadow = true;
    parcelGroup.add(parcelBox);

    // Box Ribbon / Tape detail
    const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.66, 0.15), ribbonMat);
    parcelGroup.add(ribbon1);

    // Glowing particle halo around the active parcel
    const haloGeo = new THREE.RingGeometry(0.5, 0.7, 24);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.32;
    parcelGroup.add(halo);

    parcelGroup.position.set(initialStation.coords[0], initialStation.coords[1], initialStation.coords[2]);
    scene.add(parcelGroup);

    // Save Three context
    threeRef.current = {
      scene,
      camera,
      renderer,
      parcelMesh: parcelGroup,
      workers,
      stationPins,
      stationBeacons,
      targetCamPos,
      targetCamLookAt,
      currentLookAt,
      isUserInteracting: false,
      mousePos: { x: 0, y: 0 },
      spherical: { radius: 18, theta: 0.4, phi: 1.1 },
      orbitCenter,
    };

    // 15. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (threeRef.current) {
        const { camera, targetCamPos, targetCamLookAt, currentLookAt, parcelMesh, stationBeacons, workers } = threeRef.current;

        // Smooth camera lerp
        camera.position.lerp(targetCamPos, 0.05);
        currentLookAt.lerp(targetCamLookAt, 0.05);
        camera.lookAt(currentLookAt);

        // Auto-rotate scene when toggle is active
        if (isAutoRotate && !threeRef.current.isUserInteracting) {
          const radius = camera.position.distanceTo(currentLookAt);
          const angle = elapsed * 0.25;
          targetCamPos.x = currentLookAt.x + Math.sin(angle) * radius;
          targetCamPos.z = currentLookAt.z + Math.cos(angle) * radius;
        }

        // Animate Golden Parcel: gentle bobbing and breathing glow
        parcelMesh.position.y = currentStation.coords[1] + Math.sin(elapsed * 3.5) * 0.12;
        parcelMesh.rotation.y = elapsed * 0.8;

        // Smooth move towards current station coords
        parcelMesh.position.x = THREE.MathUtils.lerp(parcelMesh.position.x, currentStation.coords[0], 0.08);
        parcelMesh.position.z = THREE.MathUtils.lerp(parcelMesh.position.z, currentStation.coords[2], 0.08);

        // Animate active beacon ring pulse
        stationBeacons.forEach((beacon, i) => {
          if (i === currentStepIdx) {
            beacon.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.25);
            (beacon.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b); // Gold for active
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0.85;
          } else {
            beacon.scale.setScalar(1.0);
            (beacon.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8); // Sky blue
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0.35;
          }
        });

        // Subtle worker breathing
        workers.forEach((w, idx) => {
          w.position.y = Math.sin(elapsed * 2 + idx) * 0.03;
        });

        renderer.render(scene, camera);
      }
    };
    animate();

    // 16. Window resize handler
    const handleResize = () => {
      if (!containerRef.current || !threeRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 17. Interactive Click on 3D Pins (Raycaster)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current || !threeRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, threeRef.current.camera);
      const intersects = raycaster.intersectObjects(threeRef.current.scene.children, true);

      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== threeRef.current.scene) {
          if (obj.userData?.stationId) {
            const stIdx = obj.userData.stationId - 1;
            goToStation(stIdx);
            return;
          }
          obj = obj.parent;
        }
      }
    };

    container.addEventListener('click', handleClick);

    // Orbit Drag Navigation (Mouse & Touch)
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !threeRef.current) return;
      const dx = (e.clientX - prevMouse.x) * 0.008;
      const dy = (e.clientY - prevMouse.y) * 0.008;

      const cam = threeRef.current.camera;
      const center = threeRef.current.orbitCenter;
      const offset = cam.position.clone().sub(center);

      // Horizontal orbit
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx);

      // Vertical tilt (clamp to avoid flips)
      const curY = offset.y;
      offset.y = THREE.MathUtils.clamp(curY + dy * 12, 3, 30);

      threeRef.current.targetCamPos.copy(center.clone().add(offset));
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!threeRef.current) return;
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.02;
      const cam = threeRef.current.camera;
      const center = threeRef.current.orbitCenter;
      const dir = cam.position.clone().sub(center).normalize();
      const curDist = cam.position.distanceTo(center);
      const newDist = THREE.MathUtils.clamp(curDist + zoomDelta, 6, 45);

      threeRef.current.targetCamPos.copy(center.clone().add(dir.multiplyScalar(newDist)));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [currentStation, currentStepIdx, goToStation, isAutoRotate]);

  // Quiz submission
  const handleAnswerSelect = (optionIdx: number) => {
    if (selectedAnswers[currentStation.id] !== undefined) return; // already answered
    const isCorrect = optionIdx === currentStation.quiz.correctIndex;
    setSelectedAnswers((prev) => ({ ...prev, [currentStation.id]: optionIdx }));

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      playChime('correct');
    } else {
      playChime('wrong');
    }
  };

  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-slate-800 bg-[#060911] shadow-2xl flex flex-col ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : 'h-[820px]'}`}>
      {/* 1. TOP HEADER COCKPIT BAR */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#090d1a]/90 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <Box size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white tracking-wide uppercase">
                3D Warehouse Digital Twin & SOP Simulator
              </h2>
              <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-black text-emerald-400">
                10-STEP PIPELINE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              จำลองเส้นทาง 1 ออเดอร์ในศูนย์กระจายสินค้า · หมุน 360° เจาะลึก SOP & ตรวจสอบคุณภาพ
            </p>
          </div>
        </div>

        {/* View Mode & Audio Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
            title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            type="button"
            onClick={() => setIsAutoRotate(!isAutoRotate)}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isAutoRotate
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Compass size={14} className={isAutoRotate ? 'animate-spin' : ''} />
            <span>หมุน 360°</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'ย่อหน้าจอ' : 'ขยายเต็มจอ'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* 2. MAIN 3D WORKBENCH & LEFT SOP INTELLIGENCE PANEL */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* Three.js 3D Canvas Container */}
        <div ref={containerRef} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

        {/* 3D Floating Legend Pill (Top-Center of 3D scene) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex items-center gap-2.5 rounded-full bg-[#060911]/85 border border-slate-700/80 px-4 py-1.5 shadow-2xl backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider">
              กำลังโฟกัส: {currentStation.titleTh}
            </span>
            <span className="text-[10px] font-mono text-amber-400 font-black">
              ({currentStation.area})
            </span>
          </div>
        </div>

        {/* LEFT DOCKED COCKPIT: SOP, LIVE DIGITAL TWIN & QUIZ PANEL */}
        <div className="absolute top-4 left-4 bottom-20 z-20 w-[380px] max-w-[calc(100vw-32px)] flex flex-col rounded-3xl border border-slate-800/90 bg-[#090d1a]/95 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden transition-all duration-300">
          {/* Station Step Selector Pill Header */}
          <div className="p-4 border-b border-slate-800/80 bg-[#0c1224]/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
                STAGE {currentStation.stepNumber} OF 10
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {currentStation.area}
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight leading-tight">
              {currentStation.titleTh}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {currentStation.titleEn}
            </p>

            {/* Stage Progress Track */}
            <div className="h-1.5 w-full rounded-full bg-slate-800 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(currentStation.stepNumber / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* Mode Switch Tabs (SOP / Live / Quiz) */}
          <div className="grid grid-cols-3 p-1.5 bg-slate-900/90 border-b border-slate-800/80 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('SOP')}
              className={`py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'SOP'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Info size={13} />
              <span>SOP สอนงาน</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LIVE')}
              className={`py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'LIVE'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity size={13} />
              <span>คลังสด (Live)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('QUIZ')}
              className={`py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'QUIZ'
                  ? 'bg-sky-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle size={13} />
              <span>ทดสอบ ({answeredCount}/10)</span>
            </button>
          </div>

          {/* TAB CONTENT SCROLLER */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* TAB 1: SOP LEARNING MODE */}
            {activeTab === 'SOP' && (
              <div className="space-y-3.5 text-xs">
                {/* Description */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 leading-relaxed">
                  <p>{currentStation.description}</p>
                </div>

                {/* Key Terminology Pills */}
                {currentStation.keyTerms.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">
                      คำศัพท์สำคัญประจำสถานี
                    </span>
                    <div className="space-y-1">
                      {currentStation.keyTerms.map((kt) => (
                        <div key={kt.term} className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono font-black text-[10px] shrink-0">
                            {kt.term}
                          </span>
                          <span className="text-[11px] text-slate-300">{kt.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* QC Checkpoints (Green Card) */}
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
                    <CheckCircle2 size={16} />
                    <span>จุดตรวจคุณภาพ (QC Checklist)</span>
                  </div>
                  <ul className="space-y-1.5">
                    {currentStation.qcChecklist.map((qc, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-200">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>{qc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Safety Rules (Red Card) */}
                <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-black text-xs uppercase tracking-wider">
                    <AlertTriangle size={16} />
                    <span>ข้อควรระวัง & ความปลอดภัย (Safety)</span>
                  </div>
                  <ul className="space-y-1.5">
                    {currentStation.safetyRules.map((sr, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-200">
                        <span className="text-rose-400 font-bold shrink-0">!</span>
                        <span>{sr}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* KPI Gauge Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                      ตัวชี้วัด (KPI Target)
                    </span>
                    <span className="text-xs font-black text-white">
                      {currentStation.kpi.label}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">
                      เกณฑ์มาตรฐาน: {currentStation.kpi.target}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-amber-400">
                      {currentStation.kpi.current}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 ml-1">
                      {currentStation.kpi.unit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE DIGITAL TWIN TELEMETRY */}
            {activeTab === 'LIVE' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                        สถานะคิวงาน Real-Time
                      </span>
                      <span className="text-base font-black text-white">
                        {currentStation.liveMetrics.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-2xl font-black text-emerald-400">
                      {currentStation.liveMetrics.queueCount}
                    </span>
                    <span className="text-[10px] text-slate-400 block">งานรอประมวลผล</span>
                  </div>
                </div>

                {/* Real-time throughput gauge */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Throughput/ชั่วโมง</span>
                    <span className="text-lg font-black font-mono text-cyan-400">
                      {currentStation.liveMetrics.hourlyThroughput} <span className="text-[10px] font-normal text-slate-400">หน่วย</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">ขีดความสามารถ</span>
                    <span className="text-lg font-black font-mono text-amber-400">
                      88.5%
                    </span>
                  </div>
                </div>

                {/* Station Bottleneck Detector Advisory */}
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <TrendingUp size={15} className="text-amber-400" />
                    <span>การวิเคราะห์ความลื่นไหลของสายการผลิต</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ระบบ AI ตรวจสอบอัตราการไหลของออเดอร์ในสถานี {currentStation.titleTh} อยู่ในเกณฑ์มาตรฐาน ไม่มีคอขวด (Bottleneck Free) รองรับรอบรถขนส่งได้ตามเวลาตัดรอบ
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: TRAINING ONBOARDING QUIZ */}
            {activeTab === 'QUIZ' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sky-400">
                    <Award size={16} />
                    <span>แบบทดสอบความเข้าใจพนักงาน</span>
                  </div>
                  <span className="text-xs font-mono font-black text-white">
                    คะแนน: {quizScore}/{answeredCount}
                  </span>
                </div>

                {/* Quiz Question Card */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <p className="text-sm font-black text-white leading-snug">
                    คำถามข้อที่ {currentStation.stepNumber}:<br />
                    <span className="font-bold text-slate-200">{currentStation.quiz.question}</span>
                  </p>

                  {/* Options */}
                  <div className="space-y-2 pt-1">
                    {currentStation.quiz.options.map((opt, oIdx) => {
                      const userChoice = selectedAnswers[currentStation.id];
                      const isSelected = userChoice === oIdx;
                      const isCorrect = oIdx === currentStation.quiz.correctIndex;
                      const hasAnswered = userChoice !== undefined;

                      let btnStyle = 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700/80';
                      if (hasAnswered) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.25)]';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold';
                        } else {
                          btnStyle = 'opacity-40 bg-slate-900 border-slate-800 text-slate-500';
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={hasAnswered}
                          onClick={() => handleAnswerSelect(oIdx)}
                          className={`w-full text-left p-3 rounded-xl border text-xs leading-relaxed transition-all cursor-pointer flex items-start gap-2.5 ${btnStyle}`}
                        >
                          <span className="font-mono font-black text-[11px] shrink-0 mt-0.5">
                            {['ก', 'ข', 'ค'][oIdx]}.
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Answer Explanation */}
                  {selectedAnswers[currentStation.id] !== undefined && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed mt-2">
                      <span className="text-amber-400 font-bold block mb-1">เฉลยและคำอธิบาย:</span>
                      {currentStation.quiz.explanation}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM CONTROL BAR & PLAYBACK TOOLBAR */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-[#090d1a]/95 px-5 py-3 backdrop-blur-xl">
        {/* Navigation Step Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToStation(currentStepIdx - 1)}
            disabled={currentStepIdx === 0}
            className="flex items-center gap-1 px-3 h-10 rounded-xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:text-white disabled:opacity-40 transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>ก่อนหน้า</span>
          </button>

          <button
            type="button"
            onClick={() => goToStation(currentStepIdx + 1)}
            disabled={currentStepIdx === PROCESS_STATIONS.length - 1}
            className="flex items-center gap-1 px-3 h-10 rounded-xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:text-white disabled:opacity-40 transition-all cursor-pointer"
          >
            <span>ถัดไป</span>
            <ChevronRight size={16} />
          </button>

          {/* Auto-Tour Toggle */}
          <button
            type="button"
            onClick={() => setIsPlayingTour(!isPlayingTour)}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl font-black text-xs transition-all cursor-pointer ${
              isPlayingTour
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
            }`}
          >
            {isPlayingTour ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlayingTour ? 'หยุดทัวร์' : 'เล่นทัวร์อัตโนมัติ'}</span>
          </button>
        </div>

        {/* 10 Step Selector Pills */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto py-1">
          {PROCESS_STATIONS.map((st, i) => {
            const isActive = i === currentStepIdx;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => goToStation(i)}
                className={`w-8 h-8 rounded-xl font-mono font-black text-xs transition-all cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 scale-110 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                    : 'bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={st.titleTh}
              >
                {st.stepNumber}
              </button>
            );
          })}
        </div>

        {/* Speed Adjustment Control */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px] font-mono font-bold text-slate-400">
          <Zap size={13} className="text-amber-400 ml-1.5" />
          <span className="mr-1">ความเร็ว:</span>
          {([1, 2, 5] as const).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setTourSpeed(spd)}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                tourSpeed === spd
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
