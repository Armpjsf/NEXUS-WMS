'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Maximize2,
  Compass,
  Activity,
  HelpCircle,
  Eye,
  RefreshCw,
  Tag,
  ShoppingBag,
  Sun,
  Moon,
  MapPin,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { RackConfig, WarehouseLayout, binCodeFor, normalizeBinCode } from '@/lib/warehouseLayout';
import {
  stockRowsWithExtraLocations,
  buildWarehouseMap,
  ExtraLocation,
  MapBin,
} from '@/lib/warehouseLayoutMap';

export type ProcessStation = {
  id: number;
  stepNumber: number;
  phase: 'INBOUND' | 'OUTBOUND';
  titleTh: string;
  titleEn: string;
  subtitle: string;
  area: string;
  coords: [number, number, number]; // [x, y, z]
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

export interface OutboundOrderItem {
  sku: string;
  skuName: string;
  binCode: string;
  qty: number;
}

export interface OutboundOrder {
  orderId: string;
  docNum?: string;
  customerName: string;
  sku: string;
  skuName: string;
  binCode: string;
  allBins?: string[];
  items?: OutboundOrderItem[];
  qty: number;
  weightKg: number;
  destination: string;
  statusLabel?: string;
  priority: 'EXPRESS' | 'URGENT' | 'STANDARD';
}

export const DEFAULT_ACTIVE_ORDERS: OutboundOrder[] = [
  {
    orderId: 'SO-9821',
    customerName: 'บจก. สุราษฎร์เฟอร์นิเจอร์',
    sku: 'AP 0937',
    skuName: 'ลามิเนตลายหินอ่อนขาว Carrara',
    binCode: 'A-004',
    allBins: ['A-004'],
    qty: 20,
    weightKg: 48,
    destination: 'สุราษฎร์ธานี (URT)',
    priority: 'EXPRESS',
  },
  {
    orderId: 'SO-9822',
    customerName: 'ร้านโมเดิร์นดีไซน์ หาดใหญ่',
    sku: 'SM 8649',
    skuName: 'แผ่นอะคริลิกใส Mirror Gloss',
    binCode: 'C-006',
    allBins: ['C-006'],
    qty: 15,
    weightKg: 32,
    destination: 'หาดใหญ่ (HDY)',
    priority: 'URGENT',
  },
  {
    orderId: 'SO-9823',
    customerName: 'ภูเก็ตวิลล่า บิลเดอร์',
    sku: 'AP 0861',
    skuName: 'แผ่นไม้วีเนียร์ Natural Oak',
    binCode: 'D-004',
    allBins: ['D-004'],
    qty: 30,
    weightKg: 65,
    destination: 'ภูเก็ต (PKT)',
    priority: 'STANDARD',
  },
  {
    orderId: 'SO-9824',
    customerName: 'เมโทร คอนสตรัคชั่น กทม.',
    sku: 'FP 0102',
    skuName: 'แผ่นโฟเมก้าลายไม้สัก Golden Teak',
    binCode: 'B-002',
    allBins: ['B-002'],
    qty: 10,
    weightKg: 24,
    destination: 'กรุงเทพฯ (BKK)',
    priority: 'EXPRESS',
  },
];

export const BASE_PROCESS_STATIONS: Omit<ProcessStation, 'coords'>[] = [
  {
    id: 1,
    stepNumber: 1,
    phase: 'INBOUND',
    titleTh: '1. รับสินค้าเข้า (Inbound)',
    titleEn: 'Inbound Receiving & Unload',
    subtitle: 'ตรวจรับตู้สินค้าและเทียบเอกสาร ASN',
    area: 'Dock 01 - Inbound Staging',
    description:
      'เทียบรถบรรทุกเข้าช่องโหลด (Dock Leveler) พนักงานใช้แฮนด์พาเลทขนถ่ายพาเลทสินค้าลงจากท้ายรถ ตรวจนับจำนวนกล่องเทียบกับใบกำกับส่งของ (Delivery Note) และ ASN พร้อมติดรหัส LPN',
    keyTerms: [
      { term: 'ASN', meaning: 'Advanced Shipping Notice (เอกสารแจ้งส่งสินค้าล่วงหน้า)' },
      { term: 'LPN', meaning: 'License Plate Number (รหัสบาร์โค้ดประจำพาเลท)' },
      { term: 'Dock Leveler', meaning: 'สะพานปรับระดับท้ายรถบรรทุกไฮดรอลิก' },
    ],
    qcChecklist: [
      'ตรวจเช็คซีลล็อคตู้คอนเทนเนอร์ตรงตามเอกสารก่อนเปิดตู้',
      'สภาพบรรจุภัณฑ์ภายนอกต้องสมบูรณ์ ไม่เปียกชื้น ไม่ยุบ และไม่มีรอยกรีด',
      'สแกนบาร์โค้ด LPN ทุกพาเลทเพื่อยืนยันพิกัดรับเข้าในระบบ WMS',
    ],
    safetyRules: [
      'สวมหมวกนิรภัย (Hard Hat) เสื้อสะท้อนแสง และรองเท้าหัวเหล็กตลอดเวลาในลานโหลด',
      'ต้องวางลิ่มหนุนล้อรถบรรทุก (Wheel Chock) และดึงเบรกมือก่อนเริ่มขนถ่าย',
    ],
    kpi: { label: 'เวลาขนถ่ายเฉลี่ย', target: '< 25 นาที/คัน', current: '18.4', unit: 'นาที' },
    quiz: {
      question: 'หากตรวจพบกล่องสินค้ามีรอยฉีกขาดหรือมีคราบเปียกชื้นตั้งแต่ตอนเปิดตู้ขนส่ง ควรปฏิบัติตาม SOP อย่างไร?',
      options: [
        'รับเข้าสู่ระบบไปก่อน แล้วค่อยแจ้งหัวหน้าในวันรุ่งขึ้น',
        'ถ่ายภาพหลักฐาน ทำบันทึก Damage Report และแยกสินค้าเข้าโซนกักกัน (Hold/Quarantine Zone)',
        'ปฏิเสธการรับสินค้าทั้งคันรถและไล่รถบรรทุกกลับทันที',
      ],
      correctIndex: 1,
      explanation:
        'ตามระเบียบ WMS มาตรฐาน ต้องบันทึกรูปภาพ ออก Damage Report และแยกเข้าโซนกักกัน (Hold) ห้ามรับเข้าสต็อกปกติโดยเด็ดขาด',
    },
    liveMetrics: { queueCount: 4, hourlyThroughput: 140, status: 'OPTIMAL' },
  },
  {
    id: 2,
    stepNumber: 2,
    phase: 'INBOUND',
    titleTh: '2. ตรวจรับคุณภาพ (QC)',
    titleEn: 'Quality Gate & Inspection',
    subtitle: 'พนักงานส่งต่อสินค้าเข้าโต๊ะตรวจ QC',
    area: 'Station QC - Inspection Gate',
    description:
      'พนักงานลากพาเลทสินค้าจากจุดดรอปหน้าท่าเทียบ ส่งต่อเข้าสถานีตรวจ QC เจ้าหน้าที่ประจำโต๊ะทำการสุ่มตรวจตามเกณฑ์ AQL เช็คบาร์โค้ด SKU ล็อตผลิต และวันหมดอายุ (Shelf-life)',
    keyTerms: [
      { term: 'AQL', meaning: 'Acceptable Quality Limit (เกณฑ์มาตรฐานสุ่มตรวจ)' },
      { term: 'Shelf-life', meaning: 'อายุการเก็บรักษาขั้นต่ำของสินค้า' },
      { term: 'Batch/Lot', meaning: 'รหัสรุ่นการผลิตเพื่อการตรวจสอบย้อนกลับ' },
    ],
    qcChecklist: [
      'ตรวจสอบวันหมดอายุ (Expiry Date) ต้องคงเหลือไม่น้อยกว่า 75% ของอายุสินค้า',
      'ทดสอบยิงสแกนบาร์โค้ด SKU ระดับชิ้น/กล่อง ต้องอ่านได้รวดเร็วคมชัด',
      'ติดป้ายสติ๊กเกอร์สถานะ "QC PASSED" สีเขียวก่อนส่งต่อให้โฟล์กลิฟต์',
    ],
    safetyRules: [
      'ใช้คัตเตอร์เซฟตี้ที่มีระบบดึงใบมีดกลับอัตโนมัติเมื่อกรีดเทปกล่อง',
      'ห้ามปีนขึ้นบนพาเลทเพื่อตรวจของ ให้ใช้บันไดตรวจสินค้ามาตรฐาน',
    ],
    kpi: { label: 'QC Pass Rate', target: '≥ 99.5%', current: '99.8', unit: '%' },
    quiz: {
      question: 'ข้อใดคือเกณฑ์มาตรฐานวันหมดอายุ (Shelf-life) ของสินค้าทั่วไปในการรับเข้าคลังเพื่อไม่ให้เกิดสต็อกเดดแอร์?',
      options: [
        'ต้องมีอายุคงเหลือไม่น้อยกว่า 75% ของอายุสินค้าทั้งหมด',
        'เหลืออายุอย่างน้อย 7 วันก็สามารถรับเข้าได้ทันที',
        'ไม่จำเป็นต้องเช็ควันหมดอายุถ้าแพ็คเกจยังดูใหม่',
      ],
      correctIndex: 0,
      explanation:
        'มาตรฐานการบริหารคลังสินค้า สินค้าทั่วไปต้องมี Shelf-life คงเหลือ ≥ 75% เพื่อให้มีระยะเวลาเพียงพอในการกระจายและจำหน่ายต่อ',
    },
    liveMetrics: { queueCount: 2, hourlyThroughput: 85, status: 'OPTIMAL' },
  },
  {
    id: 3,
    stepNumber: 3,
    phase: 'INBOUND',
    titleTh: '3. จัดเก็บเข้าชั้น (Putaway)',
    titleEn: 'Forklift Directed Putaway',
    subtitle: 'โฟล์กลิฟต์ยกพาเลทจาก QC เข้าแร็ค',
    area: 'Racks - Storage Bins',
    description:
      'รถโฟล์กลิฟต์รับพาเลทที่ผ่าน QC ขับเข้าสู่ช่องทางเดินแร็คตามพิกัดที่ WMS ชี้แนะ (Directed Putaway) ยกงาขึ้นวางพาเลทเข้าช่องจัดเก็บ และสแกนบาร์โค้ดช่อง (Location Bin) ยืนยัน',
    keyTerms: [
      { term: 'Directed Putaway', meaning: 'การระบุพิกัดจัดเก็บอัตโนมัติตามอัลกอริทึม WMS' },
      { term: 'ABC Slotting', meaning: 'การจัดวางสินค้าตามความถี่ในการเบิก (A = หยิบเร็วสุด)' },
      { term: 'Bin Confirmation', meaning: 'การสแกนบาร์โค้ดช่องเก็บเพื่อป้องกันวางผิดที่' },
    ],
    qcChecklist: [
      'ห้ามวางพาเลทล้นขอบคานหน้า-หลังเกิน 5 เซนติเมตร',
      'น้ำหนักสินค้าบนพาเลทต้องไม่เกิน Load Capacity ของชั้นวางแร็ค',
      'สแกนบาร์โค้ดพิกัดช่องเก็บ (Location Bin Code) ทุกครั้งที่ยกวาง',
    ],
    safetyRules: [
      'ความเร็วรถโฟล์กลิฟต์ในช่องทางเดินห้ามเกิน 8 กม./ชม.',
      'ห้ามคนเดินเท้าตัดหน้ารถโฟล์กลิฟต์ขณะที่เสายกกำลังทำงาน',
    ],
    kpi: { label: 'ความแม่นยำพิกัดจัดเก็บ', target: '100%', current: '99.9', unit: '%' },
    quiz: {
      question: 'เพราะเหตุใดพนักงานขับโฟล์กลิฟต์จึงต้อง "สแกนบาร์โค้ดพิกัดช่อง (Bin Code)" ทุกครั้งที่วางพาเลท?',
      options: [
        'เพื่อยืนยันว่าสินค้าถูกเก็บในตำแหน่งที่ WMS ชี้แนะ ป้องกันสินค้าสูญหายหรือหาไม่เจอในอนาคต',
        'เพื่อเช็คว่าแบตเตอรี่ของรถโฟล์กลิฟต์ยังมีประจุเพียงพอ',
        'เป็นขั้นตอนบังคับของกรมการขนส่งทางบกเท่านั้น',
      ],
      correctIndex: 0,
      explanation:
        'การสแกน Bin Confirmation ป้องกันปัญหาสต็อกหลงตำแหน่ง (Lost/Misplaced Stock) ทำให้หยิบสินค้าได้รวดเร็วและตรงเป๊ะ 100%',
    },
    liveMetrics: { queueCount: 6, hourlyThroughput: 110, status: 'OPTIMAL' },
  },
  {
    id: 4,
    stepNumber: 4,
    phase: 'OUTBOUND',
    titleTh: '4. ปล่อยรอบคำสั่งซื้อ (Wave)',
    titleEn: 'Wave Release & Dispatching',
    subtitle: 'ศูนย์ควบคุมปล่อยคำสั่งเบิกจ่าย',
    area: 'Control Tower - Operation Hub',
    description:
      'Control Tower วิเคราะห์รอบคำสั่งซื้อและเส้นทางเดินรถ ปล่อยคลื่นคำสั่งซื้อ (Wave Release) ส่งสัญญาณงานไปยังเครื่อง PDA ของพนักงานหยิบประจำโซน โดยระบุช่องเก็บ (Bin) และสินค้าจริงในแร็ค',
    keyTerms: [
      { term: 'Wave Management', meaning: 'การจัดกลุ่มใบสั่งซื้อเพื่อปล่อยงานเป็นรอบอย่างมีประสิทธิภาพ' },
      { term: 'Cut-off Time', meaning: 'เวลาปิดรับออเดอร์ของแต่ละรอบขนส่ง' },
      { term: 'Pick Density', meaning: 'ความหนาแน่นของจุดหยิบสินค้าต่อหนึ่งเส้นทาง' },
    ],
    qcChecklist: [
      'ตรวจสอบสินค้ามีสต็อกพร้อมหยิบครบถ้วน (On-hand available) ก่อนปล่อย Wave',
      'จัดลำดับออเดอร์ตามรอบรถขนส่งที่ต้องออกก่อน (First-Depart, First-Released)',
    ],
    safetyRules: [
      'ตรวจสอบความจุพื้นที่พักสินค้าขาออก (Staging Area) ไม่ให้เกิดปัญหาพื้นที่ล้นติดขัด',
    ],
    kpi: { label: 'On-time Wave Release', target: '≥ 98%', current: '99.1', unit: '%' },
    quiz: {
      question: 'หลักการสำคัญที่สุดในการจัดกลุ่มคำสั่งซื้อแบบ "Wave Picking" คืออะไร?',
      options: [
        'หยิบทีละออเดอร์เรียงตามลำดับเวลาที่ลูกค้ากดสั่งเข้ามา',
        'รวมรายการสินค้าจากหลายออเดอร์ที่มีโซนใกล้เคียงกัน เพื่อลดระยะทางการเดินหยิบและทันรอบรถ',
        'ปล่อยออเดอร์ทั้งหมดในครั้งเดียวโดยไม่ต้องจัดกลุ่ม',
      ],
      correctIndex: 1,
      explanation:
        'Wave Picking ช่วยประหยัดเวลาเดินหยิบได้มากกว่า 40% โดยการรวบรวมสินค้าจากหลายออเดอร์ในโซนเดียวกันมาหยิบในรอบเดียว',
    },
    liveMetrics: { queueCount: 18, hourlyThroughput: 220, status: 'BUSY' },
  },
  {
    id: 5,
    stepNumber: 5,
    phase: 'OUTBOUND',
    titleTh: '5. พนักงานหยิบสินค้า (Picking)',
    titleEn: 'Batch Picking to Cart',
    subtitle: 'พนักงานเดินหยิบใส่รถเข็นเบิกจ่าย',
    area: 'Aisle Storage - Pick Face',
    description:
      'พนักงานเข็นรถเข็นเบิกจ่าย (Pick Cart) เดินเข้าตามช่องทางเดินตรงไปยังช่องเก็บจริง (Location Bin) หยิบสินค้าจากชั้นวางตามกฎ FEFO ยิงสแกน SKU และนำสินค้าลงตะกร้าบนรถเข็น',
    keyTerms: [
      { term: 'FEFO', meaning: 'First-Expired, First-Out (สินค้าที่หมดอายุก่อน ต้องหยิบก่อนเสมอ)' },
      { term: 'Pick Cart', meaning: 'รถเข็นแยกช่องบรรจุสินค้าสำหรับ Batch Picking' },
      { term: 'Pick Face', meaning: 'ตำแหน่งชั้นล่างที่เปิดให้คนงานเดินหยิบได้สะดวก' },
    ],
    qcChecklist: [
      'สแกนบาร์โค้ดสินค้ายืนยันรหัส SKU ถูกต้องตรงกับ Pick List 100%',
      'ตรวจสอบสภาพกล่องสินค้าก่อนหยิบลงตะกร้า ต้องไม่มีรอยบุบ ฉีกขาด หรือชำรุด',
    ],
    safetyRules: [
      'ใช้เทคนิคการยกของที่ถูกวิธี (ย่อเข่า หลังตรง) หลีกเลี่ยงอาการบาดเจ็บของกล้ามเนื้อ',
      'ห้ามวางรถเข็นกีดขวางทางหนีไฟหรือตู้ดับเพลิง',
    ],
    kpi: { label: 'อัตราการหยิบเฉลี่ย', target: '> 120 lines/ชม.', current: '138', unit: 'lines/ชม.' },
    quiz: {
      question:
        'หากสินค้าชนิดเดียวกันมี 2 ล็อตบนชั้นวาง: ล็อต A หมดอายุอีก 3 เดือนข้างหน้า, ล็อต B หมดอายุอีก 8 เดือนข้างหน้า ควรหยิบชิ้นไหนตามระบบ FEFO?',
      options: [
        'หยิบล็อต B เพราะสินค้ายังสดใหม่กว่า',
        'หยิบล็อต A เพราะวันหมดอายุใกล้กว่า ต้องระบายออกก่อนตามกฎ FEFO',
        'หยิบล็อตไหนก็ได้ที่หยิบง่ายกว่า',
      ],
      correctIndex: 1,
      explanation:
        'FEFO (First-Expired, First-Out) บังคับให้หยิบล็อตที่หมดอายุก่อน (ล็อต A) ออกไปส่งมอบก่อน เพื่อป้องกันสินค้าตกค้างจนหมดอายุในคลัง',
    },
    liveMetrics: { queueCount: 12, hourlyThroughput: 310, status: 'OPTIMAL' },
  },
  {
    id: 6,
    stepNumber: 6,
    phase: 'OUTBOUND',
    titleTh: '6. ส่งขึ้นสายพาน (Conveyor Feed)',
    titleEn: 'Conveyor Induction & Feed',
    subtitle: 'พนักงานเข็นของมาป้อนขึ้นสายพานลำเลียง',
    area: 'Conveyor Feed - Main Line',
    description:
      'พนักงานเข็นรถเข็นจากโซนชั้นวาง มายังหัวสายพานลำเลียง (Conveyor Induction) ยกกล่อง/ตะกร้าป้อนขึ้นบนลูกกลิ้งมอเตอร์ เพื่อลำเลียงส่งต่อไปยังสถานีบรรจุหีบห่ออย่างต่อเนื่อง',
    keyTerms: [
      { term: 'Conveyor Induction', meaning: 'จุดป้อนกล่องพัสดุขึ้นสู่ระบบสายพานลำเลียง' },
      { term: 'Zone Accumulation', meaning: 'ระบบหยุดพักกล่องอัตโนมัติเพื่อป้องกันกล่องชนกระแทก' },
    ],
    qcChecklist: [
      'จัดวางกล่องบนสายพานให้อยู่กึ่งกลาง ไม่เอียงหรือซ้อนทับกัน',
      'ตรวจสอบน้ำหนักกล่องต้องไม่เกินพิกัดการรับน้ำหนักของมอเตอร์สายพาน',
    ],
    safetyRules: [
      'ห้ามสวมใส่เครื่องประดับที่หลวม หรือเสื้อผ้าที่มีสายห้อยใกล้ลูกกลิ้งสายพาน',
      'เรียนรู้ตำแหน่งปุ่มหยุดฉุกเฉิน (Emergency Stop: E-Stop) ตลอดแนวสายพาน',
    ],
    kpi: { label: 'Conveyor Uptime', target: '≥ 99.0%', current: '99.7', unit: '%' },
    quiz: {
      question: 'หากพบเห็นสิ่งแปลกปลอมหรือมีสิ่งของติดขัดในลูกกลิ้งสายพานลำเลียง ควรทำอย่างไรเป็นอันดับแรก?',
      options: [
        'เอามือเข้าไปดึงสิ่งของออกทันทีขณะที่สายพานยังหมุนอยู่',
        'กดปุ่ม Emergency Stop (E-Stop) หยุดการทำงานของสายพานทันทีก่อนแจ้งช่างซ่อมบำรุง',
        'เร่งความเร็วสายพานเพื่อให้แรงขับดันสิ่งของหลุดออกไปเอง',
      ],
      correctIndex: 1,
      explanation:
        'ความปลอดภัยสูงสุด: ต้องกดปุ่มหยุดฉุกเฉิน (E-Stop) ทันที ห้ามยื่นมือหรืออวัยวะใดๆ เข้าไปในเครื่องจักรที่กำลังทำงานอยู่เด็ดขาด',
    },
    liveMetrics: { queueCount: 8, hourlyThroughput: 450, status: 'OPTIMAL' },
  },
  {
    id: 7,
    stepNumber: 7,
    phase: 'OUTBOUND',
    titleTh: '7. บรรจุกล่อง & ตรวจสอบ (Packing)',
    titleEn: 'Packing, Cushioning & Audit',
    subtitle: 'พนักงานรับกล่องจากสายพานเข้าโต๊ะแพ็ค',
    area: 'Packing Station #03',
    description:
      'กล่องเลื่อนมาตามสายพานถึงโต๊ะแพ็ค เจ้าหน้าที่ประจำโต๊ะยกกล่องตรวจสอบรายการสินค้า (Order Audit) ใส่แผ่นกันกระแทก (Air Cushion) และปิดผนึกเทปกาวนิรภัย WMS อย่างแน่นหนา',
    keyTerms: [
      { term: 'Order Audit', meaning: 'การสแกนตรวจเช็คจำนวนและความถูกต้องของสินค้าครบ 100% ก่อนปิดกล่อง' },
      { term: 'Dunnage', meaning: 'วัสดุกันกระแทกเพื่อปกป้องสินค้าระหว่างการขนส่ง' },
      { term: 'Tamper-Evident Tape', meaning: 'เทปปิดกล่องที่เห็นร่องรอยทันทีหากมีการฉีกแกะ' },
    ],
    qcChecklist: [
      'ตรวจสภาพสินค้าไม่มีฝุ่น รอยเปื้อน หรือคราบน้ำมันก่อนบรรจุ',
      'ใส่วัสดุกันกระแทกให้เพียงพอ เขย่ากล่องแล้วสินค้าต้องไม่เลื่อนไปมา',
      'ติดใบกำกับสินค้า (Packing Slip) ใส่ในกล่องอย่างเรียบร้อย',
    ],
    safetyRules: [
      'จัดเก็บคัตเตอร์และเทปกาวในที่วางอุปกรณ์ทุกครั้งหลังใช้งานเสร็จ',
      'รักษาความสะอาดบริเวณโต๊ะแพ็คและเก็บเศษกล่องลงถังรีไซเคิลเสมอ',
    ],
    kpi: { label: 'ความแม่นยำในการแพ็ค', target: '≥ 99.9%', current: '99.95', unit: '%' },
    quiz: {
      question: 'เพราะเหตุใดการตรวจสอบสินค้าด้วยการยิงสแกน (Order Audit) ที่โต๊ะแพ็คจึงมีความสำคัญอย่างยิ่งต่อธุรกิจ?',
      options: [
        'ป้องกันการส่งของผิดชิ้น ขาด หรือเกินไปยังลูกค้า ซึ่งช่วยลดต้นทุนการส่งคืนสินค้า (RMA) และรักษาความพึงพอใจ',
        'เพื่อให้กล่องพัสดุมีน้ำหนักเพิ่มขึ้นตามเกณฑ์ขนส่ง',
        'เพื่อชะลอเวลาการจัดส่งให้ทันรอบถัดไป',
      ],
      correctIndex: 0,
      explanation:
        'Order Audit เป็นปราการด่านสำคัญที่สุดในการป้องกันคำร้องเรียน สินค้าส่งผิด หรือส่งขาด ลดปัญหาการคืนสินค้า (Return/RMA) ได้อย่างมหาศาล',
    },
    liveMetrics: { queueCount: 5, hourlyThroughput: 160, status: 'OPTIMAL' },
  },
  {
    id: 8,
    stepNumber: 8,
    phase: 'OUTBOUND',
    titleTh: '8. ชั่งน้ำหนัก & ติดฉลาก (Label)',
    titleEn: 'Weigh, Volumetric & Shipping Label',
    subtitle: 'เลื่อนกล่องเข้าแท่นชั่งและพิมพ์ใบปะหน้า',
    area: 'Station Weigh & Auto Print',
    description:
      'กล่องเลื่อนเข้าแท่นชั่งน้ำหนักดิจิทัล เจ้าหน้าที่ยิงสแกนบาร์โค้ด เซนเซอร์วัดมิติตัวกล่องเพื่อคำนวณ Volumetric เครื่องพิมพ์ความร้อนพิมพ์ใบปะหน้าขนส่ง (Waybill) ออกมาติดบนกล่องทันที',
    keyTerms: [
      { term: 'Volumetric Weight', meaning: 'น้ำหนักตามปริมาตรคำนวณจาก (กว้าง × ยาว × สูง) ÷ 5000' },
      { term: 'Waybill / Tracking No.', meaning: 'ฉลากบาร์โค้ดติดตามสถานะพัสดุสำหรับผู้ให้บริการขนส่ง' },
    ],
    qcChecklist: [
      'บาร์โค้ดใบปะหน้าต้องพิมพ์ชัดเจน ไม่เป็นเส้นขาด หรือหมึกเลือนราง',
      'ตำแหน่งฉลากต้องติดบนพื้นผิวเรียบด้านบนของกล่อง ไม่ทับรอยต่อรอยพับกล่อง',
    ],
    safetyRules: ['ตรวจสอบเครื่องชั่งน้ำหนักให้ผ่านการ Calibrate ทุกๆ 30 วัน'],
    kpi: { label: 'ความเร็วในการพิมพ์และติดฉลาก', target: '< 6 วินาที/กล่อง', current: '4.8', unit: 'วินาที' },
    quiz: {
      question: 'ข้อใดคือตำแหน่งที่ถูกต้องในการติดฉลากจัดส่ง (Shipping Label / Waybill) บนกล่องพัสดุ?',
      options: [
        'ติดทับบริเวณมุมกล่องที่มีรอยพับเพื่อให้ดูแน่นหนา',
        'ติดบนพื้นผิวเรียบด้านบนสุดของกล่อง หลีกเลี่ยงรอยต่อเทปกาว เพื่อให้สแกนเนอร์อ่านง่าย',
        'ติดไว้ใต้ก้นกล่องเพื่อความสวยงาม',
      ],
      correctIndex: 1,
      explanation:
        'ฉลากต้องติดบนพื้นผิวเรียบ ไม่ย่น ไม่ทับรอยพับหรือรอยเทป เพื่อให้สแกนเนอร์อัตโนมัติและคนขับรถขนส่งสแกนได้ทันทีโดยไม่ติดขัด',
    },
    liveMetrics: { queueCount: 3, hourlyThroughput: 280, status: 'OPTIMAL' },
  },
  {
    id: 9,
    stepNumber: 9,
    phase: 'OUTBOUND',
    titleTh: '9. คัดแยกปลายทาง (Sorting)',
    titleEn: 'Automated Routing & Sorting',
    subtitle: 'กล่องเลื่อนลงรางคัดแยกตามศูนย์กระจายสินค้า',
    area: 'Chute Sorting Area - Sorter Line',
    description:
      'กล่องพัสดุเลื่อนต่อตามสายพาน กล้องสแกนเนอร์อ่านบาร์โค้ดใบปะหน้า แขนผลักอัตโนมัติจะคัดแยกกล่องสไลด์ลงราง Chute ประจำปลายทาง เช่น สุราษฎร์ธานี หาดใหญ่ หรือกรุงเทพฯ',
    keyTerms: [
      { term: 'Sorter Chute', meaning: 'รางปล่อยพัสดุลงสู่กระสอบหรือกรงเหล็กตามรหัสปลายทาง' },
      { term: 'Hub Destination', meaning: 'ศูนย์กระจายสินค้าปลายทางของบริษัทขนส่ง' },
    ],
    qcChecklist: [
      'ตรวจสอบพัสดุลงตรงช่อง Hub ปลายทาง ไม่เกิดข้อผิดพลาด Miss-sort',
      'ดูแลไม่ให้กล่องตกลงมากระแทกกันในรางจนเกิดความเสียหาย',
    ],
    safetyRules: ['ห้ามยื่นศีรษะหรือมือเข้าไปในบริเวณกลไกแขนผลักคัดแยกพัสดุ'],
    kpi: { label: 'Mis-sort Rate', target: '< 0.05%', current: '0.01', unit: '%' },
    quiz: {
      question: 'หากระบบคัดแยกพัสดุอัตโนมัติอ่านบาร์โค้ดไม่ได้ (No-Read) กล่องพัสดุจะถูกนำส่งไปที่ใดตามขั้นตอน SOP?',
      options: [
        'ทิ้งกล่องลงถังขยะทันที',
        'ส่งเข้าช่องตรวจสอบพิเศษ (Reject/Manual Inspection Chute) เพื่อให้เจ้าหน้าที่ตรวจสอบด้วยมือ',
        'ส่งขึ้นรถคันใดก็ได้ที่ว่างอยู่',
      ],
      correctIndex: 1,
      explanation:
        'กล่องที่เกิด No-Read จะถูกส่งเข้า Reject Line เพื่อให้พนักงานทำการตรวจสอบคีย์รหัส หรือพิมพ์ฉลากใหม่ ป้องกันการส่งผิดปลายทาง',
    },
    liveMetrics: { queueCount: 4, hourlyThroughput: 380, status: 'OPTIMAL' },
  },
  {
    id: 10,
    stepNumber: 10,
    phase: 'OUTBOUND',
    titleTh: '10. โหลดขึ้นรถ & จัดส่ง (Dispatch)',
    titleEn: 'Outbound Loading & Fleet Dispatch',
    subtitle: 'พนักงานยกกล่องจากรางโหลดขึ้นรถบรรทุก',
    area: 'Dock 04 - Outbound Bay',
    description:
      'พนักงานประจำลานโหลดยกกล่องพัสดุจากปลายรางคัดแยก เดินโหลดเข้าสู่ตู้รถบรรทุก NEXUS Fleet ตามลำดับการส่งมอบ (LIFO) เจ้าหน้าที่ท่าเทียบตรวจนับซีลประตูท้ายรถ และกดยืนยันมอบงานในระบบ ePOD',
    keyTerms: [
      { term: 'LIFO Loading', meaning: 'สินค้าที่ส่งจุดแรก ต้องโหลดขึ้นรถเป็นลำดับสุดท้าย เพื่อเปิดหยิบง่าย' },
      { term: 'Manifest', meaning: 'ใบกำกับการขนส่งสินค้าแสดงรายการพัสดุทั้งหมดบนคันรถ' },
      { term: 'ePOD', meaning: 'Electronic Proof of Delivery (ระบบยืนยันการส่งมอบแบบดิจิทัล)' },
    ],
    qcChecklist: [
      'ตรวจสอบจำนวนกล่องบนรถบรรทุกครบถ้วนตรงตาม Manifest 100%',
      'จัดเรียงสินค้าหนักไว้ด้านล่าง สินค้าเปราะบางไว้ด้านบน ไม่วางซ้อนสูงเกินเกณฑ์',
      'ติดซีลนิรภัย (Security Seal) ที่บานประตูตู้รถและบันทึกหมายเลขลงระบบ',
    ],
    safetyRules: [
      'ห้ามกระโดดลงจากท้ายรถบรรทุก ให้ใช้บันไดข้าง Dock เสมอ',
      'ตรวจสอบไฟส่องสว่างภายในตู้รถบรรทุกก่อนเดินเข้าไปจัดเรียง',
    ],
    kpi: { label: 'On-time Dispatch Rate', target: '≥ 99.5%', current: '99.8', unit: '%' },
    quiz: {
      question: 'เหตุใดการโหลดสินค้าขึ้นรถขนส่งแบบ "LIFO (Last-In, First-Out)" จึงเป็นหลักปฏิบัติสากล?',
      options: [
        'เพื่อให้สินค้าที่ต้องส่งถึงมือลูกค้ารายแรก อยู่ใกล้ประตูท้ายรถที่สุด หยิบลงได้ทันที ไม่ต้องรื้อค้น',
        'เพื่อให้รถบรรทุกสามารถบรรทุกน้ำหนักได้มากกว่าปกติ',
        'เพื่อป้องกันไม่ให้คนขับรถทราบว่ามีสินค้าอะไรอยู่ข้างใน',
      ],
      correctIndex: 0,
      explanation:
        'LIFO (Last-In, First-Out) จัดให้สินค้าจุดส่งแรกถูกนำขึ้นรถเป็นชิ้นสุดท้าย ทำให้เปิดประตูตู้แล้วพบสินค้าทันที ประหยัดเวลาส่งมอบได้อย่างมหาศาล',
    },
    liveMetrics: { queueCount: 1, hourlyThroughput: 520, status: 'OPTIMAL' },
  },
];

type CameraState = {
  tx: number;
  tz: number;
  dist: number;
  rotX: number;
  rotY: number;
};

type CameraTransition = {
  from: CameraState;
  to: CameraState;
  startTime: number;
  duration: number;
};

// Helper: draw nice round rectangle on canvas
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface BinWorldTarget {
  shelfPos: [number, number, number];
  aislePos: [number, number, number];
  binCode: string;
  rackCode: string;
  bay: number;
  level: number;
}

const FIRST_BEAM_Y = 0.15;

// Calculate the precise 3D world coordinates for any bin in the warehouse
export function getBinWorldCoordinates(binCode: string, racks: RackConfig[]): BinWorldTarget {
  const norm = normalizeBinCode(binCode);
  for (const r of racks) {
    const bays = Math.max(1, Math.floor(Number(r.bays) || 1));
    const levels = Math.max(1, Math.floor(Number(r.levels) || 1));
    const bayW = r.bayWidth || 2.8;
    const totalRackLength = bays * bayW;
    const isFloor = r.type === 'CROSS_DOCK' || r.type === 'FLOOR_BLOCK';
    const layerH = isFloor ? Math.max(0.4, Number(r.levelHeight) || 0.6) : r.levelHeight || 1.8;
    const rot = r.rotationY || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    for (let lvl = 1; lvl <= levels; lvl++) {
      for (let bay = 1; bay <= bays; bay++) {
        const code = binCodeFor(r, bay, lvl);
        if (code && normalizeBinCode(code) === norm) {
          const bayOffset = -totalRackLength / 2 + (bay - 0.5) * bayW;
          const beamY = isFloor ? 0.08 + (lvl - 1) * layerH : FIRST_BEAM_Y + (lvl - 1) * layerH;
          const shelfY = beamY + layerH * 0.45;
          const sx = r.posX + bayOffset * cos;
          const sz = r.posZ + bayOffset * sin;

          const aisleDist = (r.rackDepth || 2.2) / 2 + 1.35;
          const ax = sx - sin * aisleDist;
          const az = sz + cos * aisleDist;

          return {
            shelfPos: [sx, shelfY, sz],
            aislePos: [ax, 0, az],
            binCode: code,
            rackCode: r.rackCode,
            bay,
            level: lvl,
          };
        }
      }
    }
  }

  // Fallback: Default to a representative bin in the first rack
  if (racks.length > 0) {
    const r = racks[0];
    const bays = Math.max(1, Math.floor(Number(r.bays) || 1));
    const bayW = r.bayWidth || 2.8;
    const rot = r.rotationY || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const bayIdx = Math.min(2, bays);
    const bayOffset = -((bays * bayW) / 2) + (bayIdx - 0.5) * bayW;
    const sx = r.posX + bayOffset * cos;
    const sz = r.posZ + bayOffset * sin;
    const aisleDist = (r.rackDepth || 2.2) / 2 + 1.35;
    return {
      shelfPos: [sx, 1.4, sz],
      aislePos: [sx - sin * aisleDist, 0, sz + cos * aisleDist],
      binCode: norm || binCodeFor(r, bayIdx, 1) || 'A-001',
      rackCode: r.rackCode,
      bay: bayIdx,
      level: 1,
    };
  }

  return {
    shelfPos: [-6, 1.6, -4],
    aislePos: [-6, 0, -2.0],
    binCode: norm || 'A-004',
    rackCode: 'LEFT A-D',
    bay: 4,
    level: 1,
  };
}

// Compact Non-Overlapping Industrial Floor Pad Stencil
function createFloorDecalMesh(station: ProcessStation, theme: 'light' | 'dark'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 128);
  const isLight = theme === 'light';

  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = station.phase === 'INBOUND' ? '#0284c7' : '#d97706';
  ctx.lineWidth = 5;
  drawRoundRect(ctx, 6, 6, 244, 116, 22);
  ctx.fill();
  ctx.stroke();

  // Number badge
  ctx.fillStyle = station.phase === 'INBOUND' ? '#0284c7' : '#d97706';
  ctx.beginPath();
  ctx.arc(44, 64, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(station.stepNumber), 44, 66);

  // Short title
  const shortTitle = station.titleTh.replace(/^\d+\.\s*/, '');
  ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(shortTitle.slice(0, 16), 84, 52);

  ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(station.area.split('-')[0].trim(), 84, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(2.2, 1.1);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(station.coords[0], 0.04, station.coords[2] + 1.15);
  mesh.userData = { isFloorDecal: true, stationId: station.id };
  return mesh;
}

// Rack Header Label Sign (Above Racks like Warehouse3DViewer)
function createRackHeaderSprite(rack: RackConfig): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.strokeStyle = rack.color || '#38bdf8';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 4, 4, 248, 56, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rack.rackCode, 128, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

// Single active floating callout sprite
function updateActiveCalloutSprite(sprite: THREE.Sprite, station: ProcessStation) {
  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 460, 112);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 10;

  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  drawRoundRect(ctx, 8, 8, 444, 96, 20);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Number circle
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(52, 56, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(station.stepNumber), 52, 58);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(station.titleTh, 100, 44);

  ctx.fillStyle = '#3b1c06';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(station.subtitle, 100, 76);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  sprite.material.map?.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  sprite.scale.set(4.1, 1.0, 1);
  sprite.position.set(station.coords[0], 3.1, station.coords[2]);
}

// Procedural Articulated 3D Human Worker Model
interface ArticulatedWorker {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  torso: THREE.Mesh;
  walkPhase: number;
}

function createDetailedWorker(
  role: 'INBOUND' | 'PICKER' | 'LOADER' | 'QC' | 'CONTROL' | 'PACKER' | 'SCALE' | 'DISPATCH',
  vestColorHex: number = 0x10b981
): ArticulatedWorker {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.5 });
  const vestMat = new THREE.MeshStandardMaterial({ color: vestColorHex, roughness: 0.35 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  // 1. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.32), vestMat);
  torso.position.set(0, 1.05, 0);
  torso.castShadow = true;
  root.add(torso);

  // Vest stripes
  const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.08, 0.33), stripeMat);
  stripe1.position.set(0, 1.1, 0);
  root.add(stripe1);

  // 2. Head & Helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
  head.position.set(0, 1.52, 0);
  root.add(head);

  const helmetDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    helmetMat
  );
  helmetDome.position.set(0, 1.58, 0);
  root.add(helmetDome);
  const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), helmetMat);
  helmetBrim.position.set(0, 1.58, 0.04);
  root.add(helmetBrim);

  // 3. Articulated Legs (pivots at hip Y = 0.72)
  const createLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.72, 0);

    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.2), pantsMat);
    legMesh.position.set(0, -0.34, 0);
    legMesh.castShadow = true;
    legPivot.add(legMesh);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.28), shoeMat);
    boot.position.set(0, -0.62, 0.04);
    legPivot.add(boot);

    root.add(legPivot);
    return legPivot;
  };

  const leftLeg = createLeg(-0.15);
  const rightLeg = createLeg(0.15);

  // 4. Articulated Arms (pivots at shoulder Y = 1.32)
  const createArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.32, 0);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.16), vestMat);
    sleeve.position.set(0, -0.19, 0);
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), skinMat);
    hand.position.set(0, -0.42, 0);
    armPivot.add(hand);

    root.add(armPivot);
    return armPivot;
  };

  const leftArm = createArm(-0.33);
  const rightArm = createArm(0.33);

  // Role accessories
  if (role === 'QC') {
    const clipboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.03, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    clipboard.position.set(0.15, 1.05, 0.3);
    clipboard.rotation.x = 0.35;
    root.add(clipboard);
  } else if (role === 'SCALE' || role === 'PICKER') {
    const pda = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.06, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b })
    );
    pda.position.set(0.25, 0.95, 0.25);
    pda.rotation.y = 0.2;
    root.add(pda);
  } else if (role === 'DISPATCH') {
    const manifest = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a })
    );
    manifest.position.set(-0.2, 1.05, 0.25);
    root.add(manifest);
  } else if (role === 'PACKER') {
    const tapeGun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.18, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    tapeGun.position.set(0.25, 0.98, 0.28);
    root.add(tapeGun);
  }

  return {
    root,
    torso,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    walkPhase: 0,
  };
}

// Procedural Walk & Smooth Turn Engine
function stepWorkerTowards(
  worker: ArticulatedWorker,
  targetX: number,
  targetZ: number,
  speed: number = 0.08,
  idleFacingY?: number
): boolean {
  const dx = targetX - worker.root.position.x;
  const dz = targetZ - worker.root.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist > 0.14) {
    worker.root.position.x += (dx / dist) * Math.min(speed, dist);
    worker.root.position.z += (dz / dist) * Math.min(speed, dist);

    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - worker.root.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    worker.root.rotation.y += diff * 0.18;

    // Stride locomotion
    worker.walkPhase += 0.24;
    const swing = Math.sin(worker.walkPhase) * 0.65;
    worker.leftLeg.rotation.x = swing;
    worker.rightLeg.rotation.x = -swing;
    worker.leftArm.rotation.x = -swing * 0.7;
    worker.rightArm.rotation.x = swing * 0.7;
    worker.torso.position.y = 1.05 + Math.abs(Math.sin(worker.walkPhase * 2)) * 0.04;
    return false;
  } else {
    // Smooth idle settle
    worker.leftLeg.rotation.x *= 0.8;
    worker.rightLeg.rotation.x *= 0.8;
    worker.leftArm.rotation.x *= 0.8;
    worker.rightArm.rotation.x *= 0.8;
    worker.torso.position.y = THREE.MathUtils.lerp(worker.torso.position.y, 1.05, 0.2);
    if (idleFacingY !== undefined) {
      let diff = idleFacingY - worker.root.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      worker.root.rotation.y += diff * 0.15;
    }
    return true;
  }
}

export default function WarehouseProcessSimulator3D({
  branchId = 'hq',
  defaultTheme = 'light',
}: {
  branchId?: string;
  defaultTheme?: 'light' | 'dark';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlayingTour, setIsPlayingTour] = useState(false);
  const [tourSpeed, setTourSpeed] = useState<1 | 2 | 5>(1);
  const [activeTab, setActiveTab] = useState<'sop' | 'live' | 'quiz'>('sop');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Light / Dark Theme Support (defaults to light for WMS 360)
  const [theme, setTheme] = useState<'light' | 'dark'>(defaultTheme);

  // Camera Mode: OVERVIEW keeps bird's eye view without jumping! FOCUS zooms into station.
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'FOCUS'>('OVERVIEW');
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  const [showActiveLabel, setShowActiveLabel] = useState(true);

  // Quiz interactive state
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  // Real Layout & Products & Extra Locations from WMS 360
  const [layout, setLayout] = useState<WarehouseLayout | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [extraLocations, setExtraLocations] = useState<ExtraLocation[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingLayout, setLoadingLayout] = useState(true);

  // Real Active Orders from /api/orders/status (or On-Hand Stock / Demo fallback)
  const [liveOrders, setLiveOrders] = useState<OutboundOrder[]>(DEFAULT_ACTIVE_ORDERS);
  const [orderSourceMode, setOrderSourceMode] = useState<'LIVE_ORDERS' | 'STOCK_SIM' | 'DEMO'>('DEMO');
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder>(DEFAULT_ACTIVE_ORDERS[0]);
  const [liveQueueStats, setLiveQueueStats] = useState<{
    pendingCount: number;
    activeCount: number;
    waitingCount: number;
    completedCount: number;
  }>({ pendingCount: 0, activeCount: 0, waitingCount: 0, completedCount: 0 });

  // Persistent AudioContext Ref to prevent browser AudioContext leak
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persistent Camera State Ref across scene rebuilds
  const persistentCamRef = useRef<CameraState | null>(null);

  // Fetch actual layout, branch products, extra locations, transactions, and real WMS orders
  const loadWarehouseData = useCallback(() => {
    setLoadingLayout(true);
    const bParam = encodeURIComponent(branchId || 'hq');
    Promise.all([
      fetch(getApiUrl(`/api/warehouse/layout?branchId=${bParam}`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(getApiUrl(`/api/products?branchId=${bParam}`))
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(getApiUrl(`/api/products/extra-locations?branchId=${bParam}`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(getApiUrl(`/api/transactions/recent?type=OUT&limit=2000&branchId=${bParam}`))
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(getApiUrl(`/api/orders/status?branchId=${bParam}`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(getApiUrl('/api/orders?limit=20'))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([layoutRes, prodsRes, extraRes, txRes, orderStatusRes, dbOrdersRes]) => {
        const prodsList: any[] = Array.isArray(prodsRes) ? prodsRes : [];
        const extrasList: ExtraLocation[] =
          extraRes?.success && Array.isArray(extraRes.rows) ? extraRes.rows : [];
        const txList: any[] = Array.isArray(txRes) ? txRes : [];

        if (layoutRes?.success && layoutRes.data) {
          setLayout(layoutRes.data);
        } else {
          setLayout(null);
        }
        setProducts(prodsList);
        setExtraLocations(extrasList);
        setTransactions(txList);

        // Compute effective per-bin stock rows so we can resolve any product's bin accurately
        const { rows: effectiveRows } = stockRowsWithExtraLocations(prodsList, extrasList);

        const resolveItemProductAndBin = (rawCodeOrName: string): {
          sku: string;
          skuName: string;
          binCode: string;
        } => {
          const key = String(rawCodeOrName || '').trim();
          const keyUpper = key.toUpperCase();
          const matchedProd = prodsList.find(
            (p: any) =>
              String(p.id || '').trim().toUpperCase() === keyUpper ||
              String(p.sku || '').trim().toUpperCase() === keyUpper ||
              String(p.name || '').trim().toUpperCase() === keyUpper ||
              String(p.name || '').trim().toUpperCase().includes(keyUpper)
          );

          if (matchedProd) {
            const prodSku = String(matchedProd.sku || matchedProd.id || matchedProd.name);
            const mainLoc = normalizeBinCode(matchedProd.location);
            if (mainLoc && mainLoc !== 'UNASSIGNED' && mainLoc !== '-') {
              return { sku: prodSku, skuName: String(matchedProd.name || prodSku), binCode: mainLoc };
            }
            const extraRow = effectiveRows.find((r) => r.sku === prodSku && r.quantity > 0 && r.binCode);
            if (extraRow?.binCode && extraRow.binCode !== 'UNASSIGNED') {
              return {
                sku: prodSku,
                skuName: String(matchedProd.name || prodSku),
                binCode: normalizeBinCode(extraRow.binCode),
              };
            }
            return { sku: prodSku, skuName: String(matchedProd.name || prodSku), binCode: 'A-001' };
          }

          // Fallback to first stocked bin in warehouse if item code not matched directly
          const firstStocked = effectiveRows.find(
            (r) => r.binCode && r.binCode !== 'UNASSIGNED' && r.quantity > 0
          );
          return {
            sku: key || 'SKU-ITEM',
            skuName: key || 'สินค้าใบสั่งจ่าย',
            binCode: firstStocked ? normalizeBinCode(firstStocked.binCode) : 'A-001',
          };
        };

        // Extract real orders from /api/orders/status (activeForm, waiting, pending)
        const pendingList = Array.isArray(orderStatusRes?.pending) ? orderStatusRes.pending : [];
        const waitingList = Array.isArray(orderStatusRes?.waiting) ? orderStatusRes.waiting : [];
        const completedList = Array.isArray(orderStatusRes?.completed) ? orderStatusRes.completed : [];
        const activeFormObj = orderStatusRes?.activeForm || null;

        setLiveQueueStats({
          pendingCount: pendingList.length,
          activeCount: activeFormObj ? 1 : 0,
          waitingCount: waitingList.length,
          completedCount: completedList.length,
        });

        const realMappedOrders: OutboundOrder[] = [];

        const pushJobAsOrder = (
          jobDocNum: string,
          customer: string,
          rawItems: any[],
          statusText: string,
          priority: 'EXPRESS' | 'URGENT' | 'STANDARD'
        ) => {
          const validItems: OutboundOrderItem[] = [];
          rawItems.forEach((it: any) => {
            const code = String(it.itemCode || it.sku || it.name || '').trim();
            if (!code) return;
            const resolved = resolveItemProductAndBin(code);
            const qtyNum = Math.max(1, Number(String(it.qty || '1').replace(/[^0-9.]/g, '')) || 1);
            validItems.push({
              sku: resolved.sku,
              skuName: resolved.skuName,
              binCode: resolved.binCode,
              qty: qtyNum,
            });
          });

          if (validItems.length === 0) return;
          const uniqueBins = Array.from(new Set(validItems.map((v) => v.binCode)));
          const totalQty = validItems.reduce((s, v) => s + v.qty, 0);
          const firstOrderNo = String(rawItems[0]?.orderNo || '').trim();

          realMappedOrders.push({
            orderId: firstOrderNo ? `${jobDocNum} (${firstOrderNo})` : jobDocNum,
            docNum: jobDocNum,
            customerName: customer || 'ลูกค้าคลังสินค้า',
            sku: validItems[0].sku,
            skuName:
              validItems.length > 1
                ? `${validItems[0].skuName} (+${validItems.length - 1} รายการ)`
                : validItems[0].skuName,
            binCode: validItems[0].binCode,
            allBins: uniqueBins,
            items: validItems,
            qty: totalQty,
            weightKg: Math.max(5, Math.round(totalQty * 2.2)),
            destination: customer || `สาขา ${branchId.toUpperCase()}`,
            statusLabel: statusText,
            priority,
          });
        };

        if (activeFormObj && Array.isArray(activeFormObj.items) && activeFormObj.items.length > 0) {
          pushJobAsOrder(
            String(activeFormObj.docNum || 'ACTIVE'),
            String(activeFormObj.customer || 'ลูกค้ากำลังรับบริการ'),
            activeFormObj.items,
            String(activeFormObj.status || 'กำลังดำเนินการ'),
            'EXPRESS'
          );
        }

        waitingList.forEach((w: any) => {
          if (Array.isArray(w.items) && w.items.length > 0) {
            pushJobAsOrder(
              String(w.docNum || 'WAIT'),
              String(w.customer || 'ลูกค้ารอดำเนินการ'),
              w.items,
              String(w.status || 'รอดำเนินการ'),
              'URGENT'
            );
          }
        });

        pendingList.forEach((p: any) => {
          if (Array.isArray(p.items) && p.items.length > 0) {
            pushJobAsOrder(
              String(p.id || p.name || 'RT'),
              String(p.customer || 'คิวรอจัด Roll Tag'),
              p.items,
              'รอจัด Roll Tag',
              'STANDARD'
            );
          }
        });

        // Also check direct database orders from /api/orders (NEXUS-WMS)
        const rawDbOrders = Array.isArray(dbOrdersRes?.orders)
          ? dbOrdersRes.orders
          : Array.isArray(dbOrdersRes)
          ? dbOrdersRes
          : [];
        rawDbOrders.forEach((o: any) => {
          if (Array.isArray(o.items) && o.items.length > 0) {
            pushJobAsOrder(
              String(o.orderNo || o.id || 'SO'),
              String(o.customerName || o.shipAddress || 'ลูกค้าคลังสินค้า'),
              o.items,
              String(o.status || 'Active'),
              o.priority === 'URGENT' ? 'URGENT' : o.priority === 'EXPRESS' ? 'EXPRESS' : 'STANDARD'
            );
          }
        });

        if (realMappedOrders.length > 0) {
          const topOrders = realMappedOrders.slice(0, 6);
          setLiveOrders(topOrders);
          setOrderSourceMode('LIVE_ORDERS');
          setSelectedOrder(topOrders[0]);
        } else {
          // 2. Fallback: Synthesize from actual branch products that have real stock & assigned location
          const stockedProds = prodsList.filter((p: any) => {
            const loc = normalizeBinCode(p.location);
            return loc && loc !== 'UNASSIGNED' && loc !== '-' && Number(p.stock) > 0;
          });

          if (stockedProds.length > 0) {
            const stockSimOrders: OutboundOrder[] = stockedProds.slice(0, 5).map((p: any, idx: number) => {
              const loc = normalizeBinCode(p.location);
              const simQty = Math.max(1, Math.min(Number(p.stock) || 1, 15));
              return {
                orderId: `SIM-${String(p.id || idx + 1)}`,
                customerName: `จำลองเบิกจ่ายจริง (${branchId.toUpperCase()})`,
                sku: String(p.sku || p.id || p.name),
                skuName: String(p.name),
                binCode: loc,
                allBins: [loc],
                items: [
                  {
                    sku: String(p.sku || p.id || p.name),
                    skuName: String(p.name),
                    binCode: loc,
                    qty: simQty,
                  },
                ],
                qty: simQty,
                weightKg: Math.max(5, Math.round(simQty * 2.2)),
                destination: `คลัง ${branchId.toUpperCase()} -> ลูกค้า`,
                statusLabel: `สต็อกคงเหลือ ${Number(p.stock).toLocaleString()} ${p.unit || 'ชิ้น'}`,
                priority: idx === 0 ? 'EXPRESS' : idx === 1 ? 'URGENT' : 'STANDARD',
              };
            });
            setLiveOrders(stockSimOrders);
            setOrderSourceMode('STOCK_SIM');
            setSelectedOrder(stockSimOrders[0]);
          } else {
            setLiveOrders(DEFAULT_ACTIVE_ORDERS);
            setOrderSourceMode('DEMO');
            setSelectedOrder(DEFAULT_ACTIVE_ORDERS[0]);
          }
        }
      })
      .finally(() => {
        setLoadingLayout(false);
      });
  }, [branchId]);

  useEffect(() => {
    loadWarehouseData();
  }, [loadWarehouseData]);

  // Build exact WarehouseMapData using shared lib/warehouseLayoutMap (matches /inventory/map 100%)
  const warehouseMapData = useMemo(() => {
    const racks = layout?.racks || [];
    const { rows: effectiveStockRows } = stockRowsWithExtraLocations(products, extraLocations);
    return buildWarehouseMap(racks, effectiveStockRows, products, transactions);
  }, [layout, products, extraLocations, transactions]);

  const binDataMap: Map<string, MapBin> = warehouseMapData.binIndex;

  // Resolve all bin coordinates for the selected order (supports multi-bin picking!)
  const orderBinTargets = useMemo<BinWorldTarget[]>(() => {
    const racks = layout?.racks || [];
    const bins =
      selectedOrder.allBins && selectedOrder.allBins.length > 0
        ? selectedOrder.allBins
        : [selectedOrder.binCode];
    return bins.map((code) => getBinWorldCoordinates(code, racks));
  }, [selectedOrder, layout]);

  const primaryOrderBinTarget = orderBinTargets[0] || getBinWorldCoordinates(selectedOrder.binCode, layout?.racks || []);

  // Compute collision-free warehouse boundaries and dynamic station coordinates
  const { floorWidth, floorLength, conveyorZ, dockZ, stations } = useMemo(() => {
    const rawRacks = layout?.racks || [];
    let minX = -14;
    let maxX = 14;
    let minZ = -14;
    let maxRackZ = -2;

    if (rawRacks.length > 0) {
      minX = Infinity;
      maxX = -Infinity;
      minZ = Infinity;
      maxRackZ = -Infinity;
      rawRacks.forEach((r) => {
        const bays = Math.max(1, Number(r.bays) || 1);
        const bayW = Number(r.bayWidth) || 2.5;
        const depth = Number(r.rackDepth) || 2.0;
        const rot = Number(r.rotationY) || 0;
        const halfSpanX = Math.abs((bays * bayW * Math.cos(rot)) / 2) + Math.abs((depth * Math.sin(rot)) / 2);
        const halfSpanZ = Math.abs((bays * bayW * Math.sin(rot)) / 2) + Math.abs((depth * Math.cos(rot)) / 2);

        minX = Math.min(minX, r.posX - halfSpanX);
        maxX = Math.max(maxX, r.posX + halfSpanX);
        minZ = Math.min(minZ, r.posZ - halfSpanZ);
        maxRackZ = Math.max(maxRackZ, r.posZ + halfSpanZ);
      });
    }

    // Place operational front corridor strictly in front of all racks so nothing ever collides
    const safeFrontZ = Math.max(3.5, maxRackZ + 4.8);
    const safeConveyorZ = safeFrontZ + 4.2;
    const safeDockZ = safeConveyorZ + 6.5;

    const neededWidth = Math.max(layout?.widthM || 38, (maxX - minX) + 18, 44);
    const maxAbsZ = Math.max(Math.abs(minZ - 5), Math.abs(safeDockZ + 5));
    const neededLength = Math.max(layout?.lengthM || 44, maxAbsZ * 2, 48);

    const inDockX = -neededWidth / 2 + 5.5;
    const outDockX = neededWidth / 2 - 5.5;

    // Pick a stocked or first rack bin for Step 3 Putaway target
    const putawayTarget =
      rawRacks.length > 0
        ? getBinWorldCoordinates(binCodeFor(rawRacks[0], 1, 1) || 'A-001', rawRacks)
        : { shelfPos: [-6, 1.8, -4] as [number, number, number], aislePos: [-6, 0, -2.2] as [number, number, number] };

    // Real-time queue adjustments from liveQueueStats
    const totalActiveOrders =
      liveQueueStats.pendingCount + liveQueueStats.activeCount + liveQueueStats.waitingCount;

    const dynamicStations: ProcessStation[] = BASE_PROCESS_STATIONS.map((base) => {
      let coords: [number, number, number];
      let customQueue = base.liveMetrics.queueCount;
      switch (base.id) {
        case 1:
          coords = [inDockX, 1.2, safeDockZ];
          break;
        case 2:
          coords = [inDockX + 7.5, 1.2, safeConveyorZ];
          break;
        case 3:
          coords = [putawayTarget.aislePos[0], putawayTarget.shelfPos[1], putawayTarget.aislePos[2]];
          break;
        case 4:
          coords = [-6.5, 1.4, safeFrontZ];
          if (totalActiveOrders > 0) customQueue = totalActiveOrders;
          break;
        case 5:
          coords = [
            primaryOrderBinTarget.aislePos[0],
            primaryOrderBinTarget.shelfPos[1],
            primaryOrderBinTarget.aislePos[2],
          ];
          if (liveQueueStats.activeCount + liveQueueStats.waitingCount > 0) {
            customQueue = liveQueueStats.activeCount + liveQueueStats.waitingCount;
          }
          break;
        case 6:
          coords = [-4.0, 1.2, safeConveyorZ];
          break;
        case 7:
          coords = [3.0, 1.2, safeConveyorZ];
          break;
        case 8:
          coords = [9.5, 1.2, safeConveyorZ];
          break;
        case 9:
          coords = [15.5, 1.2, safeConveyorZ - 1.5];
          break;
        case 10:
          coords = [outDockX, 1.2, safeDockZ];
          if (liveQueueStats.completedCount > 0) customQueue = liveQueueStats.completedCount;
          break;
        default:
          coords = [0, 1.2, 0];
      }

      return {
        ...base,
        coords,
        liveMetrics: {
          ...base.liveMetrics,
          queueCount: customQueue,
        },
      };
    });

    return {
      floorWidth: neededWidth,
      floorLength: neededLength,
      conveyorZ: safeConveyorZ,
      dockZ: safeDockZ,
      stations: dynamicStations,
    };
  }, [layout, primaryOrderBinTarget, liveQueueStats]);

  const currentStation = stations[currentStepIdx] || stations[0];

  // Live Refs so the 60fps requestAnimationFrame loop reads fresh state WITHOUT rebuilding the WebGL scene!
  const currentStepIdxRef = useRef(currentStepIdx);
  currentStepIdxRef.current = currentStepIdx;

  const isAutoRotateRef = useRef(isAutoRotate);
  isAutoRotateRef.current = isAutoRotate;

  const tourSpeedRef = useRef(tourSpeed);
  tourSpeedRef.current = tourSpeed;

  const showActiveLabelRef = useRef(showActiveLabel);
  showActiveLabelRef.current = showActiveLabel;

  const stationsRef = useRef(stations);
  stationsRef.current = stations;

  const orderBinTargetsRef = useRef(orderBinTargets);
  orderBinTargetsRef.current = orderBinTargets;

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const stepEnteredTimeRef = useRef<number>(0);

  // Three.js runtime references
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    inboundPalletGroup: THREE.Group;
    outboundParcelGroup: THREE.Group;
    activeCalloutSprite: THREE.Sprite;
    stationPins: THREE.Group[];
    stationBeacons: THREE.Mesh[];
    conveyorRollers: THREE.Mesh[];
    shelfHighlightBoxes: THREE.Mesh[];
    // Moving Actors
    inboundHandler: ArticulatedWorker;
    palletJackMesh: THREE.Group;
    forkliftGroup: THREE.Group;
    forkliftCarriage: THREE.Group;
    orderPicker: ArticulatedWorker;
    pickCartMesh: THREE.Group;
    outboundLoader: ArticulatedWorker;
    // Stationed Staff
    stationedStaff: ArticulatedWorker[];
    // Camera
    cam: CameraState;
    camTransition: CameraTransition | null;
    applyCamera: () => void;
  } | null>(null);

  // Web Audio chime synthesizer (reuses single AudioContext instance)
  const playChime = useCallback(
    (type: 'step' | 'correct' | 'wrong' | 'beep' | 'pick') => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'step') {
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        } else if (type === 'beep') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          gain.gain.setValueAtTime(0.09, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        } else if (type === 'pick') {
          osc.frequency.setValueAtTime(520, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(780, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.22);
          osc.start();
          osc.stop(ctx.currentTime + 0.22);
        } else if (type === 'correct') {
          osc.frequency.setValueAtTime(523.25, ctx.currentTime);
          osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.32);
          osc.start();
          osc.stop(ctx.currentTime + 0.32);
        } else if (type === 'wrong') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.22);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }
      } catch {}
    },
    [soundEnabled]
  );

  // Station navigation handler (does NOT destroy/recreate Three.js scene!)
  const goToStation = useCallback(
    (idx: number, forceCameraMove = false) => {
      const currentStations = stationsRef.current;
      const nextIdx = Math.max(0, Math.min(currentStations.length - 1, idx));
      setCurrentStepIdx(nextIdx);
      currentStepIdxRef.current = nextIdx;
      stepEnteredTimeRef.current = performance.now();
      setSelectedQuizAnswer(null);

      if (nextIdx === 1 || nextIdx === 7) {
        playChime('beep');
      } else if (nextIdx === 4) {
        playChime('pick');
      } else {
        playChime('step');
      }

      if (!threeRef.current) return;
      const t = threeRef.current;
      const targetStation = currentStations[nextIdx];

      updateActiveCalloutSprite(t.activeCalloutSprite, targetStation);

      t.stationPins.forEach((pin, i) => {
        const isAct = i === nextIdx;
        const sphere = pin.children[1] as THREE.Mesh;
        if (sphere && sphere.material) {
          (sphere.material as THREE.MeshStandardMaterial).color.setHex(isAct ? 0xf59e0b : 0x0284c7);
          (sphere.material as THREE.MeshStandardMaterial).emissive.setHex(isAct ? 0xd97706 : 0x0369a1);
        }
        pin.scale.setScalar(isAct ? 1.25 : 1.0);
      });

      if (viewModeRef.current === 'OVERVIEW' && !forceCameraMove) {
        return;
      }

      const targetCam: CameraState = {
        tx: targetStation.coords[0],
        tz: targetStation.coords[2],
        dist: 24,
        rotX: 0.58,
        rotY: t.cam.rotY,
      };

      t.camTransition = {
        from: { ...t.cam },
        to: targetCam,
        startTime: performance.now(),
        duration: 850,
      };
    },
    [playChime]
  );

  const goToStationRef = useRef(goToStation);
  goToStationRef.current = goToStation;

  // Keep active callout & pin positions synced whenever `stations` or `currentStepIdx` updates
  useEffect(() => {
    if (!threeRef.current) return;
    const t = threeRef.current;
    const targetStation = stations[currentStepIdx] || stations[0];
    if (targetStation) {
      updateActiveCalloutSprite(t.activeCalloutSprite, targetStation);
    }
    t.stationPins.forEach((pin, i) => {
      const s = stations[i];
      if (s) pin.position.set(s.coords[0], 0, s.coords[2]);
    });
    t.stationBeacons.forEach((beacon, i) => {
      const s = stations[i];
      if (s) beacon.position.set(s.coords[0], 0.03, s.coords[2]);
    });
  }, [stations, currentStepIdx]);

  // Camera presets
  const setCameraOverview = useCallback(() => {
    setViewMode('OVERVIEW');
    viewModeRef.current = 'OVERVIEW';
    if (!threeRef.current) return;
    const t = threeRef.current;
    const overviewDist = Math.max(52, Math.max(floorWidth, floorLength) * 1.12);

    t.camTransition = {
      from: { ...t.cam },
      to: {
        tx: 0,
        tz: 2,
        dist: overviewDist,
        rotX: 0.72,
        rotY: 0.45,
      },
      startTime: performance.now(),
      duration: 800,
    };
  }, [floorWidth, floorLength]);

  const setCameraFocus = useCallback(() => {
    setViewMode('FOCUS');
    viewModeRef.current = 'FOCUS';
    if (!threeRef.current) return;
    const t = threeRef.current;
    const targetStation = stationsRef.current[currentStepIdxRef.current] || stationsRef.current[0];

    t.camTransition = {
      from: { ...t.cam },
      to: {
        tx: targetStation.coords[0],
        tz: targetStation.coords[2],
        dist: 22,
        rotX: 0.58,
        rotY: t.cam.rotY,
      },
      startTime: performance.now(),
      duration: 800,
    };
  }, []);

  const resetCamera = useCallback(() => {
    if (!threeRef.current) return;
    const t = threeRef.current;
    const overviewDist = Math.max(52, Math.max(floorWidth, floorLength) * 1.12);

    t.camTransition = {
      from: { ...t.cam },
      to: {
        tx: 0,
        tz: 2,
        dist: overviewDist,
        rotX: 0.72,
        rotY: 0.45,
      },
      startTime: performance.now(),
      duration: 600,
    };
  }, [floorWidth, floorLength]);

  // Handle live order selection
  const handleSelectOrder = useCallback(
    (order: OutboundOrder) => {
      setSelectedOrder(order);
      playChime('pick');
      // Jump to Step 5 (Picking) so user immediately sees the worker walk to this order's bin
      goToStation(4, viewModeRef.current === 'FOCUS');
    },
    [goToStation, playChime]
  );

  // Auto Tour playback loop (Side-effect free — no state updater side effects!)
  useEffect(() => {
    if (!isPlayingTour) return;

    const stepInterval = 4500 / tourSpeed;
    const interval = setInterval(() => {
      const prev = currentStepIdxRef.current;
      const total = stationsRef.current.length;
      if (prev >= total - 1) {
        setIsPlayingTour(false);
        goToStationRef.current(0, viewModeRef.current === 'FOCUS');
      } else {
        goToStationRef.current(prev + 1, viewModeRef.current === 'FOCUS');
      }
    }, stepInterval);

    return () => clearInterval(interval);
  }, [isPlayingTour, tourSpeed]);

  // Three.js 3D Virtual Facility Initialization (Rebuilds ONLY when layout, binDataMap, or theme changes!)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    const isLight = theme === 'light';
    const currentStations = stationsRef.current;

    // 1. Scene
    const scene = new THREE.Scene();
    const bgColor = isLight ? 0xf1f5f9 : 0x0f172a;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, isLight ? 0.006 : 0.011);

    // 2. Camera & Orbit Parameters (Preserve camera position if user already rotated/zoomed)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 350);
    const overviewDist = Math.max(52, Math.max(floorWidth, floorLength) * 1.12);

    const cam: CameraState = persistentCamRef.current
      ? { ...persistentCamRef.current }
      : {
          tx: 0,
          tz: 2,
          dist: overviewDist,
          rotX: 0.72,
          rotY: 0.45,
        };

    const applyCamera = () => {
      cam.rotX = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, cam.rotX));
      cam.dist = Math.max(8, Math.min(160, cam.dist));

      const cx = cam.tx + cam.dist * Math.sin(cam.rotY) * Math.cos(cam.rotX);
      const cy = cam.dist * Math.sin(cam.rotX);
      const cz = cam.tz + cam.dist * Math.cos(cam.rotY) * Math.cos(cam.rotX);

      camera.position.set(cx, cy, cz);
      camera.lookAt(cam.tx, 0.8, cam.tz);
      persistentCamRef.current = { ...cam };
    };
    applyCamera();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLight ? 1.25 : 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. BRIGHT INDUSTRIAL WAREHOUSE LIGHTING RIG
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 1.25 : 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      0xffffff,
      isLight ? 0x94a3b8 : 0x334155,
      isLight ? 0.85 : 0.6
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, isLight ? 1.9 : 1.5);
    sunLight.position.set(24, 48, 24);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 180;
    const shadowBound = Math.max(floorWidth, floorLength) * 0.72;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, isLight ? 0.85 : 0.55);
    fillLight.position.set(-24, 28, -24);
    scene.add(fillLight);

    const createHighBayLight = (x: number, y: number, z: number) => {
      const p = new THREE.PointLight(0xffffff, isLight ? 1.2 : 0.9, 50, 1.2);
      p.position.set(x, y, z);
      scene.add(p);
    };
    createHighBayLight(0, 15, -6);
    createHighBayLight(0, 15, conveyorZ);
    createHighBayLight(-floorWidth / 3, 14, dockZ);
    createHighBayLight(floorWidth / 3, 14, dockZ);

    // 5. Floor & Markings
    const floorGeo = new THREE.PlaneGeometry(floorWidth, floorLength);
    const floorMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xe2e8f0 : 0x1e293b,
      roughness: isLight ? 0.65 : 0.75,
      metalness: isLight ? 0.1 : 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(
      Math.max(floorWidth, floorLength),
      Math.round(Math.max(floorWidth, floorLength) / 2),
      isLight ? 0x94a3b8 : 0x475569,
      isLight ? 0xcbd5e1 : 0x334155
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Perimeter boundary line
    const borderMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
    const borderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-floorWidth / 2 + 1.5, 0.04, -floorLength / 2 + 1.5),
      new THREE.Vector3(floorWidth / 2 - 1.5, 0.04, -floorLength / 2 + 1.5),
      new THREE.Vector3(floorWidth / 2 - 1.5, 0.04, floorLength / 2 - 1.5),
      new THREE.Vector3(-floorWidth / 2 + 1.5, 0.04, floorLength / 2 - 1.5),
      new THREE.Vector3(-floorWidth / 2 + 1.5, 0.04, -floorLength / 2 + 1.5),
    ]);
    const perimeterLine = new THREE.Line(borderGeo, borderMat);
    scene.add(perimeterLine);

    // Yellow Pedestrian Safety Walkways
    const walkwayMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: isLight ? 0.42 : 0.28,
    });
    const makeWalkway = (x: number, z: number, w: number, l: number) => {
      const g = new THREE.PlaneGeometry(w, l);
      const m = new THREE.Mesh(g, walkwayMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.02, z);
      scene.add(m);
    };
    makeWalkway(0, conveyorZ - 3.2, floorWidth - 10, 1.8);
    makeWalkway(3.5, conveyorZ + 2.2, 24, 1.6);

    // 6. Walls & Dock Doors
    const wallColor = isLight ? 0x94a3b8 : 0x334155;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.8 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(floorWidth, 8, 0.8), wallMat);
    backWall.position.set(0, 4, -floorLength / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, floorLength), wallMat);
    leftWall.position.set(-floorWidth / 2, 4, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, floorLength), wallMat);
    rightWall.position.set(floorWidth / 2, 4, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const inDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 5.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    inDoor.position.set(-floorWidth / 2 + 0.4, 2.75, dockZ);
    scene.add(inDoor);

    const outDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 5.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4 })
    );
    outDoor.position.set(floorWidth / 2 - 0.4, 2.75, dockZ);
    scene.add(outDoor);

    // 7. Transport Trucks (NEXUS Fleet)
    const createTruck = (x: number, z: number, rotY: number, colorHex: number) => {
      const truck = new THREE.Group();
      const cabMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 2.6), cabMat);
      cab.position.set(0, 1.8, 0);
      cab.castShadow = true;
      truck.add(cab);

      const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 2.3), glassMat);
      glass.position.set(1.61, 2.2, 0);
      truck.add(glass);

      const cargoMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.6, 2.8), cargoMat);
      cargo.position.set(-4.9, 2.2, 0);
      cargo.castShadow = true;
      cargo.receiveShadow = true;
      truck.add(cargo);

      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
      [-1.2, -3.8, -6.8].forEach((wx) => {
        const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.35, 16), wheelMat);
        w1.rotation.x = Math.PI / 2;
        w1.position.set(wx, 0.6, 1.35);
        w1.castShadow = true;
        truck.add(w1);
        const w2 = w1.clone();
        w2.position.z = -1.35;
        truck.add(w2);
      });

      truck.position.set(x, 0, z);
      truck.rotation.y = rotY;
      scene.add(truck);
      return truck;
    };

    createTruck(-floorWidth / 2 - 4.5, dockZ, 0, 0xf59e0b);
    createTruck(floorWidth / 2 + 4.5, dockZ, Math.PI, 0x10b981);

    // 8. Accurate Racks & Floor Blocks (Matches Warehouse3DViewer 100%)
    const steelPostMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x334155 : 0x1e293b,
      metalness: 0.75,
      roughness: 0.3,
    });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.5, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
    const stockOkMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.55 });
    const stockLowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
    const emptySlotMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x94a3b8 : 0x475569,
      roughness: 0.5,
      transparent: true,
      opacity: isLight ? 0.16 : 0.22,
      depthWrite: false,
    });

    const rawRacks = layout?.racks || [];

    const buildFullRack = (rack: RackConfig) => {
      const rackGroup = new THREE.Group();
      rackGroup.position.set(rack.posX, 0, rack.posZ);
      rackGroup.rotation.y = rack.rotationY || 0;

      const bays = Math.max(1, Math.floor(Number(rack.bays) || 1));
      const levels = Math.max(1, Math.floor(Number(rack.levels) || 1));
      const bayW = Number(rack.bayWidth) || 2.8;
      const depth = Number(rack.rackDepth) || 2.2;
      const totalRackLength = bays * bayW;
      const isFloor = rack.type === 'CROSS_DOCK' || rack.type === 'FLOOR_BLOCK';
      const usePallet = isFloor ? rack.palletMode !== 'NON_PALLET' : rack.palletMode === 'PALLET';
      const layerH = isFloor
        ? Math.max(0.4, Number(rack.levelHeight) || 0.6)
        : Number(rack.levelHeight) || 1.8;
      const totalRackHeight = isFloor ? levels * layerH : FIRST_BEAM_Y + levels * layerH + 0.25;

      if (isFloor) {
        // Painted floor staging zone + border
        const padGeo = new THREE.PlaneGeometry(totalRackLength, depth);
        const padMat = new THREE.MeshStandardMaterial({
          color:
            rack.type === 'CROSS_DOCK'
              ? isLight
                ? 0xfef3c7
                : 0x241d08
              : isLight
              ? 0xe0f2fe
              : 0x0f1c24,
          roughness: 0.9,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.set(0, 0.02, 0);
        padMesh.receiveShadow = true;
        rackGroup.add(padMesh);

        const zoneBorder = new THREE.LineSegments(
          new THREE.EdgesGeometry(padGeo),
          new THREE.LineBasicMaterial({ color: rack.type === 'CROSS_DOCK' ? 0xfacc15 : 0x0284c7 })
        );
        zoneBorder.rotation.x = -Math.PI / 2;
        zoneBorder.position.set(0, 0.03, 0);
        rackGroup.add(zoneBorder);
      } else {
        // Vertical steel uprights & cross braces
        const postGeo = new THREE.BoxGeometry(0.1, totalRackHeight, 0.1);
        const braceGeo = new THREE.BoxGeometry(0.05, 0.05, Math.max(0.1, depth - 0.1));
        for (let b = 0; b <= bays; b++) {
          const xPos = -totalRackLength / 2 + b * bayW;
          [-depth / 2, depth / 2].forEach((zPos) => {
            const post = new THREE.Mesh(postGeo, steelPostMat);
            post.position.set(xPos, totalRackHeight / 2, zPos);
            post.castShadow = true;
            rackGroup.add(post);
          });
          for (let lvl = 1; lvl <= levels; lvl++) {
            const brace = new THREE.Mesh(braceGeo, steelPostMat);
            brace.position.set(xPos, FIRST_BEAM_Y + (lvl - 0.5) * layerH, 0);
            rackGroup.add(brace);
          }
        }
      }

      // Multi-level beams & per-slot stock boxes (supports multi-level FLOOR_BLOCK too!)
      const beamGeo = new THREE.BoxGeometry(totalRackLength, 0.08, 0.08);
      for (let lvl = 1; lvl <= levels; lvl++) {
        const beamY = isFloor ? 0.06 + (lvl - 1) * layerH : FIRST_BEAM_Y + (lvl - 1) * layerH;

        if (!isFloor) {
          [-depth / 2, depth / 2].forEach((zPos) => {
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(0, beamY, zPos);
            rackGroup.add(beam);
          });

          const deck = new THREE.Mesh(
            new THREE.BoxGeometry(totalRackLength - 0.06, 0.03, Math.max(0.1, depth - 0.08)),
            woodMat
          );
          deck.position.set(0, beamY + 0.03, 0);
          deck.receiveShadow = true;
          rackGroup.add(deck);
        }

        for (let bay = 1; bay <= bays; bay++) {
          const binCode = binCodeFor(rack, bay, lvl);
          if (!binCode) continue;

          const binData = binDataMap.get(normalizeBinCode(binCode));
          const hasStock = !!(binData && binData.totalStock > 0);
          const xPos = -totalRackLength / 2 + (bay - 0.5) * bayW;

          const palletH = usePallet && hasStock && (!isFloor || lvl === 1) ? 0.1 : 0;
          if (palletH > 0) {
            const pallet = new THREE.Mesh(
              new THREE.BoxGeometry(bayW * 0.84, palletH, depth * 0.84),
              woodMat
            );
            pallet.position.set(xPos, beamY + palletH / 2 + 0.02, 0);
            pallet.receiveShadow = true;
            rackGroup.add(pallet);
          }

          const boxW = bayW * 0.82;
          const boxH = Math.max(0.22, layerH - 0.18 - palletH);
          const boxD = depth * 0.82;

          if (hasStock) {
            const mat = binData.status === 'LOW_STOCK' ? stockLowMat : stockOkMat;
            const stockBox = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), mat);
            stockBox.position.set(xPos, beamY + 0.04 + palletH + boxH / 2, 0);
            stockBox.castShadow = true;
            stockBox.receiveShadow = true;
            rackGroup.add(stockBox);
          } else {
            const emptyBox = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), emptySlotMat);
            emptyBox.position.set(xPos, beamY + 0.04 + boxH / 2, 0);
            rackGroup.add(emptyBox);
          }
        }
      }

      // Rack Header Sign above rack
      const headerSprite = createRackHeaderSprite(rack);
      headerSprite.position.set(0, totalRackHeight + 0.75, 0);
      rackGroup.add(headerSprite);

      scene.add(rackGroup);
    };

    if (rawRacks.length > 0) {
      rawRacks.forEach(buildFullRack);
    } else {
      buildFullRack({
        rackCode: 'LEFT A-D',
        zoneCode: 'A',
        type: 'RACK',
        posX: -9,
        posZ: -5,
        rotationY: 0,
        bays: 4,
        levels: 3,
        bayWidth: 2.8,
        levelHeight: 1.8,
        rackDepth: 2.2,
      });
      buildFullRack({
        rackCode: 'BHD E-H',
        zoneCode: 'B',
        type: 'RACK',
        posX: 0,
        posZ: -10,
        rotationY: 0,
        bays: 4,
        levels: 3,
        bayWidth: 2.8,
        levelHeight: 1.8,
        rackDepth: 2.2,
      });
      buildFullRack({
        rackCode: 'RIGHT I-L',
        zoneCode: 'C',
        type: 'RACK',
        posX: 9,
        posZ: -5,
        rotationY: 0,
        bays: 4,
        levels: 3,
        bayWidth: 2.8,
        levelHeight: 1.8,
        rackDepth: 2.2,
      });
    }

    // Pool of up to 6 Shelf Highlight Wireframe Boxes (for multi-bin orders!)
    const shelfHighlightBoxes: THREE.Mesh[] = [];
    const highlightGeo = new THREE.BoxGeometry(2.2, 1.0, 1.8);
    for (let i = 0; i < 6; i++) {
      const highlightMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xf59e0b : 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
      });
      const box = new THREE.Mesh(highlightGeo, highlightMat);
      box.visible = false;
      scene.add(box);
      shelfHighlightBoxes.push(box);
    }

    // 9. Central Control Tower Desk (Station 4)
    const deskGroup = new THREE.Group();
    const deskMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x475569 : 0x334155,
      roughness: 0.5,
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 1.3), deskMat);
    desk.position.set(currentStations[3].coords[0], 0.45, currentStations[3].coords[2]);
    desk.castShadow = true;
    deskGroup.add(desk);

    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.08), screenMat);
    screen.position.set(currentStations[3].coords[0], 1.22, currentStations[3].coords[2] + 0.25);
    deskGroup.add(screen);
    scene.add(deskGroup);

    // 10. High-Fidelity Conveyor System with Rotating Metallic Rollers (Stations 6, 7, 8, 9)
    const conveyorFrameMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x475569 : 0x1e293b,
      metalness: 0.85,
      roughness: 0.3,
    });
    const rollerMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      metalness: 0.95,
      roughness: 0.15,
    });

    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 0.08), conveyorFrameMat);
    rail1.position.set(5.5, 0.9, conveyorZ - 0.55);
    scene.add(rail1);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 0.08), conveyorFrameMat);
    rail2.position.set(5.5, 0.9, conveyorZ + 0.55);
    scene.add(rail2);

    [-4.5, 0, 5, 10, 15].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), conveyorFrameMat);
      leg.position.set(lx, 0.45, conveyorZ - 0.5);
      scene.add(leg);
      const leg2 = leg.clone();
      leg2.position.z = conveyorZ + 0.5;
      scene.add(leg2);
    });

    const conveyorRollers: THREE.Mesh[] = [];
    const rollerGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 12);
    for (let rx = -5.2; rx <= 16.2; rx += 0.65) {
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(rx, 0.92, conveyorZ);
      scene.add(roller);
      conveyorRollers.push(roller);
    }

    // Sorter Slide Chute at Conveyor End
    const chuteGeo = new THREE.BoxGeometry(3.5, 0.1, 1.2);
    const chuteMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.4,
    });
    const chute = new THREE.Mesh(chuteGeo, chuteMat);
    chute.rotation.z = -0.38;
    chute.position.set(17.2, 0.52, conveyorZ - 1.1);
    chute.rotation.y = 0.45;
    scene.add(chute);

    // Digital Scale Pad (Station 8)
    const scalePad = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5 })
    );
    scalePad.position.set(currentStations[7].coords[0], 0.94, conveyorZ);
    scene.add(scalePad);

    // QC Bench & Table (Station 2)
    const qcTable = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.9, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
    );
    qcTable.position.set(currentStations[1].coords[0], 0.45, currentStations[1].coords[2]);
    qcTable.castShadow = true;
    scene.add(qcTable);

    // 11. Sleek 3D Station Pins & Compact Floor Stencils
    const stationPins: THREE.Group[] = [];
    const stationBeacons: THREE.Mesh[] = [];

    currentStations.forEach((s, idx) => {
      const floorDecal = createFloorDecalMesh(s, theme);
      scene.add(floorDecal);

      const pinGroup = new THREE.Group();
      pinGroup.position.set(s.coords[0], 0, s.coords[2]);
      pinGroup.userData = { stationId: s.id };

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8),
        new THREE.MeshBasicMaterial({ color: 0x0284c7 })
      );
      pole.position.y = 0.9;
      pinGroup.add(pole);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 16),
        new THREE.MeshStandardMaterial({
          color: idx === currentStepIdxRef.current ? 0xf59e0b : 0x0284c7,
          emissive: idx === currentStepIdxRef.current ? 0xd97706 : 0x0369a1,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        })
      );
      head.position.y = 1.8;
      pinGroup.add(head);

      scene.add(pinGroup);
      stationPins.push(pinGroup);

      const beaconMat = new THREE.MeshBasicMaterial({
        color: idx === currentStepIdxRef.current ? 0xf59e0b : 0x0284c7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: idx === currentStepIdxRef.current ? 0.8 : 0.25,
      });
      const beacon = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.1, 32), beaconMat);
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.set(s.coords[0], 0.03, s.coords[2]);
      scene.add(beacon);
      stationBeacons.push(beacon);
    });

    // Single Active Floating Callout
    const dummySpriteMat = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
    const activeCalloutSprite = new THREE.Sprite(dummySpriteMat);
    updateActiveCalloutSprite(
      activeCalloutSprite,
      currentStations[currentStepIdxRef.current] || currentStations[0]
    );
    scene.add(activeCalloutSprite);

    // 12. 5 PERMANENT STATIONED PERSONNEL (คนยืนประจำตำแหน่ง 5 จุดตลอดเวลา)
    const stationedStaff: ArticulatedWorker[] = [];

    // Station 2: QC Inspector standing at QC Bench
    const qcInspector = createDetailedWorker('QC', 0x0284c7);
    qcInspector.root.position.set(currentStations[1].coords[0], 0, currentStations[1].coords[2] - 1.0);
    qcInspector.root.rotation.y = 0;
    scene.add(qcInspector.root);
    stationedStaff.push(qcInspector);

    // Station 4: Control Tower Supervisor at Desk
    const controlSupervisor = createDetailedWorker('CONTROL', 0x6366f1);
    controlSupervisor.root.position.set(
      currentStations[3].coords[0],
      0,
      currentStations[3].coords[2] - 0.9
    );
    controlSupervisor.root.rotation.y = 0;
    scene.add(controlSupervisor.root);
    stationedStaff.push(controlSupervisor);

    // Station 7: Packing Specialist at Packing Table
    const packingOperator = createDetailedWorker('PACKER', 0x10b981);
    packingOperator.root.position.set(currentStations[6].coords[0], 0, conveyorZ - 1.15);
    packingOperator.root.rotation.y = 0;
    scene.add(packingOperator.root);
    stationedStaff.push(packingOperator);

    // Station 8: Digital Scale & Waybill Clerk
    const scaleClerk = createDetailedWorker('SCALE', 0x0ea5e9);
    scaleClerk.root.position.set(currentStations[7].coords[0], 0, conveyorZ - 1.15);
    scaleClerk.root.rotation.y = 0;
    scene.add(scaleClerk.root);
    stationedStaff.push(scaleClerk);

    // Station 10: Outbound Dispatch Officer at Dock 4
    const dispatchOfficer = createDetailedWorker('DISPATCH', 0x059669);
    dispatchOfficer.root.position.set(currentStations[9].coords[0] - 2.0, 0, dockZ - 1.3);
    dispatchOfficer.root.rotation.y = Math.PI / 4;
    scene.add(dispatchOfficer.root);
    stationedStaff.push(dispatchOfficer);

    // 13. MOVING PERSONNEL & EQUIPMENT (Continuous Point A -> Point B Choreography)
    // A. Inbound Handler with Pallet Jack (Dock 1 -> QC)
    const inboundHandler = createDetailedWorker('INBOUND', 0x10b981);
    inboundHandler.root.position.set(currentStations[0].coords[0], 0, currentStations[0].coords[2]);
    scene.add(inboundHandler.root);

    const palletJackMesh = new THREE.Group();
    const jackMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5 });
    const jackFork = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.3), jackMat);
    jackFork.position.set(0, 0.12, 0);
    palletJackMesh.add(jackFork);
    palletJackMesh.position.set(currentStations[0].coords[0], 0, currentStations[0].coords[2] + 0.8);
    scene.add(palletJackMesh);

    // B. Putaway Forklift & Driver (QC -> Storage Racks)
    const forkliftGroup = new THREE.Group();
    const forkBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const fBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 2.2), forkBodyMat);
    fBody.position.set(0, 0.9, 0);
    fBody.castShadow = true;
    forkliftGroup.add(fBody);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 0.12), mastMat);
    mast.position.set(0, 1.6, 1.15);
    forkliftGroup.add(mast);

    const forkliftCarriage = new THREE.Group();
    const fForks = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.2), mastMat);
    fForks.position.set(0, 0.3, 1.7);
    forkliftCarriage.add(fForks);
    forkliftGroup.add(forkliftCarriage);

    forkliftGroup.position.set(currentStations[1].coords[0] + 3.8, 0, currentStations[1].coords[2]);
    forkliftGroup.rotation.y = Math.PI;
    scene.add(forkliftGroup);

    // C. Order Picker Worker with Cart (Stationed at Control Tower Pick Cart Bay -> Walks to Real Bin -> Conveyor Feed)
    const orderPicker = createDetailedWorker('PICKER', 0x0284c7);
    orderPicker.root.position.set(
      currentStations[3].coords[0] + 2.5,
      0,
      currentStations[3].coords[2] + 0.5
    );
    scene.add(orderPicker.root);

    const pickCartMesh = new THREE.Group();
    const cartMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.2), cartMat);
    cart.position.set(0, 0.5, 0);
    cart.castShadow = true;
    pickCartMesh.add(cart);
    pickCartMesh.position.set(
      currentStations[3].coords[0] + 2.5,
      0,
      currentStations[3].coords[2] + 1.3
    );
    scene.add(pickCartMesh);

    // D. Outbound Loader Worker (Chute -> Dock 4 Truck)
    const outboundLoader = createDetailedWorker('LOADER', 0x10b981);
    outboundLoader.root.position.set(currentStations[8].coords[0] + 1.5, 0, currentStations[8].coords[2]);
    scene.add(outboundLoader.root);

    // 14. INBOUND PALLET & OUTBOUND ORDER PARCEL
    const inboundPalletGroup = new THREE.Group();
    const palletBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.2), woodMat);
    palletBase.position.y = 0.07;
    inboundPalletGroup.add(palletBase);
    const palletCargo = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 })
    );
    palletCargo.position.y = 0.54;
    inboundPalletGroup.add(palletCargo);
    inboundPalletGroup.position.set(currentStations[0].coords[0], 0.15, currentStations[0].coords[2] + 0.8);
    scene.add(inboundPalletGroup);

    const outboundParcelGroup = new THREE.Group();
    const goldBoxMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.4,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
    });
    const parcelBox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), goldBoxMat);
    parcelBox.castShadow = true;
    outboundParcelGroup.add(parcelBox);

    const ribbon1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.66, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    outboundParcelGroup.add(ribbon1);

    const haloGeo = new THREE.RingGeometry(0.5, 0.75, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.32;
    outboundParcelGroup.add(halo);

    const firstTarget = orderBinTargetsRef.current[0];
    outboundParcelGroup.position.set(
      firstTarget.shelfPos[0],
      firstTarget.shelfPos[1],
      firstTarget.shelfPos[2]
    );
    scene.add(outboundParcelGroup);

    threeRef.current = {
      scene,
      camera,
      renderer,
      inboundPalletGroup,
      outboundParcelGroup,
      activeCalloutSprite,
      stationPins,
      stationBeacons,
      conveyorRollers,
      shelfHighlightBoxes,
      inboundHandler,
      palletJackMesh,
      forkliftGroup,
      forkliftCarriage,
      orderPicker,
      pickCartMesh,
      outboundLoader,
      stationedStaff,
      cam,
      camTransition: null,
      applyCamera,
    };

    stepEnteredTimeRef.current = performance.now();

    // 15. Real-Time Locomotion & Continuous Point-A-to-Point-B Choreography Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const stepElapsedSec = (performance.now() - stepEnteredTimeRef.current) / 1000;

      if (threeRef.current) {
        const {
          camera,
          cam,
          camTransition,
          inboundPalletGroup,
          outboundParcelGroup,
          activeCalloutSprite,
          stationBeacons,
          conveyorRollers,
          shelfHighlightBoxes,
          inboundHandler,
          palletJackMesh,
          forkliftGroup,
          forkliftCarriage,
          orderPicker,
          pickCartMesh,
          outboundLoader,
          stationedStaff,
        } = threeRef.current;

        const st = currentStepIdxRef.current;
        const sts = stationsRef.current;
        const binTargets = orderBinTargetsRef.current;
        const primaryBin = binTargets[0];

        // Camera Transition
        if (camTransition) {
          const now = performance.now();
          const progress = Math.min(1, (now - camTransition.startTime) / camTransition.duration);
          const ease = 1 - Math.pow(1 - progress, 3);

          cam.tx = THREE.MathUtils.lerp(camTransition.from.tx, camTransition.to.tx, ease);
          cam.tz = THREE.MathUtils.lerp(camTransition.from.tz, camTransition.to.tz, ease);
          cam.dist = THREE.MathUtils.lerp(camTransition.from.dist, camTransition.to.dist, ease);
          cam.rotX = THREE.MathUtils.lerp(camTransition.from.rotX, camTransition.to.rotX, ease);
          cam.rotY = THREE.MathUtils.lerp(camTransition.from.rotY, camTransition.to.rotY, ease);

          applyCamera();

          if (progress >= 1) {
            threeRef.current.camTransition = null;
          }
        } else if (isAutoRotateRef.current) {
          cam.rotY += 0.002 * (tourSpeedRef.current || 1);
          applyCamera();
        }

        // Rotating Conveyor Rollers
        conveyorRollers.forEach((r) => {
          r.rotation.x += 0.08;
        });

        // Stationed Staff Active/Idle Choreography
        stationedStaff.forEach((staff, idx) => {
          staff.torso.position.y = 1.05 + Math.sin(elapsed * 2.2 + idx) * 0.02;
          // Active specialist gestures vigorously when their station is active
          const isWorkingNow =
            (idx === 0 && st === 1) || // QC Inspector at Step 2
            (idx === 1 && st === 3) || // Control Supervisor at Step 4
            (idx === 2 && st === 6) || // Packer at Step 7
            (idx === 3 && st === 7) || // Scale Clerk at Step 8
            (idx === 4 && st === 9); // Dispatch Officer at Step 10

          if (isWorkingNow) {
            staff.leftArm.rotation.x = -0.55 + Math.sin(elapsed * 7) * 0.35;
            staff.rightArm.rotation.x = -0.55 + Math.cos(elapsed * 7) * 0.35;
          } else {
            staff.leftArm.rotation.x = Math.sin(elapsed * 1.5 + idx) * 0.08;
            staff.rightArm.rotation.x = Math.cos(elapsed * 1.5 + idx) * 0.08;
          }
        });

        // Update Shelf Highlight Boxes for all bins in the selected order
        shelfHighlightBoxes.forEach((box, idx) => {
          const target = binTargets[idx];
          if (target) {
            box.visible = true;
            box.position.set(target.shelfPos[0], target.shelfPos[1], target.shelfPos[2]);
            box.scale.setScalar(1 + Math.sin(elapsed * 3.5 + idx) * 0.07);
          } else {
            box.visible = false;
          }
        });

        // -----------------------------------------------------------------
        // CONTINUOUS POINT-A-TO-POINT-B CHOREOGRAPHY (Steps 1 - 10)
        // -----------------------------------------------------------------

        // 1. INBOUND HANDLER & PALLET (Steps 1-3)
        if (st === 0) {
          // Pull pallet from Inbound Dock door out to staging pad
          const pullZ = sts[0].coords[2] - Math.min(2.2, stepElapsedSec * 0.8);
          stepWorkerTowards(inboundHandler, sts[0].coords[0], pullZ, 0.07, Math.PI);
          palletJackMesh.position.set(
            inboundHandler.root.position.x,
            0,
            inboundHandler.root.position.z + 0.85
          );
          palletJackMesh.rotation.y = inboundHandler.root.rotation.y;

          inboundPalletGroup.visible = true;
          inboundPalletGroup.position.set(
            palletJackMesh.position.x,
            0.15,
            palletJackMesh.position.z
          );
        } else if (st === 1) {
          // Walk pallet from Dock 1 to QC Table (Station 2)
          stepWorkerTowards(
            inboundHandler,
            sts[1].coords[0] - 1.3,
            sts[1].coords[2] + 0.4,
            0.09,
            Math.PI / 2
          );
          palletJackMesh.position.set(
            inboundHandler.root.position.x + 0.7,
            0,
            inboundHandler.root.position.z
          );
          palletJackMesh.rotation.y = inboundHandler.root.rotation.y;

          inboundPalletGroup.visible = true;
          inboundPalletGroup.position.set(
            palletJackMesh.position.x,
            0.15,
            palletJackMesh.position.z
          );
        } else if (st === 2) {
          // Inbound handler returns to Dock 1 standby; Forklift drives from QC to Rack & lifts pallet into slot
          stepWorkerTowards(inboundHandler, sts[0].coords[0], sts[0].coords[2], 0.07, 0);
          palletJackMesh.position.set(
            inboundHandler.root.position.x,
            0,
            inboundHandler.root.position.z + 0.85
          );

          const targetX = sts[2].coords[0];
          const targetZ = sts[2].coords[2] + 1.8;
          forkliftGroup.position.x = THREE.MathUtils.lerp(forkliftGroup.position.x, targetX, 0.05);
          forkliftGroup.position.z = THREE.MathUtils.lerp(forkliftGroup.position.z, targetZ, 0.05);

          const distToRack = Math.hypot(forkliftGroup.position.x - targetX, forkliftGroup.position.z - targetZ);
          const targetLift = distToRack < 1.5 ? Math.max(0.4, sts[2].coords[1] - 0.3) : 0.25;
          forkliftCarriage.position.y = THREE.MathUtils.lerp(forkliftCarriage.position.y, targetLift, 0.06);

          inboundPalletGroup.visible = true;
          inboundPalletGroup.position.set(
            forkliftGroup.position.x,
            0.2 + forkliftCarriage.position.y,
            forkliftGroup.position.z - 1.4
          );
        } else {
          // Steps 4-10: Inbound handler stands at Dock 1, Forklift parked cleanly near QC
          stepWorkerTowards(inboundHandler, sts[0].coords[0], sts[0].coords[2], 0.07, 0);
          palletJackMesh.position.set(
            inboundHandler.root.position.x,
            0,
            inboundHandler.root.position.z + 0.85
          );

          inboundPalletGroup.position.set(sts[2].coords[0], sts[2].coords[1], sts[2].coords[2] - 1.2);
          forkliftCarriage.position.y = THREE.MathUtils.lerp(forkliftCarriage.position.y, 0, 0.06);
          forkliftGroup.position.x = THREE.MathUtils.lerp(
            forkliftGroup.position.x,
            sts[1].coords[0] + 3.8,
            0.04
          );
          forkliftGroup.position.z = THREE.MathUtils.lerp(
            forkliftGroup.position.z,
            sts[1].coords[2],
            0.04
          );
        }

        // 2. OUTBOUND ORDER PICKER, PARCEL & LOADER (Steps 1-10)
        if (st < 3) {
          // Steps 1-3: Order Picker stands at Pick Cart Parking Bay next to Control Tower (NEVER at 0,0,0)
          stepWorkerTowards(
            orderPicker,
            sts[3].coords[0] + 2.6,
            sts[3].coords[2] + 0.3,
            0.08,
            0
          );
          pickCartMesh.position.set(
            orderPicker.root.position.x,
            0,
            orderPicker.root.position.z + 0.85
          );
          pickCartMesh.rotation.y = orderPicker.root.rotation.y;

          // Outbound parcel rests inside its real storage bin on the rack
          outboundParcelGroup.position.set(
            primaryBin.shelfPos[0],
            primaryBin.shelfPos[1],
            primaryBin.shelfPos[2]
          );
          outboundParcelGroup.rotation.y = 0;

          // Outbound Loader waits by the Sorter Chute
          stepWorkerTowards(outboundLoader, sts[8].coords[0] + 1.5, sts[8].coords[2], 0.07, -Math.PI / 2);
        } else if (st === 3) {
          // Step 4 (Wave Release): Order Picker walks to Control Desk to receive PDA job, then heads toward aisle entry
          const waypointX = stepElapsedSec < 1.6 ? sts[3].coords[0] + 1.4 : primaryBin.aislePos[0];
          const waypointZ =
            stepElapsedSec < 1.6 ? sts[3].coords[2] + 0.6 : primaryBin.aislePos[2] + 2.8;
          stepWorkerTowards(orderPicker, waypointX, waypointZ, 0.09, Math.PI);
          pickCartMesh.position.set(
            orderPicker.root.position.x,
            0,
            orderPicker.root.position.z + 0.85
          );
          pickCartMesh.rotation.y = orderPicker.root.rotation.y;

          // Parcel pulses on shelf ready to be picked
          outboundParcelGroup.position.set(
            primaryBin.shelfPos[0],
            primaryBin.shelfPos[1] + Math.sin(elapsed * 4) * 0.06,
            primaryBin.shelfPos[2]
          );
          outboundParcelGroup.rotation.y = elapsed * 0.8;
        } else if (st === 4) {
          // Step 5 (Picking): If multi-bin order, cycle through each bin in the order; otherwise walk to primaryBin
          const activeBinIdx =
            binTargets.length > 1
              ? Math.floor(stepElapsedSec / 2.2) % binTargets.length
              : 0;
          const activeTarget = binTargets[activeBinIdx] || primaryBin;

          const arrivedAtBin = stepWorkerTowards(
            orderPicker,
            activeTarget.aislePos[0],
            activeTarget.aislePos[2],
            0.1,
            Math.PI
          );
          pickCartMesh.position.set(
            orderPicker.root.position.x,
            0,
            orderPicker.root.position.z + 0.85
          );
          pickCartMesh.rotation.y = orderPicker.root.rotation.y;

          if (!arrivedAtBin) {
            // While walking to the bin, parcel is on the shelf (or already on cart if moving to 2nd bin)
            if (activeBinIdx === 0) {
              outboundParcelGroup.position.x = THREE.MathUtils.lerp(
                outboundParcelGroup.position.x,
                activeTarget.shelfPos[0],
                0.15
              );
              outboundParcelGroup.position.y = THREE.MathUtils.lerp(
                outboundParcelGroup.position.y,
                activeTarget.shelfPos[1],
                0.15
              );
              outboundParcelGroup.position.z = THREE.MathUtils.lerp(
                outboundParcelGroup.position.z,
                activeTarget.shelfPos[2],
                0.15
              );
            } else {
              outboundParcelGroup.position.set(
                pickCartMesh.position.x,
                0.98,
                pickCartMesh.position.z
              );
            }
          } else {
            // Worker reaches up and transfers parcel from shelf onto Pick Cart
            orderPicker.leftArm.rotation.x = -0.8 + Math.sin(elapsed * 6) * 0.25;
            orderPicker.rightArm.rotation.x = -0.8 + Math.sin(elapsed * 6) * 0.25;
            outboundParcelGroup.position.x = THREE.MathUtils.lerp(
              outboundParcelGroup.position.x,
              pickCartMesh.position.x,
              0.1
            );
            outboundParcelGroup.position.y = THREE.MathUtils.lerp(
              outboundParcelGroup.position.y,
              0.98,
              0.1
            );
            outboundParcelGroup.position.z = THREE.MathUtils.lerp(
              outboundParcelGroup.position.z,
              pickCartMesh.position.z,
              0.1
            );
            outboundParcelGroup.rotation.y = elapsed * 0.5;
          }
        } else if (st === 5) {
          // Step 6 (Conveyor Feed): Order Picker walks from Rack Aisle to Conveyor Induction (Station 6) & places parcel on belt
          const feedWalkTargetX = sts[5].coords[0] - 0.8;
          const feedWalkTargetZ = conveyorZ - 1.3;
          const arrivedAtConveyor = stepWorkerTowards(
            orderPicker,
            feedWalkTargetX,
            feedWalkTargetZ,
            0.1,
            0
          );
          pickCartMesh.position.set(
            orderPicker.root.position.x - 0.75,
            0,
            orderPicker.root.position.z
          );
          pickCartMesh.rotation.y = orderPicker.root.rotation.y;

          if (!arrivedAtConveyor) {
            // Parcel rides on the Pick Cart while worker walks from rack to conveyor
            outboundParcelGroup.position.set(
              pickCartMesh.position.x,
              0.98,
              pickCartMesh.position.z
            );
          } else {
            // Transfer from cart onto conveyor belt
            outboundParcelGroup.position.x = THREE.MathUtils.lerp(
              outboundParcelGroup.position.x,
              sts[5].coords[0],
              0.1
            );
            outboundParcelGroup.position.y = THREE.MathUtils.lerp(
              outboundParcelGroup.position.y,
              1.25,
              0.1
            );
            outboundParcelGroup.position.z = THREE.MathUtils.lerp(
              outboundParcelGroup.position.z,
              conveyorZ,
              0.1
            );
            outboundParcelGroup.rotation.y = 0;
          }
        } else if (st === 6) {
          // Step 7 (Packing): Parcel glides smoothly along conveyor rollers to Packing Station (Station 7)
          outboundParcelGroup.position.x = THREE.MathUtils.lerp(
            outboundParcelGroup.position.x,
            sts[6].coords[0],
            0.07
          );
          outboundParcelGroup.position.y = THREE.MathUtils.lerp(
            outboundParcelGroup.position.y,
            1.25,
            0.12
          );
          outboundParcelGroup.position.z = THREE.MathUtils.lerp(
            outboundParcelGroup.position.z,
            conveyorZ,
            0.12
          );
          outboundParcelGroup.rotation.y = 0;

          // Order picker returns to Control Tower standby
          stepWorkerTowards(orderPicker, sts[3].coords[0] + 2.6, sts[3].coords[2] + 0.3, 0.08, 0);
          pickCartMesh.position.set(
            orderPicker.root.position.x,
            0,
            orderPicker.root.position.z + 0.85
          );
        } else if (st === 7) {
          // Step 8 (Weigh & Label): Parcel glides along conveyor to Digital Scale (Station 8)
          outboundParcelGroup.position.x = THREE.MathUtils.lerp(
            outboundParcelGroup.position.x,
            sts[7].coords[0],
            0.07
          );
          outboundParcelGroup.position.y = THREE.MathUtils.lerp(
            outboundParcelGroup.position.y,
            1.25,
            0.12
          );
          outboundParcelGroup.position.z = THREE.MathUtils.lerp(
            outboundParcelGroup.position.z,
            conveyorZ,
            0.12
          );
          outboundParcelGroup.rotation.y = 0;
        } else if (st === 8) {
          // Step 9 (Sorting): Parcel slides down Sorter Chute; Outbound Loader walks up to catch it
          outboundParcelGroup.position.x = THREE.MathUtils.lerp(
            outboundParcelGroup.position.x,
            17.0,
            0.07
          );
          outboundParcelGroup.position.y = THREE.MathUtils.lerp(
            outboundParcelGroup.position.y,
            0.62,
            0.07
          );
          outboundParcelGroup.position.z = THREE.MathUtils.lerp(
            outboundParcelGroup.position.z,
            conveyorZ - 1.4,
            0.07
          );
          outboundParcelGroup.rotation.y = 0.45;

          stepWorkerTowards(outboundLoader, 17.6, conveyorZ - 1.4, 0.08, -Math.PI / 2);
        } else if (st === 9) {
          // Step 10 (Dispatch): Outbound Loader carries parcel from Sorter Chute to Outbound Dock 4 Truck
          stepWorkerTowards(outboundLoader, sts[9].coords[0] - 0.6, dockZ, 0.09, Math.PI / 2);
          outboundLoader.leftArm.rotation.x = -0.65;
          outboundLoader.rightArm.rotation.x = -0.65;

          outboundParcelGroup.position.set(
            outboundLoader.root.position.x + Math.sin(outboundLoader.root.rotation.y) * 0.55,
            1.12,
            outboundLoader.root.position.z + Math.cos(outboundLoader.root.rotation.y) * 0.55
          );
          outboundParcelGroup.rotation.y = outboundLoader.root.rotation.y;
        }

        // Active Floating Callout visibility & gentle bobbing
        activeCalloutSprite.visible = showActiveLabelRef.current;
        activeCalloutSprite.position.y = 3.1 + Math.sin(elapsed * 2.5) * 0.08;

        // Beacon pulse
        stationBeacons.forEach((beacon, i) => {
          if (i === st) {
            beacon.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.22);
            (beacon.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0.85;
          } else {
            beacon.scale.setScalar(1.0);
            (beacon.material as THREE.MeshBasicMaterial).color.setHex(0x0284c7);
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0.28;
          }
        });

        renderer.render(scene, camera);
      }
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !threeRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

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
            goToStationRef.current(stIdx, true);
            return;
          }
          obj = obj.parent;
        }
      }
    };
    container.addEventListener('click', handleClick);

    const el = renderer.domElement;
    el.style.touchAction = 'none';

    let isPointerDown = false;
    let prevPointer = { x: 0, y: 0 };
    let isPanning = false;

    const onPointerDown = (e: PointerEvent) => {
      if (!threeRef.current) return;
      threeRef.current.camTransition = null;
      isPointerDown = true;
      isPanning = e.button === 2 || e.shiftKey;
      prevPointer = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown || !threeRef.current) return;
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      prevPointer = { x: e.clientX, y: e.clientY };

      const c = threeRef.current.cam;

      if (isPanning) {
        const factor = c.dist * 0.0015;
        const forwardX = Math.sin(c.rotY);
        const forwardZ = Math.cos(c.rotY);
        const rightX = Math.cos(c.rotY);
        const rightZ = -Math.sin(c.rotY);

        c.tx += (-dx * rightX + dy * forwardX) * factor;
        c.tz += (-dx * rightZ + dy * forwardZ) * factor;
      } else {
        c.rotY -= dx * 0.006;
        c.rotX += dy * 0.004;
      }

      threeRef.current.applyCamera();
    };

    const onPointerUp = (e: PointerEvent) => {
      isPointerDown = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!threeRef.current) return;
      threeRef.current.camTransition = null;
      const zoomFactor = 1 + Math.abs(e.deltaY) * 0.0015;
      if (e.deltaY > 0) {
        threeRef.current.cam.dist *= zoomFactor;
      } else {
        threeRef.current.cam.dist /= zoomFactor;
      }
      threeRef.current.applyCamera();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);

      // Full GPU resource cleanup (geometries, materials, textures)
      scene.traverse((obj: any) => {
        if (obj.geometry) {
          obj.geometry.dispose?.();
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            if (m.map) m.map.dispose?.();
            m.dispose?.();
          });
        }
      });
      renderer.dispose();
      threeRef.current = null;
    };
  }, [floorWidth, floorLength, conveyorZ, dockZ, layout, binDataMap, theme]);

  // Quiz submission handler
  const handleAnswerQuiz = (idx: number) => {
    if (selectedQuizAnswer !== null) return;
    setSelectedQuizAnswer(idx);
    setAnsweredCount((prev) => prev + 1);

    if (idx === currentStation.quiz.correctIndex) {
      setQuizScore((prev) => prev + 10);
      playChime('correct');
    } else {
      playChime('wrong');
    }
  };

  const isLight = theme === 'light';

  return (
    <div
      className={cn(
        'flex flex-col xl:flex-row gap-4 h-[calc(100vh-140px)] min-h-[720px] select-none transition-colors duration-200',
        isLight ? 'text-slate-800' : 'text-slate-100'
      )}
    >
      {/* 1. LEFT COCKPIT: SOP Guide, Live Orders & Interactive Quiz */}
      <div
        className={cn(
          'w-full xl:w-[460px] flex flex-col backdrop-blur-xl border rounded-3xl p-5 shadow-xl overflow-hidden order-2 xl:order-1 transition-colors duration-200',
          isLight
            ? 'bg-white/95 border-slate-200 shadow-slate-200/50'
            : 'bg-slate-900/90 border-slate-800 shadow-2xl'
        )}
      >
        {/* Step Indicator Header */}
        <div
          className={cn(
            'flex items-center justify-between border-b pb-3 mb-3',
            isLight ? 'border-slate-200' : 'border-slate-800'
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs border',
                currentStation.phase === 'INBOUND'
                  ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                  : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
              )}
            >
              {currentStation.stepNumber}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-widest block',
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  ขั้นตอนที่ {currentStation.stepNumber} / 10
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded text-[9px] font-black uppercase',
                    currentStation.phase === 'INBOUND'
                      ? 'bg-blue-500/15 text-blue-700'
                      : 'bg-emerald-500/15 text-emerald-700'
                  )}
                >
                  {currentStation.phase === 'INBOUND' ? '📥 ขาเข้า' : '📦 ขาออก'}
                </span>
              </div>
              <h2 className={cn('text-base font-black', isLight ? 'text-slate-900' : 'text-white')}>
                {currentStation.titleTh}
              </h2>
            </div>
          </div>
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border',
              isLight
                ? 'bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            )}
          >
            {currentStation.area}
          </span>
        </div>

        {/* Tab Switcher */}
        <div
          className={cn(
            'grid grid-cols-3 gap-1 p-1 rounded-xl border mb-3',
            isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-slate-950/60 border-slate-800/80'
          )}
        >
          <button
            onClick={() => setActiveTab('sop')}
            className={cn(
              'py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'sop'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200/80'
                  : 'bg-amber-500 text-slate-950 shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            SOP Guide
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={cn(
              'py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'live'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200/80'
                  : 'bg-amber-500 text-slate-950 shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Data
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={cn(
              'py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative',
              activeTab === 'quiz'
                ? isLight
                  ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200/80'
                  : 'bg-amber-500 text-slate-950 shadow-md font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Quiz ทดสอบ
            {answeredCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[9px] font-black">
                {quizScore}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 text-xs select-none">
          {activeTab === 'sop' && (
            <div className="space-y-3">
              {/* Description */}
              <div
                className={cn(
                  'p-3.5 rounded-2xl border leading-relaxed',
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-300'
                )}
              >
                <span className={cn('font-bold block mb-1', isLight ? 'text-amber-600' : 'text-amber-400')}>
                  มาตรฐานการปฏิบัติงาน & การส่งต่องาน:
                </span>
                {currentStation.description}
              </div>

              {/* Key Terminology */}
              <div>
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider block mb-1.5',
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  )}
                >
                  คำศัพท์ประจำสถานี (Key Terms):
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {currentStation.keyTerms.map((k, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-2 rounded-xl border flex items-start gap-2',
                        isLight
                          ? 'bg-white border-slate-200 shadow-sm'
                          : 'bg-slate-800/50 border-slate-700/60'
                      )}
                    >
                      <span
                        className={cn(
                          'font-mono font-black shrink-0 text-[11px]',
                          isLight ? 'text-amber-600' : 'text-amber-400'
                        )}
                      >
                        {k.term}:
                      </span>
                      <span className={cn('text-[11px]', isLight ? 'text-slate-700' : 'text-slate-300')}>
                        {k.meaning}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QC Checklist */}
              <div
                className={cn(
                  'p-3 rounded-2xl border',
                  isLight
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                )}
              >
                <div className="flex items-center gap-1.5 font-black text-emerald-600 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>QC Inspection Checklist (เกณฑ์คุณภาพ)</span>
                </div>
                <ul
                  className={cn(
                    'space-y-1 pl-4 list-disc marker:text-emerald-500 text-[11px]',
                    isLight ? 'text-emerald-800' : 'text-emerald-100/90'
                  )}
                >
                  {currentStation.qcChecklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Safety Rules */}
              <div
                className={cn(
                  'p-3 rounded-2xl border',
                  isLight
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : 'bg-rose-950/25 border-rose-500/30 text-rose-200'
                )}
              >
                <div className="flex items-center gap-1.5 font-black text-rose-600 mb-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Safety Precautions (ความปลอดภัย)</span>
                </div>
                <ul
                  className={cn(
                    'space-y-1 pl-4 list-disc marker:text-rose-500 text-[11px]',
                    isLight ? 'text-rose-800' : 'text-rose-100/90'
                  )}
                >
                  {currentStation.safetyRules.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-3.5">
              {/* Active Outbound Orders Selector */}
              <div
                className={cn(
                  'p-3.5 rounded-2xl border',
                  isLight
                    ? 'bg-white border-amber-300/80 shadow-sm shadow-amber-500/5'
                    : 'bg-slate-950/60 border-amber-500/30'
                )}
              >
                <div className="flex items-center justify-between mb-2 gap-1 flex-wrap">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 font-black text-xs',
                      isLight ? 'text-amber-700' : 'text-amber-400'
                    )}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>รายการเบิกจ่าย (คลิกเพื่อจำลองหยิบจริง)</span>
                  </div>
                  {orderSourceMode === 'LIVE_ORDERS' ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      🟢 ออเดอร์จริงจากระบบ (Live WMS)
                    </span>
                  ) : orderSourceMode === 'STOCK_SIM' ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      🟡 จำลองจากสต็อกจริงในคลัง
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-300 shadow-sm flex items-center gap-1">
                      ⚪ ข้อมูลสาธิต (Demo Mockup)
                    </span>
                  )}
                </div>

                {orderSourceMode === 'STOCK_SIM' && (
                  <p className="text-[10px] text-slate-500 mb-2">
                    ขณะนี้ไม่มีใบงานค้างในคิวออเดอร์ ระบบจึงดึงสินค้าที่มีสต็อกจริงในคลังสาขานี้มาจำลองเส้นทางเดินหยิบจากโลเคชั่นจริง
                  </p>
                )}

                <div className="space-y-2">
                  {liveOrders.map((ord) => {
                    const isSelected = selectedOrder.orderId === ord.orderId;
                    const binsText =
                      ord.allBins && ord.allBins.length > 1
                        ? ord.allBins.join(', ')
                        : ord.binCode;
                    return (
                      <button
                        key={ord.orderId}
                        onClick={() => handleSelectOrder(ord)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1',
                          isSelected
                            ? isLight
                              ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-400/50'
                              : 'bg-amber-500/20 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                            : isLight
                            ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              'font-mono font-black text-xs',
                              isLight ? 'text-slate-900' : 'text-white'
                            )}
                          >
                            {ord.orderId}
                          </span>
                          <div className="flex items-center gap-1">
                            {ord.statusLabel && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600">
                                {ord.statusLabel}
                              </span>
                            )}
                            <span
                              className={cn(
                                'px-1.5 py-0.2 rounded text-[9px] font-black',
                                ord.priority === 'EXPRESS'
                                  ? 'bg-rose-500/15 text-rose-600'
                                  : ord.priority === 'URGENT'
                                  ? 'bg-amber-500/15 text-amber-600'
                                  : isLight
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-slate-700 text-slate-300'
                              )}
                            >
                              {ord.priority}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] gap-2">
                          <span
                            className={cn(
                              'font-bold truncate',
                              isLight ? 'text-slate-800' : 'text-slate-300'
                            )}
                          >
                            {ord.skuName}
                          </span>
                          <span
                            className={cn(
                              'font-mono font-black px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5',
                              isLight
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-amber-500/10 text-amber-400'
                            )}
                          >
                            <MapPin className="w-2.5 h-2.5" />[{binsText}]
                          </span>
                        </div>
                        <div
                          className={cn(
                            'flex items-center justify-between text-[10px] pt-0.5',
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          )}
                        >
                          <span className="truncate max-w-[200px]">ลูกค้า/ปลายทาง: {ord.destination}</span>
                          <span className="font-mono shrink-0">
                            {ord.qty} ชิ้น (~{ord.weightKg} kg)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warehouse Live Slotting Summary */}
              <div
                className={cn(
                  'p-3 rounded-2xl border grid grid-cols-3 gap-2 text-center',
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                )}
              >
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">ช่องจัดเก็บทั้งหมด</span>
                  <span className="text-sm font-black font-mono">
                    {warehouseMapData.stats.occupiedBins}/{warehouseMapData.stats.totalBins}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">อัตราใช้พื้นที่</span>
                  <span className="text-sm font-black font-mono text-emerald-600">
                    {warehouseMapData.stats.occupancyRate}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block">สต็อกรวมในผัง</span>
                  <span className="text-sm font-black font-mono text-amber-600">
                    {warehouseMapData.stats.mappedStock.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Station Queue & Throughput */}
              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className={cn(
                    'p-3.5 rounded-2xl border',
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider block',
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    )}
                  >
                    คิวงานรอดำเนินการ
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={cn(
                        'text-2xl font-black font-mono',
                        isLight ? 'text-amber-600' : 'text-amber-400'
                      )}
                    >
                      {currentStation.liveMetrics.queueCount}
                    </span>
                    <span className={cn('text-xs', isLight ? 'text-slate-500' : 'text-slate-400')}>
                      รายการ
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                    สถานะ: {currentStation.liveMetrics.status}
                  </span>
                </div>

                <div
                  className={cn(
                    'p-3.5 rounded-2xl border',
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider block',
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    )}
                  >
                    Throughput รายชั่วโมง
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={cn(
                        'text-2xl font-black font-mono',
                        isLight ? 'text-cyan-700' : 'text-cyan-400'
                      )}
                    >
                      {currentStation.liveMetrics.hourlyThroughput}
                    </span>
                    <span className={cn('text-xs', isLight ? 'text-slate-500' : 'text-slate-400')}>
                      ชิ้น/ชม.
                    </span>
                  </div>
                  <span
                    className={cn('text-[10px] mt-1 block', isLight ? 'text-slate-500' : 'text-slate-400')}
                  >
                    กำลังการผลิตปัจจุบัน
                  </span>
                </div>
              </div>

              {/* Target KPI Strip */}
              <div
                className={cn(
                  'p-3 rounded-2xl border',
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/60 border-slate-700/80'
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={cn('font-bold text-xs', isLight ? 'text-slate-900' : 'text-white')}>
                    {currentStation.kpi.label}
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-black border',
                      isLight
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    )}
                  >
                    เป้าหมาย: {currentStation.kpi.target}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'text-2xl font-black font-mono',
                      isLight ? 'text-slate-900' : 'text-white'
                    )}
                  >
                    {currentStation.kpi.current}
                  </span>
                  <span className={cn('text-xs', isLight ? 'text-slate-500' : 'text-slate-400')}>
                    {currentStation.kpi.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="space-y-4">
              <div
                className={cn(
                  'flex items-center justify-between p-3 rounded-2xl border',
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                )}
              >
                <div>
                  <span
                    className={cn('text-[10px] font-bold block', isLight ? 'text-slate-500' : 'text-slate-400')}
                  >
                    คะแนนการทดสอบ SOP
                  </span>
                  <span
                    className={cn(
                      'text-xl font-black font-mono',
                      isLight ? 'text-amber-600' : 'text-amber-400'
                    )}
                  >
                    {quizScore} / 100
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={cn('text-[10px] font-bold block', isLight ? 'text-slate-500' : 'text-slate-400')}
                  >
                    ทำแล้ว
                  </span>
                  <span className={cn('text-xs font-bold', isLight ? 'text-slate-700' : 'text-slate-200')}>
                    {answeredCount} จาก 10 ข้อ
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  'p-4 rounded-2xl border space-y-3',
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/50 border-slate-800/80'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">
                    คำถามข้อที่ {currentStation.stepNumber}
                  </span>
                </div>
                <p className={cn('font-bold leading-relaxed', isLight ? 'text-slate-900' : 'text-slate-100')}>
                  {currentStation.quiz.question}
                </p>

                <div className="space-y-2 pt-2">
                  {currentStation.quiz.options.map((opt, i) => {
                    const isSelected = selectedQuizAnswer === i;
                    const isCorrect = i === currentStation.quiz.correctIndex;
                    let btnStyle = isLight
                      ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 border-slate-700/60';

                    if (selectedQuizAnswer !== null) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-600 text-white font-bold border-emerald-500 shadow-md';
                      } else if (isSelected) {
                        btnStyle = 'bg-rose-600 text-white font-bold border-rose-500';
                      } else {
                        btnStyle = isLight
                          ? 'bg-slate-100 text-slate-400 border-slate-200'
                          : 'bg-slate-900/40 text-slate-500 border-slate-800';
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswerQuiz(i)}
                        disabled={selectedQuizAnswer !== null}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border text-xs leading-relaxed transition-all flex items-start gap-2.5',
                          btnStyle
                        )}
                      >
                        <span
                          className={cn(
                            'w-5 h-5 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5',
                            isLight ? 'bg-white border-slate-300' : 'bg-slate-900/60 border-slate-600'
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedQuizAnswer !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'p-3 rounded-xl text-xs leading-relaxed border mt-3',
                      selectedQuizAnswer === currentStation.quiz.correctIndex
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : isLight
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    )}
                  >
                    <span className="font-bold block mb-1">
                      {selectedQuizAnswer === currentStation.quiz.correctIndex
                        ? '✅ คำตอบถูกต้อง!'
                        : '❌ ยังไม่ถูกต้อง'}
                    </span>
                    {currentStation.quiz.explanation}
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cockpit Bottom Navigation Bar */}
        <div
          className={cn(
            'flex items-center justify-between border-t pt-3 mt-3',
            isLight ? 'border-slate-200' : 'border-slate-800'
          )}
        >
          <button
            onClick={() => goToStation(currentStepIdx - 1, viewMode === 'FOCUS')}
            disabled={currentStepIdx === 0}
            className={cn(
              'px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-30 border',
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
            )}
          >
            <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
          </button>
          <div className="flex items-center gap-1">
            {stations.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToStation(i, viewMode === 'FOCUS')}
                className={cn(
                  'w-6 h-6 rounded-lg text-[10px] font-black transition-all flex items-center justify-center',
                  i === currentStepIdx
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-110 font-black'
                    : s.phase === 'INBOUND'
                    ? isLight
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200'
                      : 'bg-blue-950/80 text-blue-300 hover:bg-blue-900 border border-blue-900'
                    : isLight
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
                title={`สถานี ${s.stepNumber}: ${s.titleTh}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => goToStation(currentStepIdx + 1, viewMode === 'FOCUS')}
            disabled={currentStepIdx === stations.length - 1}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-md"
          >
            ถัดไป <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. RIGHT 3D VIEWPORT: Three.js Virtual Warehouse Canvas */}
      <div
        className={cn(
          'flex-1 relative rounded-3xl border overflow-hidden shadow-2xl flex flex-col order-1 xl:order-2 h-[520px] xl:h-auto transition-colors duration-200',
          isLight
            ? 'bg-[#f1f5f9] border-slate-200 shadow-slate-200/50'
            : 'bg-[#0a0e17] border-slate-800'
        )}
      >
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* TOP FLOATING TOOLBAR: Theme, Camera View Mode & Warehouse Info */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Branch & Selected Order Badge */}
          <div
            className={cn(
              'backdrop-blur-md border px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto transition-colors duration-200',
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-200/50'
                : 'bg-slate-900/90 border-slate-700/80 text-white shadow-xl'
            )}
          >
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs font-black', isLight ? 'text-slate-900' : 'text-white')}>
                  {layout?.name || `คลังสาขา ${branchId.toUpperCase()}`}
                </span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-600 border border-amber-500/40 rounded text-[9px] font-mono font-bold">
                  {branchId.toUpperCase()}
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  📦 พิกัดหยิบ: [
                  {selectedOrder.allBins && selectedOrder.allBins.length > 1
                    ? selectedOrder.allBins.join(', ')
                    : selectedOrder.binCode}
                  ]
                </span>
              </div>
            </div>
            <button
              onClick={loadWarehouseData}
              className={cn(
                'p-1 rounded-lg transition-colors ml-1',
                isLight
                  ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              )}
              title="รีเฟรชข้อมูลผัง สต็อก และออเดอร์จริง"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingLayout && 'animate-spin text-amber-500')} />
            </button>
          </div>

          {/* Controls: Theme Toggle & Camera View Modes */}
          <div
            className={cn(
              'backdrop-blur-md border p-1.5 rounded-2xl shadow-xl flex items-center gap-1 pointer-events-auto transition-colors duration-200',
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-200/50'
                : 'bg-slate-900/90 border-slate-700/80 text-white shadow-xl'
            )}
          >
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={cn(
                'px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border',
                theme === 'light'
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              )}
              title="สลับธีม สว่าง (Daylight) / มืด (Night Tactical)"
            >
              {theme === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{theme === 'light' ? 'สว่าง' : 'มืด'}</span>
            </button>

            <div className={cn('w-px h-5 mx-0.5', isLight ? 'bg-slate-200' : 'bg-slate-700')} />

            <button
              onClick={setCameraOverview}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all',
                viewMode === 'OVERVIEW'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-slate-800'
              )}
              title="ดูภาพกว้างทั้งคลัง (ไม่ซูมเข้าเมื่อเปลี่ยนขั้นตอน)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              🌐 ภาพกว้าง
            </button>
            <button
              onClick={setCameraFocus}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all',
                viewMode === 'FOCUS'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-slate-800'
              )}
              title="ซูมโฟกัสสถานีปัจจุบัน"
            >
              <Eye className="w-3.5 h-3.5" />
              🔭 โฟกัสสถานี
            </button>
            <button
              onClick={() => setShowActiveLabel(!showActiveLabel)}
              className={cn(
                'px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all',
                showActiveLabel
                  ? isLight
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : isLight
                  ? 'text-slate-500 hover:bg-slate-100'
                  : 'text-slate-500 hover:bg-slate-800'
              )}
              title="เปิด/ปิดป้ายชื่อลอยในอากาศ"
            >
              <Tag className="w-3.5 h-3.5" />
              {showActiveLabel ? 'ป้ายลอย ON' : 'ป้ายลอย OFF'}
            </button>
            <button
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              className={cn(
                'px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all',
                isAutoRotate
                  ? 'bg-indigo-600 text-white font-black'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-400 hover:bg-slate-800'
              )}
              title="หมุนรอบ 360 องศาต่อเนื่อง"
            >
              <Compass className="w-3.5 h-3.5" />
              360° {isAutoRotate ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={resetCamera}
              className={cn(
                'p-1.5 rounded-xl transition-colors',
                isLight
                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
              title="รีเซ็ตมุมกล้อง"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* BOTTOM FLOATING CONTROLS: Active Station Pill & Tour Playback */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Active Station Pill with Handover Subtitle */}
          <div
            className={cn(
              'backdrop-blur-md border px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 pointer-events-auto transition-colors duration-200',
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-200/50'
                : 'bg-slate-900/90 border-slate-700/80 text-white shadow-xl'
            )}
          >
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full animate-ping',
                currentStation.phase === 'INBOUND' ? 'bg-blue-500' : 'bg-amber-500'
              )}
            />
            <div>
              <span
                className={cn(
                  'text-xs font-black block',
                  currentStation.phase === 'INBOUND'
                    ? isLight
                      ? 'text-blue-700'
                      : 'text-blue-400'
                    : isLight
                    ? 'text-amber-700'
                    : 'text-amber-400'
                )}
              >
                สถานี {currentStation.stepNumber}: {currentStation.titleTh} (
                {currentStation.phase === 'INBOUND' ? 'ขาเข้ารับสินค้า' : 'ขาออกส่งมอบ'})
              </span>
              <span
                className={cn(
                  'text-[10px] block',
                  isLight ? 'text-slate-600 font-medium' : 'text-slate-300'
                )}
              >
                {currentStation.subtitle}
              </span>
            </div>
          </div>

          {/* Tour Play/Pause, Speed & Sound Controls */}
          <div
            className={cn(
              'backdrop-blur-md border p-1.5 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-auto transition-colors duration-200',
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-200/50'
                : 'bg-slate-900/90 border-slate-700/80 text-white shadow-xl'
            )}
          >
            <button
              onClick={() => setIsPlayingTour(!isPlayingTour)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all',
                isPlayingTour
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              )}
            >
              {isPlayingTour ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              {isPlayingTour ? 'หยุดชั่วคราว' : 'Auto Tour'}
            </button>

            {/* Speed Selector */}
            <div
              className={cn(
                'flex items-center gap-0.5 p-0.5 rounded-xl border',
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'
              )}
            >
              {([1, 2, 5] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setTourSpeed(spd)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all',
                    tourSpeed === spd
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : isLight
                      ? 'text-slate-500 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'p-1.5 rounded-xl transition-colors',
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              )}
              title={soundEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-amber-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
