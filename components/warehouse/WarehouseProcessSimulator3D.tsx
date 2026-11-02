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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { RackConfig, WarehouseLayout, binCodeFor } from '@/lib/warehouseLayout';

export type ProcessStation = {
  id: number;
  stepNumber: number;
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

export const BASE_PROCESS_STATIONS: Omit<ProcessStation, 'coords'>[] = [
  {
    id: 1,
    stepNumber: 1,
    titleTh: '1. รับสินค้าเข้า (Inbound)',
    titleEn: 'Inbound Receiving & Unload',
    subtitle: 'ตรวจรับตู้สินค้าและเทียบเอกสาร ASN',
    area: 'Dock 01 - Inbound Staging',
    description: 'เทียบรถบรรทุกเข้าช่องโหลด (Dock Leveler) พนักงานใช้แฮนด์พาเลทขนถ่ายพาเลทสินค้าลงจากท้ายรถ ตรวจนับจำนวนกล่องเทียบกับใบกำกับส่งของ (Delivery Note) และ ASN พร้อมติดรหัส LPN',
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
      explanation: 'ตามระเบียบ WMS มาตรฐาน ต้องบันทึกรูปภาพ ออก Damage Report และแยกเข้าโซนกักกัน (Hold) ห้ามรับเข้าสต็อกปกติโดยเด็ดขาด',
    },
    liveMetrics: { queueCount: 4, hourlyThroughput: 140, status: 'OPTIMAL' },
  },
  {
    id: 2,
    stepNumber: 2,
    titleTh: '2. ตรวจรับคุณภาพ (QC)',
    titleEn: 'Quality Gate & Inspection',
    subtitle: 'พนักงานส่งต่อสินค้าเข้าโต๊ะตรวจ QC',
    area: 'Station QC - Inspection Gate',
    description: 'พนักงานลากพาเลทสินค้าจากจุดดรอปหน้าท่าเทียบ ส่งต่อเข้าสถานีตรวจ QC ทำการสุ่มตรวจตามเกณฑ์ AQL เช็คบาร์โค้ด SKU ล็อตผลิต และวันหมดอายุ (Shelf-life)',
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
      explanation: 'มาตรฐานการบริหารคลังสินค้า สินค้าทั่วไปต้องมี Shelf-life คงเหลือ ≥ 75% เพื่อให้มีระยะเวลาเพียงพอในการกระจายและจำหน่ายต่อ',
    },
    liveMetrics: { queueCount: 2, hourlyThroughput: 85, status: 'OPTIMAL' },
  },
  {
    id: 3,
    stepNumber: 3,
    titleTh: '3. จัดเก็บเข้าชั้น (Putaway)',
    titleEn: 'Forklift Directed Putaway',
    subtitle: 'โฟล์กลิฟต์ยกพาเลทจาก QC เข้าแร็ค',
    area: 'Racks - Storage Bins',
    description: 'รถโฟล์กลิฟต์รับพาเลทที่ผ่าน QC ขับเข้าสู่ช่องทางเดินแร็คตามพิกัดที่ WMS ชี้แนะ (Directed Putaway) ยกงาขึ้นวางพาเลทเข้าช่องจัดเก็บ และสแกนบาร์โค้ดช่อง (Location Bin) ยืนยัน',
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
      explanation: 'การสแกน Bin Confirmation ป้องกันปัญหาสต็อกหลงตำแหน่ง (Lost/Misplaced Stock) ทำให้หยิบสินค้าได้รวดเร็วและตรงเป๊ะ 100%',
    },
    liveMetrics: { queueCount: 6, hourlyThroughput: 110, status: 'OPTIMAL' },
  },
  {
    id: 4,
    stepNumber: 4,
    titleTh: '4. ปล่อยรอบคำสั่งซื้อ (Wave)',
    titleEn: 'Wave Release & Dispatching',
    subtitle: 'ศูนย์ควบคุมปล่อยคำสั่งเบิกจ่าย',
    area: 'Control Tower - Operation Hub',
    description: 'Control Tower วิเคราะห์รอบคำสั่งซื้อและเส้นทางเดินรถ ปล่อยคลื่นคำสั่งซื้อ (Wave Release) ส่งสัญญาณงานไปยังเครื่อง PDA ของพนักงานหยิบประจำโซน เพื่อเตรียมการหยิบตามลำดับตัดรอบ (Cut-off Time)',
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
      explanation: 'Wave Picking ช่วยประหยัดเวลาเดินหยิบได้มากกว่า 40% โดยการรวบรวมสินค้าจากหลายออเดอร์ในโซนเดียวกันมาหยิบในรอบเดียว',
    },
    liveMetrics: { queueCount: 18, hourlyThroughput: 220, status: 'BUSY' },
  },
  {
    id: 5,
    stepNumber: 5,
    titleTh: '5. พนักงานหยิบสินค้า (Picking)',
    titleEn: 'Batch Picking to Cart',
    subtitle: 'พนักงานเดินหยิบใส่รถเข็นเบิกจ่าย',
    area: 'Aisle Storage - Pick Face',
    description: 'พนักงานเข็นรถเข็นเบิกจ่าย (Pick Cart) เดินเข้าตามช่องทางเดิน หยิบสินค้าจากชั้นวางตามกฎ FEFO (First-Expired, First-Out) ยิงสแกน SKU และจำนวน นำสินค้าลงตระกร้าแยกออเดอร์บนรถเข็น',
    keyTerms: [
      { term: 'FEFO', meaning: 'First-Expired, First-Out (สินค้าที่หมดอายุก่อน ต้องหยิบก่อนเสมอ)' },
      { term: 'Pick Cart', meaning: 'รถเข็นแยกช่องบรรจุสินค้าสำหรับ Batch Picking' },
      { term: 'Pick Face', meaning: 'ตำแหน่งชั้นล่างที่เปิดให้คนงานเดินหยิบได้สะดวก' },
    ],
    qcChecklist: [
      'สแกนบาร์โค้ดสินค้ายืนยันรหัส SKU ถูกต้องตรงกับ Pick List 100%',
      'ตรวจสอบสภาพกล่องสินค้าก่อนหยิบลงตระกร้า ต้องไม่มีรอยบุบ ฉีกขาด หรือชำรุด',
    ],
    safetyRules: [
      'ใช้เทคนิคการยกของที่ถูกวิธี (ย่อเข่า หลังตรง) หลีกเลี่ยงอาการบาดเจ็บของกล้ามเนื้อ',
      'ห้ามวางรถเข็นกีดขวางทางหนีไฟหรือตู้ดับเพลิง',
    ],
    kpi: { label: 'อัตราการหยิบเฉลี่ย', target: '> 120 lines/ชม.', current: '138', unit: 'lines/ชม.' },
    quiz: {
      question: 'หากสินค้าชนิดเดียวกันมี 2 ล็อตบนชั้นวาง: ล็อต A หมดอายุอีก 3 เดือนข้างหน้า, ล็อต B หมดอายุอีก 8 เดือนข้างหน้า ควรหยิบชิ้นไหนตามระบบ FEFO?',
      options: [
        'หยิบล็อต B เพราะสินค้ายังสดใหม่กว่า',
        'หยิบล็อต A เพราะวันหมดอายุใกล้กว่า ต้องระบายออกก่อนตามกฎ FEFO',
        'หยิบล็อตไหนก็ได้ที่หยิบง่ายกว่า',
      ],
      correctIndex: 1,
      explanation: 'FEFO (First-Expired, First-Out) บังคับให้หยิบล็อตที่หมดอายุก่อน (ล็อต A) ออกไปส่งมอบก่อน เพื่อป้องกันสินค้าตกค้างจนหมดอายุในคลัง',
    },
    liveMetrics: { queueCount: 12, hourlyThroughput: 310, status: 'OPTIMAL' },
  },
  {
    id: 6,
    stepNumber: 6,
    titleTh: '6. ส่งขึ้นสายพาน (Conveyor Feed)',
    titleEn: 'Conveyor Induction & Feed',
    subtitle: 'พนักงานเข็นของมาป้อนขึ้นสายพานลำเลียง',
    area: 'Conveyor Feed - Main Line',
    description: 'พนักงานเข็นรถเข็นจากโซนหยิบ มายังหัวสายพานลำเลียง (Conveyor Induction) ยกกล่อง/ตะกร้าป้อนขึ้นบนลูกกลิ้งมอเตอร์ เพื่อลำเลียงส่งต่อไปยังสถานีบรรจุหีบห่ออย่างต่อเนื่อง',
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
      explanation: 'ความปลอดภัยสูงสุด: ต้องกดปุ่มหยุดฉุกเฉิน (E-Stop) ทันที ห้ามยื่นมือหรืออวัยวะใดๆ เข้าไปในเครื่องจักรที่กำลังทำงานอยู่เด็ดขาด',
    },
    liveMetrics: { queueCount: 8, hourlyThroughput: 450, status: 'OPTIMAL' },
  },
  {
    id: 7,
    stepNumber: 7,
    titleTh: '7. บรรจุกล่อง & ตรวจสอบ (Packing)',
    titleEn: 'Packing, Cushioning & Audit',
    subtitle: 'พนักงานรับกล่องจากสายพานเข้าโต๊ะแพ็ค',
    area: 'Packing Station #03',
    description: 'กล่องเลื่อนมาตามสายพานถึงโต๊ะแพ็ค พนักงานยกกล่องลงมาตรวจสอบรายการสินค้า (Order Audit) ใส่แผ่นกันกระแทก (Air Cushion) และปิดผนึกเทปกาวนิรภัย WMS อย่างแน่นหนา',
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
      explanation: 'Order Audit เป็นปราการด่านสำคัญที่สุดในการป้องกันคำร้องเรียน สินค้าส่งผิด หรือส่งขาด ลดปัญหาการคืนสินค้า (Return/RMA) ได้อย่างมหาศาล',
    },
    liveMetrics: { queueCount: 5, hourlyThroughput: 160, status: 'OPTIMAL' },
  },
  {
    id: 8,
    stepNumber: 8,
    titleTh: '8. ชั่งน้ำหนัก & ติดฉลาก (Label)',
    titleEn: 'Weigh, Volumetric & Shipping Label',
    subtitle: 'เลื่อนกล่องเข้าแท่นชั่งและพิมพ์ใบปะหน้า',
    area: 'Station Weigh & Auto Print',
    description: 'พนักงานเลื่อนกล่องจากโต๊ะแพ็คขึ้นแท่นชั่งน้ำหนักดิจิทัล เซนเซอร์วัดมิติตัวกล่องเพื่อคำนวณ Volumetric เครื่องพิมพ์ความร้อนพิมพ์ใบปะหน้าขนส่ง (Waybill) ออกมาติดบนกล่องทันที',
    keyTerms: [
      { term: 'Volumetric Weight', meaning: 'น้ำหนักตามปริมาตรคำนวณจาก (กว้าง × ยาว × สูง) ÷ 5000' },
      { term: 'Waybill / Tracking No.', meaning: 'ฉลากบาร์โค้ดติดตามสถานะพัสดุสำหรับผู้ให้บริการขนส่ง' },
    ],
    qcChecklist: [
      'บาร์โค้ดใบปะหน้าต้องพิมพ์ชัดเจน ไม่เป็นเส้นขาด หรือหมึกเลือนราง',
      'ตำแหน่งฉลากต้องติดบนพื้นผิวเรียบด้านบนของกล่อง ไม่ทับรอยต่อรอยพับกล่อง',
    ],
    safetyRules: [
      'ตรวจสอบเครื่องชั่งน้ำหนักให้ผ่านการ Calibrate ทุกๆ 30 วัน',
    ],
    kpi: { label: 'ความเร็วในการพิมพ์และติดฉลาก', target: '< 6 วินาที/กล่อง', current: '4.8', unit: 'วินาที' },
    quiz: {
      question: 'ข้อใดคือตำแหน่งที่ถูกต้องในการติดฉลากจัดส่ง (Shipping Label / Waybill) บนกล่องพัสดุ?',
      options: [
        'ติดทับบริเวณมุมกล่องที่มีรอยพับเพื่อให้ดูแน่นหนา',
        'ติดบนพื้นผิวเรียบด้านบนสุดของกล่อง หลีกเลี่ยงรอยต่อเทปกาว เพื่อให้สแกนเนอร์อ่านง่าย',
        'ติดไว้ใต้ก้นกล่องเพื่อความสวยงาม',
      ],
      correctIndex: 1,
      explanation: 'ฉลากต้องติดบนพื้นผิวเรียบ ไม่ย่น ไม่ทับรอยพับหรือรอยเทป เพื่อให้สแกนเนอร์อัตโนมัติและคนขับรถขนส่งสแกนได้ทันทีโดยไม่ติดขัด',
    },
    liveMetrics: { queueCount: 3, hourlyThroughput: 280, status: 'OPTIMAL' },
  },
  {
    id: 9,
    stepNumber: 9,
    titleTh: '9. คัดแยกปลายทาง (Sorting)',
    titleEn: 'Automated Routing & Sorting',
    subtitle: 'กล่องเลื่อนลงรางคัดแยกตามศูนย์กระจายสินค้า',
    area: 'Chute Sorting Area - Sorter Line',
    description: 'กล่องพัสดุเลื่อนต่อตามสายพาน กล้องสแกนเนอร์อ่านบาร์โค้ดใบปะหน้า แขนผลักอัตโนมัติจะคัดแยกกล่องสไลด์ลงราง Chute ประจำจังหวัดปลายทาง เช่น สุราษฎร์ธานี หาดใหญ่ หรือกรุงเทพฯ',
    keyTerms: [
      { term: 'Sorter Chute', meaning: 'รางปล่อยพัสดุลงสู่กระสอบหรือกรงเหล็กตามรหัสปลายทาง' },
      { term: 'Hub Destination', meaning: 'ศูนย์กระจายสินค้าปลายทางของบริษัทขนส่ง' },
    ],
    qcChecklist: [
      'ตรวจสอบพัสดุลงตรงช่อง Hub ปลายทาง ไม่เกิดข้อผิดพลาด Miss-sort',
      'ดูแลไม่ให้กล่องตกลงมากระแทกกันในรางจนเกิดความเสียหาย',
    ],
    safetyRules: [
      'ห้ามยื่นศีรษะหรือมือเข้าไปในบริเวณกลไกแขนผลักคัดแยกพัสดุ',
    ],
    kpi: { label: 'Mis-sort Rate', target: '< 0.05%', current: '0.01', unit: '%' },
    quiz: {
      question: 'หากระบบคัดแยกพัสดุอัตโนมัติอ่านบาร์โค้ดไม่ได้ (No-Read) กล่องพัสดุจะถูกนำส่งไปที่ใดตามขั้นตอน SOP?',
      options: [
        'ทิ้งกล่องลงถังขยะทันที',
        'ส่งเข้าช่องตรวจสอบพิเศษ (Reject/Manual Inspection Chute) เพื่อให้เจ้าหน้าที่ตรวจสอบด้วยมือ',
        'ส่งขึ้นรถคันใดก็ได้ที่ว่างอยู่',
      ],
      correctIndex: 1,
      explanation: 'กล่องที่เกิด No-Read จะถูกส่งเข้า Reject Line เพื่อให้พนักงานทำการตรวจสอบคีย์รหัส หรือพิมพ์ฉลากใหม่ ป้องกันการส่งผิดปลายทาง',
    },
    liveMetrics: { queueCount: 4, hourlyThroughput: 380, status: 'OPTIMAL' },
  },
  {
    id: 10,
    stepNumber: 10,
    titleTh: '10. โหลดขึ้นรถ & จัดส่ง (Dispatch)',
    titleEn: 'Outbound Loading & Fleet Dispatch',
    subtitle: 'พนักงานยกกล่องจากรางโหลดขึ้นรถบรรทุก',
    area: 'Dock 04 - Outbound Bay',
    description: 'พนักงานประจำลานโหลด ยกกล่องพัสดุจากรางคัดแยก เดินโหลดเข้าสู่ตู้รถบรรทุก NEXUS Fleet ตามลำดับการส่งมอบ (LIFO) ล็อคซีลประตูท้ายรถ และกดยืนยันมอบงานขนส่งในระบบ ePOD',
    keyTerms: [
      { term: 'LIFO Loading', meaning: 'สินค้าที่ส่งจุดแรก ต้องโหลดขึ้นรถเป็นลำดับสุดท้าย เพื่อเปิดหยิบง่าย' },
      { term: 'Manifest', meaning: 'ใบกำกับการขนส่งสินค้าแสดงรายการพัสดุทั้งหมดบนคันรถ' },
      { term: 'ePOD', meaning: 'Electronic Proof of Delivery (ระบบยืนยันส่งมอบสินค้าอิเล็กทรอนิกส์)' },
    ],
    qcChecklist: [
      'สแกนบาร์โค้ดยืนยันพัสดุทุกชิ้นขึ้นรถขนส่งตรงตาม Manifest 100%',
      'ใช้บาร์ล็อคกล่อง (Cargo Bar) หรือตาข่ายกั้นเพื่อป้องกันพัสดุล้มระหว่างขับขี่',
      'ล็อคตู้พร้อมบันทึกหมายเลขซีล (Seal Number) ลงในใบนำส่ง',
    ],
    safetyRules: [
      'ตรวจสอบไฟส่องสว่างภายในตู้รถบรรทุกขณะทำการโหลดของ',
      'ขับขี่ปลอดภัย ปฏิบัติตามกฎหมายจราจรและความเร็วที่กำหนดอย่างเคร่งครัด',
    ],
    kpi: { label: 'On-Time Dispatch (OTIF)', target: '≥ 99.0%', current: '99.4', unit: '%' },
    quiz: {
      question: 'หลักการจัดเรียงพัสดุขึ้นรถบรรทุกขนส่งแบบ LIFO (Last-In, First-Out) มีจุดประสงค์หลักเพื่อสิ่งใด?',
      options: [
        'เพื่อให้สินค้าสำหรับลูกค้าจุดแรกสุด อยู่ติดประตูท้ายรถ ทำให้เปิดหยิบส่งได้ทันทีโดยไม่ต้องรื้อของด้านใน',
        'เพื่อให้น้ำหนักรถบรรทุกเทไปด้านหน้าตลอดเวลา',
        'เพื่อความสะดวกของคนโหลดของเท่านั้น',
      ],
      correctIndex: 0,
      explanation: 'LIFO ช่วยลดเวลาจอดส่งของในแต่ละจุดส่งสินค้า คนขับสามารถเปิดท้ายตู้และหยิบส่งมอบได้ทันทีโดยไม่ต้องเสียเวลารื้อค้นสินค้าจุดอื่นๆ',
    },
    liveMetrics: { queueCount: 1, hourlyThroughput: 180, status: 'OPTIMAL' },
  },
];

interface CameraState {
  tx: number;
  tz: number;
  dist: number;
  rotX: number;
  rotY: number;
}

interface CameraTransition {
  from: CameraState;
  to: CameraState;
  startTime: number;
  duration: number;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 1. Industrial Floor Decal: Lies flat on concrete (Zero obstruction to vision!)
function createFloorDecalMesh(station: ProcessStation): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = 'rgba(11, 17, 28, 0.92)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  drawRoundRect(ctx, 4, 4, 376, 92, 16);
  ctx.fill();
  ctx.stroke();

  // Badge Circle
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(48, 50, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(station.stepNumber), 48, 52);

  // Station Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(station.titleTh.replace(/^\d+\.\s*/, ''), 96, 40);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(station.titleEn, 96, 72);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.0), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(station.coords[0], 0.025, station.coords[2] + 1.2);
  return mesh;
}

// 2. Sleek Active Station Floating Callout (Only ONE in the entire scene!)
function updateActiveCalloutSprite(sprite: THREE.Sprite, station: ProcessStation) {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 110;
  const ctx = canvas.getContext('2d')!;

  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = 'rgba(245, 158, 11, 0.96)';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  drawRoundRect(ctx, 8, 8, 424, 94, 20);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Number circle
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(52, 55, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(station.stepNumber), 52, 57);

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(station.titleTh, 102, 44);

  ctx.fillStyle = '#3b1c06';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(station.subtitle, 102, 76);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  sprite.material.map?.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  sprite.scale.set(4.2, 1.05, 1);
  sprite.position.set(station.coords[0], 2.8, station.coords[2]);
}

export default function WarehouseProcessSimulator3D({ branchId = 'URT' }: { branchId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlayingTour, setIsPlayingTour] = useState(false);
  const [tourSpeed, setTourSpeed] = useState<1 | 2 | 5>(1);
  const [activeTab, setActiveTab] = useState<'sop' | 'live' | 'quiz'>('sop');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Camera Mode: OVERVIEW keeps bird's eye view without zooming in! FOCUS zooms into station.
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'FOCUS'>('OVERVIEW');
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  const [showActiveLabel, setShowActiveLabel] = useState(true);

  // Quiz interactive state
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  // Real Layout & Products & Stock from WMS
  const [layout, setLayout] = useState<WarehouseLayout | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [binStockRows, setBinStockRows] = useState<any[]>([]);
  const [loadingLayout, setLoadingLayout] = useState(true);

  // Fetch actual layout and per-bin stock
  const loadWarehouseData = useCallback(() => {
    setLoadingLayout(true);
    Promise.all([
      fetch(getApiUrl(`/api/warehouse/layout?branchId=${encodeURIComponent(branchId)}`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(getApiUrl('/api/products'))
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(getApiUrl('/api/warehouse/bin-stock'))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([layoutRes, prodsRes, stockRes]) => {
        if (layoutRes?.success && layoutRes.data) {
          setLayout(layoutRes.data);
        }
        if (Array.isArray(prodsRes)) {
          setProducts(prodsRes);
        }
        if (stockRes?.success && Array.isArray(stockRes.rows)) {
          setBinStockRows(stockRes.rows);
        }
      })
      .finally(() => {
        setLoadingLayout(false);
      });
  }, [branchId]);

  useEffect(() => {
    loadWarehouseData();
  }, [loadWarehouseData]);

  // Map products and bin quantities
  const binDataMap = useMemo(() => {
    const map = new Map<string, { products: any[]; totalStock: number; status: string }>();

    // 1. From products.location
    products.forEach((p) => {
      const loc = String(p.location || 'UNASSIGNED').trim().toUpperCase();
      if (!map.has(loc)) {
        map.set(loc, { products: [], totalStock: 0, status: 'NORMAL' });
      }
      const entry = map.get(loc)!;
      entry.products.push(p);
      entry.totalStock += Number(p.stock || 0);
      if (entry.totalStock <= 5) entry.status = 'LOW_STOCK';
    });

    // 2. From binStock rows (if available)
    binStockRows.forEach((r) => {
      const loc = String(r.binCode || '').trim().toUpperCase();
      if (!loc) return;
      if (!map.has(loc)) {
        map.set(loc, { products: [], totalStock: 0, status: 'NORMAL' });
      }
      const entry = map.get(loc)!;
      entry.totalStock += Number(r.quantity || 0);
      const prod = products.find((p) => p.sku === r.sku || p.id === r.sku);
      if (prod && !entry.products.some((x) => x.id === prod.id)) {
        entry.products.push(prod);
      }
      if (entry.totalStock <= 5) entry.status = 'LOW_STOCK';
    });

    return map;
  }, [products, binStockRows]);

  // Compute warehouse boundaries and logical station waypoints
  const { floorWidth, floorLength, stations } = useMemo(() => {
    const rawRacks = layout?.racks || [];
    let minX = -16;
    let maxX = 16;
    let minZ = -16;
    let maxZ = 16;

    if (rawRacks.length > 0) {
      rawRacks.forEach((r) => {
        const halfLen = (r.bays * (r.bayWidth || 2.5)) / 2;
        minX = Math.min(minX, r.posX - halfLen - 2);
        maxX = Math.max(maxX, r.posX + halfLen + 2);
        minZ = Math.min(minZ, r.posZ - (r.rackDepth || 2) - 2);
        maxZ = Math.max(maxZ, r.posZ + (r.rackDepth || 2) + 6);
      });
    }

    const calculatedWidth = Math.max(layout?.widthM || 36, maxX - minX + 16, 42);
    const calculatedLength = Math.max(layout?.lengthM || 44, maxZ - minZ + 18, 48);

    const dockZ = Math.min(18, calculatedLength / 2 - 4);
    const inDockX = -calculatedWidth / 2 + 5;
    const outDockX = calculatedWidth / 2 - 5;

    let putawayX = rawRacks[0]?.posX ?? -6;
    let putawayZ = rawRacks[0]?.posZ ?? -4;
    let pickingX = rawRacks[rawRacks.length - 1]?.posX ?? 6;
    let pickingZ = rawRacks[rawRacks.length - 1]?.posZ ?? -4;

    const conveyorZ = 6.5;

    const dynamicStations: ProcessStation[] = BASE_PROCESS_STATIONS.map((base) => {
      let coords: [number, number, number];
      switch (base.id) {
        case 1:
          coords = [inDockX, 1.2, dockZ];
          break;
        case 2:
          coords = [inDockX + 7, 1.2, dockZ - 3];
          break;
        case 3:
          coords = [putawayX, 2.2, putawayZ];
          break;
        case 4:
          coords = [0, 1.4, 2.5];
          break;
        case 5:
          coords = [pickingX, 1.2, pickingZ];
          break;
        case 6:
          coords = [-4, 1.2, conveyorZ];
          break;
        case 7:
          coords = [4, 1.2, conveyorZ];
          break;
        case 8:
          coords = [10, 1.2, conveyorZ];
          break;
        case 9:
          coords = [15, 1.2, conveyorZ - 2];
          break;
        case 10:
          coords = [outDockX, 1.2, dockZ];
          break;
        default:
          coords = [0, 1.2, 0];
      }

      return {
        ...base,
        coords,
      };
    });

    return {
      floorWidth: calculatedWidth,
      floorLength: calculatedLength,
      stations: dynamicStations,
    };
  }, [layout]);

  const currentStation = stations[currentStepIdx] || stations[0];

  // Three.js runtime references
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    parcelMesh: THREE.Group;
    activeCalloutSprite: THREE.Sprite;
    stationPins: THREE.Group[];
    stationBeacons: THREE.Mesh[];
    inboundWorkerGroup: THREE.Group;
    forkliftGroup: THREE.Group;
    pickerWorkerGroup: THREE.Group;
    outboundLoaderGroup: THREE.Group;
    cam: CameraState;
    camTransition: CameraTransition | null;
    applyCamera: () => void;
  } | null>(null);

  // Web Audio chime synthesizer
  const playChime = useCallback(
    (type: 'step' | 'correct' | 'wrong') => {
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
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
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

  // Station navigation handler
  const goToStation = useCallback(
    (idx: number, forceCameraMove = false) => {
      const nextIdx = Math.max(0, Math.min(stations.length - 1, idx));
      setCurrentStepIdx(nextIdx);
      setSelectedQuizAnswer(null);
      playChime('step');

      if (!threeRef.current) return;
      const t = threeRef.current;
      const targetStation = stations[nextIdx];

      // Update the SINGLE active station floating callout
      updateActiveCalloutSprite(t.activeCalloutSprite, targetStation);

      // Update pins highlight
      t.stationPins.forEach((pin, i) => {
        const isAct = i === nextIdx;
        const sphere = pin.children[1] as THREE.Mesh;
        if (sphere && sphere.material) {
          (sphere.material as THREE.MeshStandardMaterial).color.setHex(isAct ? 0xf59e0b : 0x0284c7);
          (sphere.material as THREE.MeshStandardMaterial).emissive.setHex(isAct ? 0xd97706 : 0x0369a1);
        }
        pin.scale.setScalar(isAct ? 1.25 : 1.0);
      });

      // In Overview mode: Keep user's wide view!
      if (viewMode === 'OVERVIEW' && !forceCameraMove) {
        return;
      }

      // In Focus Mode: smoothly fly to the target station
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
        duration: 900,
      };
    },
    [stations, viewMode, playChime]
  );

  // Camera presets
  const setCameraOverview = useCallback(() => {
    setViewMode('OVERVIEW');
    if (!threeRef.current) return;
    const t = threeRef.current;
    const overviewDist = Math.max(52, Math.max(floorWidth, floorLength) * 1.15);

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
      duration: 1000,
    };
  }, [floorWidth, floorLength]);

  const setCameraFocus = useCallback(() => {
    setViewMode('FOCUS');
    goToStation(currentStepIdx, true);
  }, [currentStepIdx, goToStation]);

  const resetCamera = useCallback(() => {
    if (viewMode === 'OVERVIEW') {
      setCameraOverview();
    } else {
      setCameraFocus();
    }
  }, [viewMode, setCameraOverview, setCameraFocus]);

  // Toggle active callout sprite visibility
  useEffect(() => {
    if (threeRef.current) {
      threeRef.current.activeCalloutSprite.visible = showActiveLabel;
    }
  }, [showActiveLabel]);

  // Auto-tour timer
  useEffect(() => {
    if (!isPlayingTour) return;
    const intervalMs = 6000 / tourSpeed;
    const timer = setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev >= stations.length - 1) {
          setIsPlayingTour(false);
          return 0;
        }
        const next = prev + 1;
        goToStation(next, viewMode === 'FOCUS');
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlayingTour, tourSpeed, stations.length, viewMode, goToStation]);

  // Three.js 3D Virtual Facility Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e17);
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.009);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 400);

    const initialDist = Math.max(52, Math.max(floorWidth, floorLength) * 1.15);
    const cam: CameraState = {
      tx: 0,
      tz: 2,
      dist: initialDist,
      rotX: 0.72,
      rotY: 0.45,
    };

    const applyCamera = () => {
      cam.dist = Math.max(8, Math.min(150, cam.dist));
      cam.rotX = Math.max(0.12, Math.min(Math.PI / 2.05, cam.rotX));
      camera.position.set(
        cam.tx + cam.dist * Math.sin(cam.rotY) * Math.cos(cam.rotX),
        cam.dist * Math.sin(cam.rotX),
        cam.tz + cam.dist * Math.cos(cam.rotY) * Math.cos(cam.rotX)
      );
      camera.lookAt(cam.tx, 1.2, cam.tz);
    };
    applyCamera();

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.replaceChildren(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7e6, 1.5);
    dirLight.position.set(30, 60, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    const sDim = Math.max(floorWidth, floorLength) * 0.75;
    dirLight.shadow.camera.left = -sDim;
    dirLight.shadow.camera.right = sDim;
    dirLight.shadow.camera.top = sDim;
    dirLight.shadow.camera.bottom = -sDim;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const blueFillLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    blueFillLight.position.set(-35, 30, -30);
    scene.add(blueFillLight);

    // 4. Warehouse Floor with Industrial Markings
    const floorGeo = new THREE.PlaneGeometry(floorWidth, floorLength);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.65,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(
      Math.max(floorWidth, floorLength),
      Math.round(Math.max(floorWidth, floorLength) / 2),
      0x1e293b,
      0x0f172a
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Safety perimeter lines
    const borderMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
    const borderGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-floorWidth / 2 + 1.5, 0.04, -floorLength / 2 + 1.5),
      new THREE.Vector3(floorWidth / 2 - 1.5, 0.04, -floorLength / 2 + 1.5),
      new THREE.Vector3(floorWidth / 2 - 1.5, 0.04, floorLength / 2 - 1.5),
      new THREE.Vector3(-floorWidth / 2 + 1.5, 0.04, floorLength / 2 - 1.5),
      new THREE.Vector3(-floorWidth / 2 + 1.5, 0.04, -floorLength / 2 + 1.5),
    ]);
    const perimeterLine = new THREE.Line(borderGeo, borderMat);
    scene.add(perimeterLine);

    // 5. Walls & Dock Doors
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.85 });
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

    const dockZ = Math.min(18, floorLength / 2 - 4);
    const inDoor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 6), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
    inDoor.position.set(-floorWidth / 2 + 0.4, 2.75, dockZ);
    scene.add(inDoor);

    const outDoor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 6), new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.4 }));
    outDoor.position.set(floorWidth / 2 - 0.4, 2.75, dockZ);
    scene.add(outDoor);

    // 6. Transport Trucks (NEXUS Fleet)
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

    // 7. BUILD ACCURATE RACKS & REAL FLOOR-BLOCK GOODS
    const steelPostMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 });
    const stockOkMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 });
    const stockLowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
    const emptySlotMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, transparent: true, opacity: 0.35 });

    const rawRacks = layout?.racks || [];

    const buildFullRack = (rack: RackConfig) => {
      const rackGroup = new THREE.Group();
      rackGroup.position.set(rack.posX, 0, rack.posZ);
      rackGroup.rotation.y = rack.rotationY || 0;

      const totalRackLength = rack.bays * (rack.bayWidth || 2.8);
      const isFloor = rack.type === 'CROSS_DOCK' || rack.type === 'FLOOR_BLOCK';
      const layerH = Math.max(0.4, Number(rack.levelHeight) || 0.6);
      const totalRackHeight = isFloor ? rack.levels * layerH : rack.levels * (rack.levelHeight || 1.8) + 0.3;

      if (isFloor) {
        // Floor block pad
        const padGeo = new THREE.PlaneGeometry(totalRackLength, rack.rackDepth || 3);
        const padMat = new THREE.MeshStandardMaterial({
          color: rack.type === 'CROSS_DOCK' ? 0x241d08 : 0x0f1c24,
          roughness: 0.9,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.rotation.x = -Math.PI / 2;
        padMesh.position.set(0, 0.03, 0);
        padMesh.receiveShadow = true;
        rackGroup.add(padMesh);

        // Floor border lines
        const floorBorderMat = new THREE.LineBasicMaterial({
          color: rack.type === 'CROSS_DOCK' ? 0xfacc15 : 0x4cd7f6,
          linewidth: 2,
        });
        const floorBorderGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-totalRackLength / 2, 0.04, -rack.rackDepth / 2),
          new THREE.Vector3(totalRackLength / 2, 0.04, -rack.rackDepth / 2),
          new THREE.Vector3(totalRackLength / 2, 0.04, rack.rackDepth / 2),
          new THREE.Vector3(-totalRackLength / 2, 0.04, rack.rackDepth / 2),
          new THREE.Vector3(-totalRackLength / 2, 0.04, -rack.rackDepth / 2),
        ]);
        const floorBorderLine = new THREE.Line(floorBorderGeo, floorBorderMat);
        rackGroup.add(floorBorderLine);

        // Floor Block bulk pallets and actual stock
        for (let b = 1; b <= rack.bays; b++) {
          const binCode = binCodeFor(rack, b, 1) || `${rack.rackCode}-${b}`;
          const binData = binDataMap.get(binCode.toUpperCase()) || binDataMap.get(binCode);
          const hasStock = !!(binData && binData.totalStock > 0);
          const xPos = -totalRackLength / 2 + (b - 0.5) * (rack.bayWidth || 2.8);

          const pallet = new THREE.Mesh(new THREE.BoxGeometry((rack.bayWidth || 2.8) * 0.88, 0.12, (rack.rackDepth || 3) * 0.88), woodMat);
          pallet.position.set(xPos, 0.08, 0);
          pallet.receiveShadow = true;
          rackGroup.add(pallet);

          const cargoMat = hasStock ? (binData.status === 'LOW_STOCK' ? stockLowMat : stockOkMat) : new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
          const bulkBox = new THREE.Mesh(new THREE.BoxGeometry((rack.bayWidth || 2.8) * 0.82, 0.9, (rack.rackDepth || 3) * 0.82), cargoMat);
          bulkBox.position.set(xPos, 0.58, 0);
          bulkBox.castShadow = true;
          bulkBox.receiveShadow = true;
          rackGroup.add(bulkBox);
        }
      } else {
        // Vertical Steel Uprights
        const postGeo = new THREE.BoxGeometry(0.12, totalRackHeight, 0.12);
        for (let b = 0; b <= rack.bays; b++) {
          const xPos = -totalRackLength / 2 + b * (rack.bayWidth || 2.8);
          [-rack.rackDepth / 2, rack.rackDepth / 2].forEach((zPos) => {
            const post = new THREE.Mesh(postGeo, steelPostMat);
            post.position.set(xPos, totalRackHeight / 2, zPos);
            post.castShadow = true;
            rackGroup.add(post);
          });
        }

        // Horizontal Beams & Individual Shelf Bins
        const beamGeo = new THREE.BoxGeometry(totalRackLength, 0.1, 0.08);
        for (let lvl = 1; lvl <= rack.levels; lvl++) {
          const y = lvl * (rack.levelHeight || 1.8);
          [-rack.rackDepth / 2, rack.rackDepth / 2].forEach((zPos) => {
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(0, y, zPos);
            rackGroup.add(beam);
          });

          const deck = new THREE.Mesh(new THREE.BoxGeometry(totalRackLength, 0.04, rack.rackDepth + 0.04), woodMat);
          deck.position.set(0, y + 0.06, 0);
          deck.receiveShadow = true;
          rackGroup.add(deck);

          for (let bay = 1; bay <= rack.bays; bay++) {
            const binCode = binCodeFor(rack, bay, lvl);
            if (!binCode) continue;

            const binData = binDataMap.get(binCode.toUpperCase()) || binDataMap.get(binCode);
            const hasStock = !!(binData && binData.totalStock > 0);
            const xPos = -totalRackLength / 2 + (bay - 0.5) * (rack.bayWidth || 2.8);

            const boxW = (rack.bayWidth || 2.8) * 0.86;
            const boxH = Math.min(1.0, (rack.levelHeight || 1.8) * 0.65);
            const boxD = rack.rackDepth * 0.86;

            if (hasStock) {
              const mat = binData.status === 'LOW_STOCK' ? stockLowMat : stockOkMat;
              const stockBox = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), mat);
              stockBox.position.set(xPos, y + 0.08 + boxH / 2, 0);
              stockBox.castShadow = true;
              stockBox.receiveShadow = true;
              rackGroup.add(stockBox);
            } else {
              const emptyBox = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), emptySlotMat);
              emptyBox.position.set(xPos, y + 0.08 + boxH / 2, 0);
              rackGroup.add(emptyBox);
            }
          }
        }
      }

      scene.add(rackGroup);
    };

    if (rawRacks.length > 0) {
      rawRacks.forEach(buildFullRack);
    } else {
      const defaultRacks: RackConfig[] = [
        { rackCode: 'Aisle-A', zoneCode: 'A', posX: -8, posZ: -8, rotationY: 0, bays: 4, levels: 3, bayWidth: 2.8, levelHeight: 1.8, rackDepth: 1.4 },
        { rackCode: 'Aisle-B', zoneCode: 'B', posX: 8, posZ: -8, rotationY: 0, bays: 4, levels: 3, bayWidth: 2.8, levelHeight: 1.8, rackDepth: 1.4 },
        { rackCode: 'Bulk-1', zoneCode: 'BULK', posX: 0, posZ: -12, rotationY: 0, bays: 2, levels: 1, bayWidth: 3.5, levelHeight: 0.5, rackDepth: 4.0, type: 'FLOOR_BLOCK' },
      ];
      defaultRacks.forEach(buildFullRack);
    }

    // 8. Control Tower Terminal (Station 4)
    const deskGroup = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 }));
    desk.position.set(stations[3].coords[0], 0.45, stations[3].coords[2]);
    desk.castShadow = true;
    deskGroup.add(desk);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.7 })
    );
    screen.position.set(stations[3].coords[0], 1.25, stations[3].coords[2] + 0.3);
    deskGroup.add(screen);
    scene.add(deskGroup);

    // 9. Motorized Roller Conveyor
    const conveyorGroup = new THREE.Group();
    const conveyorFrameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

    const cZ = stations[5].coords[2];
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 0.08), conveyorFrameMat);
    rail1.position.set(5.5, 0.9, cZ - 0.55);
    conveyorGroup.add(rail1);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 0.08), conveyorFrameMat);
    rail2.position.set(5.5, 0.9, cZ + 0.55);
    conveyorGroup.add(rail2);

    for (let rx = -5.2; rx <= 16.2; rx += 0.4) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 12), rollerMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(rx, 0.9, cZ);
      roller.castShadow = true;
      conveyorGroup.add(roller);
    }

    for (let lx = -4.5; lx <= 15.5; lx += 5) {
      [-0.5, 0.5].forEach((lz) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), conveyorFrameMat);
        leg.position.set(lx, 0.45, cZ + lz);
        conveyorGroup.add(leg);
      });
    }
    scene.add(conveyorGroup);

    // 10. Packing Station Table (Station 7)
    const packTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }));
    packTable.position.set(stations[6].coords[0], 0.45, stations[6].coords[2] + 1.8);
    packTable.castShadow = true;
    scene.add(packTable);

    // 11. Scale Pad (Station 8)
    const scalePad = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7, roughness: 0.2 }));
    scalePad.position.set(stations[7].coords[0], 0.94, cZ);
    scene.add(scalePad);

    // 12. Sorting Chutes (Station 9)
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    [14, 17].forEach((cx, idx) => {
      const chute = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 2.5), chuteMat);
      chute.rotation.x = -Math.PI / 6;
      chute.position.set(cx, 0.6, cZ - 2 - idx * 1.8);
      scene.add(chute);
    });

    // 13. QC Table (Station 2)
    const qcTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
    qcTable.position.set(stations[1].coords[0], 0.45, stations[1].coords[2]);
    qcTable.castShadow = true;
    scene.add(qcTable);

    // 14. ELEGANT, UNCLUTTERED LABELS:
    // A) Flat Floor Markings (Zero vision obstruction!)
    // B) Minimal Glowing 3D Pins (Slim mast + glowing coin)
    // C) SINGLE Active Floating Callout (Only for current active station)
    const stationPins: THREE.Group[] = [];
    const stationBeacons: THREE.Mesh[] = [];

    stations.forEach((s, idx) => {
      // Flat Floor Decal
      const floorDecal = createFloorDecalMesh(s);
      scene.add(floorDecal);

      // Compact Minimal 3D Pin
      const pinGroup = new THREE.Group();
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8), mastMat);
      mast.position.set(s.coords[0], 0.75, s.coords[2]);
      pinGroup.add(mast);

      // Top Number Coin
      const isAct = idx === currentStepIdx;
      const coinMat = new THREE.MeshStandardMaterial({
        color: isAct ? 0xf59e0b : 0x0284c7,
        emissive: isAct ? 0xd97706 : 0x0369a1,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      });
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), coinMat);
      coin.position.set(s.coords[0], 1.6, s.coords[2]);
      pinGroup.add(coin);

      pinGroup.userData = { stationId: s.id };
      scene.add(pinGroup);
      stationPins.push(pinGroup);

      // Glowing circular floor beacon
      const beaconGeo = new THREE.RingGeometry(0.7, 1.0, 32);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: isAct ? 0xf59e0b : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isAct ? 0.85 : 0.3,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.rotation.x = -Math.PI / 2;
      beacon.position.set(s.coords[0], 0.03, s.coords[2]);
      scene.add(beacon);
      stationBeacons.push(beacon);
    });

    // SINGLE Active Floating Callout Sprite
    const dummySpriteMat = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
    const activeCalloutSprite = new THREE.Sprite(dummySpriteMat);
    updateActiveCalloutSprite(activeCalloutSprite, stations[currentStepIdx] || stations[0]);
    scene.add(activeCalloutSprite);

    // 15. PHYSICAL HANDOVER ACTORS & WORKERS
    const createWorkerModel = (vestColor = 0x10b981) => {
      const worker = new THREE.Group();
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8 });
      const vestMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.4 });
      const helmetMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), vestMat);
      torso.position.set(0, 1.05, 0);
      torso.castShadow = true;
      worker.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skinMat);
      head.position.set(0, 1.55, 0);
      worker.add(head);

      const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), helmetMat);
      helmet.position.set(0, 1.7, 0);
      worker.add(helmet);

      [-0.14, 0.14].forEach((lx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), pantsMat);
        leg.position.set(lx, 0.35, 0);
        leg.castShadow = true;
        worker.add(leg);
      });
      return worker;
    };

    // A. Inbound Worker with Pallet Jack (Dock 1 -> QC)
    const inboundWorkerGroup = new THREE.Group();
    const inWorker = createWorkerModel(0x10b981);
    inWorker.position.set(0, 0, -0.6);
    inboundWorkerGroup.add(inWorker);

    const jackMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5 });
    const jackFork = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.2), jackMat);
    jackFork.position.set(0, 0.12, 0.4);
    inboundWorkerGroup.add(jackFork);
    inboundWorkerGroup.position.set(stations[0].coords[0], 0, stations[0].coords[2]);
    scene.add(inboundWorkerGroup);

    // B. Putaway Forklift (QC -> Rack Aisle)
    const forkliftGroup = new THREE.Group();
    const forkBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const fBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 2.2), forkBodyMat);
    fBody.position.set(0, 0.9, 0);
    fBody.castShadow = true;
    forkliftGroup.add(fBody);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.12), mastMat);
    mast.position.set(0, 1.5, 1.15);
    forkliftGroup.add(mast);

    const fForks = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.2), mastMat);
    fForks.position.set(0, 0.4, 1.7);
    forkliftGroup.add(fForks);

    forkliftGroup.position.set(stations[1].coords[0] + 4, 0, stations[1].coords[2]);
    scene.add(forkliftGroup);

    // C. Order Picker Worker with Cart (Racks -> Conveyor)
    const pickerWorkerGroup = new THREE.Group();
    const pWorker = createWorkerModel(0x0284c7);
    pWorker.position.set(0, 0, -0.7);
    pickerWorkerGroup.add(pWorker);

    const cartMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 1.2), cartMat);
    cart.position.set(0, 0.6, 0.3);
    cart.castShadow = true;
    pickerWorkerGroup.add(cart);

    pickerWorkerGroup.position.set(stations[4].coords[0], 0, stations[4].coords[2]);
    scene.add(pickerWorkerGroup);

    // D. Outbound Loader Worker (Chute -> Dock 4 Truck)
    const outboundLoaderGroup = new THREE.Group();
    const oWorker = createWorkerModel(0x10b981);
    outboundLoaderGroup.add(oWorker);
    outboundLoaderGroup.position.set(stations[8].coords[0], 0, stations[8].coords[2]);
    scene.add(outboundLoaderGroup);

    // 16. THE GOLDEN FLOWING PARCEL
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

    const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.66, 0.15), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    parcelGroup.add(ribbon1);

    const haloGeo = new THREE.RingGeometry(0.5, 0.75, 24);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.32;
    parcelGroup.add(halo);

    const initialStation = stations[0];
    parcelGroup.position.set(initialStation.coords[0], initialStation.coords[1], initialStation.coords[2]);
    scene.add(parcelGroup);

    // Save Three context
    threeRef.current = {
      scene,
      camera,
      renderer,
      parcelMesh: parcelGroup,
      activeCalloutSprite,
      stationPins,
      stationBeacons,
      inboundWorkerGroup,
      forkliftGroup,
      pickerWorkerGroup,
      outboundLoaderGroup,
      cam,
      camTransition: null,
      applyCamera,
    };

    // 17. Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (threeRef.current) {
        const {
          camera,
          cam,
          camTransition,
          parcelMesh,
          activeCalloutSprite,
          stationBeacons,
          inboundWorkerGroup,
          forkliftGroup,
          pickerWorkerGroup,
          outboundLoaderGroup,
        } = threeRef.current;

        // Smooth Camera Glide
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
        } else if (isAutoRotate) {
          cam.rotY += 0.002 * (tourSpeed || 1);
          applyCamera();
        }

        // PHYSICAL HANDOVER ANIMATION
        const st = currentStepIdx;

        // Step 1 -> 2: Inbound Worker walks with goods from Truck to QC Table
        if (st === 0) {
          inboundWorkerGroup.position.x = THREE.MathUtils.lerp(inboundWorkerGroup.position.x, stations[0].coords[0], 0.06);
          inboundWorkerGroup.position.z = THREE.MathUtils.lerp(inboundWorkerGroup.position.z, stations[0].coords[2], 0.06);
        } else if (st === 1) {
          inboundWorkerGroup.position.x = THREE.MathUtils.lerp(inboundWorkerGroup.position.x, stations[1].coords[0], 0.06);
          inboundWorkerGroup.position.z = THREE.MathUtils.lerp(inboundWorkerGroup.position.z, stations[1].coords[2] + 1.2, 0.06);
        }

        // Step 3: Putaway Forklift carries pallet from QC to Storage Rack
        if (st === 2) {
          forkliftGroup.position.x = THREE.MathUtils.lerp(forkliftGroup.position.x, stations[2].coords[0], 0.05);
          forkliftGroup.position.z = THREE.MathUtils.lerp(forkliftGroup.position.z, stations[2].coords[2] + 2.5, 0.05);
        } else {
          forkliftGroup.position.x = THREE.MathUtils.lerp(forkliftGroup.position.x, stations[1].coords[0] + 4, 0.04);
          forkliftGroup.position.z = THREE.MathUtils.lerp(forkliftGroup.position.z, stations[1].coords[2], 0.04);
        }

        // Step 5 -> 6: Picker walks with cart from Rack to Conveyor Feed
        if (st === 4) {
          pickerWorkerGroup.position.x = THREE.MathUtils.lerp(pickerWorkerGroup.position.x, stations[4].coords[0], 0.06);
          pickerWorkerGroup.position.z = THREE.MathUtils.lerp(pickerWorkerGroup.position.z, stations[4].coords[2], 0.06);
        } else if (st === 5) {
          pickerWorkerGroup.position.x = THREE.MathUtils.lerp(pickerWorkerGroup.position.x, stations[5].coords[0] - 1.2, 0.06);
          pickerWorkerGroup.position.z = THREE.MathUtils.lerp(pickerWorkerGroup.position.z, stations[5].coords[2] + 1.0, 0.06);
        }

        // Step 9 -> 10: Outbound Loader walks with box from Sorting Chute to Outbound Truck
        if (st === 8) {
          outboundLoaderGroup.position.x = THREE.MathUtils.lerp(outboundLoaderGroup.position.x, stations[8].coords[0], 0.06);
          outboundLoaderGroup.position.z = THREE.MathUtils.lerp(outboundLoaderGroup.position.z, stations[8].coords[2], 0.06);
        } else if (st === 9) {
          outboundLoaderGroup.position.x = THREE.MathUtils.lerp(outboundLoaderGroup.position.x, stations[9].coords[0] - 1.5, 0.06);
          outboundLoaderGroup.position.z = THREE.MathUtils.lerp(outboundLoaderGroup.position.z, stations[9].coords[2], 0.06);
        }

        // Smooth Parcel Flow
        parcelMesh.rotation.y = elapsed * 0.8;
        const targetCoords = (stations[currentStepIdx] || stations[0]).coords;
        parcelMesh.position.x = THREE.MathUtils.lerp(parcelMesh.position.x, targetCoords[0], 0.08);
        parcelMesh.position.y = THREE.MathUtils.lerp(parcelMesh.position.y, targetCoords[1], 0.08);
        parcelMesh.position.z = THREE.MathUtils.lerp(parcelMesh.position.z, targetCoords[2], 0.08);

        // Active Callout subtle floating breath
        activeCalloutSprite.position.y = 2.8 + Math.sin(elapsed * 2.5) * 0.08;

        // Active Beacon Ring pulse
        stationBeacons.forEach((beacon, i) => {
          if (i === currentStepIdx) {
            beacon.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.22);
            (beacon.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0.85;
          } else {
            beacon.scale.setScalar(1.0);
            (beacon.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
            (beacon.material as THREE.MeshBasicMaterial).opacity = 0.30;
          }
        });

        renderer.render(scene, camera);
      }
    };
    animate();

    // 18. Window resize handler
    const handleResize = () => {
      if (!containerRef.current || !threeRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 19. Interactive Click on 3D Pins (Raycaster)
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
            goToStation(stIdx, true);
            return;
          }
          obj = obj.parent;
        }
      }
    };
    container.addEventListener('click', handleClick);

    // 20. Rock-Solid Camera Controls
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

      const { cam, applyCamera } = threeRef.current;

      if (isPanning) {
        const k = cam.dist * 0.0016;
        const rightX = Math.cos(cam.rotY);
        const rightZ = -Math.sin(cam.rotY);
        const fwdX = -Math.sin(cam.rotY);
        const fwdZ = -Math.cos(cam.rotY);
        cam.tx += (-dx * rightX + dy * fwdX) * k;
        cam.tz += (-dx * rightZ + dy * fwdZ) * k;
      } else {
        cam.rotY -= dx * 0.008;
        cam.rotX = Math.max(0.12, Math.min(Math.PI / 2.05, cam.rotX + dy * 0.008));
      }

      applyCamera();
    };

    const onPointerUp = (e: PointerEvent) => {
      isPointerDown = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onWheel = (e: WheelEvent) => {
      if (!threeRef.current) return;
      e.preventDefault();
      threeRef.current.camTransition = null;

      const { cam, applyCamera } = threeRef.current;
      cam.dist *= Math.exp(e.deltaY * 0.0012);
      applyCamera();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
    };
  }, [floorWidth, floorLength, stations, currentStepIdx, isAutoRotate, tourSpeed, goToStation, binDataMap]);

  // Quiz submission
  const handleAnswerQuiz = (optionIdx: number) => {
    if (selectedQuizAnswer !== null) return;
    setSelectedQuizAnswer(optionIdx);
    setAnsweredCount((prev) => prev + 1);

    if (optionIdx === currentStation.quiz.correctIndex) {
      setQuizScore((prev) => prev + 10);
      playChime('correct');
    } else {
      playChime('wrong');
    }
  };

  return (
    <div className="w-full flex flex-col xl:flex-row gap-4 h-auto xl:h-[760px]">
      {/* 1. LEFT COCKPIT: SOP Details, Live Metrics & Training Quiz */}
      <div className="w-full xl:w-[460px] flex flex-col bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl overflow-hidden order-2 xl:order-1">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-xs">
              {currentStation.stepNumber}
            </span>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                ขั้นตอนที่ {currentStation.stepNumber} / 10
              </span>
              <h2 className="text-base font-black text-white">{currentStation.titleTh}</h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {currentStation.area}
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 mb-4">
          <button
            onClick={() => setActiveTab('sop')}
            className={cn(
              'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'sop' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            SOP Guide
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={cn(
              'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === 'live' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Data
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={cn(
              'py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative',
              activeTab === 'quiz' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Quiz ทดสอบ
            {answeredCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-emerald-500 text-slate-950 rounded-full text-[9px] font-black">
                {quizScore}
              </span>
            )}
          </button>
        </div>

        {/* Cockpit Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs select-none">
          {activeTab === 'sop' && (
            <div className="space-y-4">
              {/* Description */}
              <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-slate-300 leading-relaxed">
                <span className="font-bold text-amber-400 block mb-1">มาตรฐานการปฏิบัติงาน & การส่งต่องาน:</span>
                {currentStation.description}
              </div>

              {/* Key Terminology */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  คำศัพท์ประจำสถานี (Key Terms):
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {currentStation.keyTerms.map((k, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-2">
                      <span className="font-mono font-black text-amber-400 shrink-0 text-[11px]">{k.term}:</span>
                      <span className="text-slate-300 text-[11px]">{k.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QC Checklist */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 text-emerald-200">
                <div className="flex items-center gap-1.5 font-black text-emerald-400 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>QC Inspection Checklist (เกณฑ์คุณภาพ)</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc marker:text-emerald-500 text-[11px] text-emerald-100/90">
                  {currentStation.qcChecklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Safety Rules */}
              <div className="p-3.5 rounded-2xl bg-rose-950/25 border border-rose-500/30 text-rose-200">
                <div className="flex items-center gap-1.5 font-black text-rose-400 mb-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Safety Precautions (ความปลอดภัย)</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc marker:text-rose-500 text-[11px] text-rose-100/90">
                  {currentStation.safetyRules.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">คิวงานรอดำเนินการ</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-mono text-amber-400">{currentStation.liveMetrics.queueCount}</span>
                    <span className="text-xs text-slate-400">รายการ</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold mt-1 block">สถานะ: {currentStation.liveMetrics.status}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Throughput รายชั่วโมง</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-mono text-cyan-400">{currentStation.liveMetrics.hourlyThroughput}</span>
                    <span className="text-xs text-slate-400">ชิ้น/ชม.</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">กำลังการผลิตปัจจุบัน</span>
                </div>
              </div>

              {/* Target KPI Strip */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-xs">{currentStation.kpi.label}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    เป้าหมาย: {currentStation.kpi.target}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono text-white">{currentStation.kpi.current}</span>
                  <span className="text-xs text-slate-400">{currentStation.kpi.unit}</span>
                </div>
              </div>

              {/* Real products in storage sample */}
              {products.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    สินค้าจริงในคลังสาขานี้ ({products.length} SKUs):
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {products.slice(0, 6).map((p) => (
                      <div key={p.id} className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-[11px]">
                        <span className="text-slate-200 font-bold truncate max-w-[200px]">{p.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-amber-400 font-bold">{p.location || 'Unassigned'}</span>
                          <span className="text-slate-400 font-mono">{p.stock} ชิ้น</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">คะแนนการทดสอบ SOP</span>
                  <span className="text-xl font-black text-amber-400 font-mono">{quizScore} / 100</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block">ทำแล้ว</span>
                  <span className="text-xs text-slate-200 font-bold">{answeredCount} จาก 10 ข้อ</span>
                </div>
              </div>

              {/* Question Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2 inline-block">
                  คำถามประจำขั้นตอนที่ {currentStation.stepNumber}
                </span>
                <p className="text-sm font-bold text-white leading-relaxed mt-1">
                  {currentStation.quiz.question}
                </p>

                {/* Option Buttons */}
                <div className="space-y-2 mt-4">
                  {currentStation.quiz.options.map((opt, oIdx) => {
                    const isSelected = selectedQuizAnswer === oIdx;
                    const isCorrect = oIdx === currentStation.quiz.correctIndex;
                    let btnStyle = 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700';

                    if (selectedQuizAnswer !== null) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-600/30 text-emerald-200 border-emerald-500/80 font-bold';
                      } else if (isSelected) {
                        btnStyle = 'bg-rose-600/30 text-rose-200 border-rose-500/80 font-bold';
                      } else {
                        btnStyle = 'bg-slate-900 text-slate-500 border-slate-800 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleAnswerQuiz(oIdx)}
                        disabled={selectedQuizAnswer !== null}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5',
                          btnStyle
                        )}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-700/80 text-white font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                {selectedQuizAnswer !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'mt-4 p-3 rounded-xl border text-xs',
                      selectedQuizAnswer === currentStation.quiz.correctIndex
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    )}
                  >
                    <span className="font-bold block mb-1">
                      {selectedQuizAnswer === currentStation.quiz.correctIndex ? '✅ ถูกต้องตามมาตรฐาน SOP!' : '❌ ยังไม่ถูกต้องตาม SOP:'}
                    </span>
                    <p className="text-[11px] leading-relaxed opacity-95">{currentStation.quiz.explanation}</p>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step Navigation Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 mt-auto">
          <button
            onClick={() => goToStation(currentStepIdx - 1, viewMode === 'FOCUS')}
            disabled={currentStepIdx === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> ก่อนหน้า
          </button>
          <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] py-1 px-1">
            {stations.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goToStation(i, viewMode === 'FOCUS')}
                className={cn(
                  'w-6 h-6 rounded-lg text-[10px] font-black transition-all shrink-0',
                  i === currentStepIdx
                    ? 'bg-amber-500 text-slate-950 scale-110 shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                )}
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
      <div className="flex-1 relative bg-[#0a0e17] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col order-1 xl:order-2 h-[520px] xl:h-auto">
        {/* Three.js Canvas Container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* TOP FLOATING TOOLBAR: Camera View Mode & Warehouse Info */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Branch & Layout Badge */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">{layout?.name || `คลังสาขา ${branchId}`}</span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[9px] font-mono font-bold">
                  {branchId}
                </span>
                {layout?.racks && (
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    ({layout.racks.length} แร็ค & ลานวางพื้น)
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={loadWarehouseData}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
              title="รีเฟรชข้อมูลผังและสต็อกจริง"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingLayout && 'animate-spin text-amber-400')} />
            </button>
          </div>

          {/* Camera View Mode Toggles */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-2xl shadow-xl flex items-center gap-1 pointer-events-auto">
            <button
              onClick={setCameraOverview}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all',
                viewMode === 'OVERVIEW'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
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
                showActiveLabel ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:bg-slate-800'
              )}
              title="เปิด/ปิดป้ายชื่อลอยในอากาศ (ป้ายบนพื้นยังคงอยู่)"
            >
              <Tag className="w-3.5 h-3.5" />
              {showActiveLabel ? 'ป้ายลอย ON' : 'ป้ายลอย OFF'}
            </button>
            <button
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              className={cn(
                'px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all',
                isAutoRotate ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:bg-slate-800'
              )}
              title="หมุนรอบ 360 องศาต่อเนื่อง"
            >
              <Compass className="w-3.5 h-3.5" />
              360° {isAutoRotate ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={resetCamera}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="รีเซ็ตมุมกล้อง"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* BOTTOM FLOATING CONTROLS: Active Station Pill & Tour Playback */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Active Station Pill with Handover Subtitle */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <div>
              <span className="text-xs font-black text-amber-400 block">
                สถานี {currentStation.stepNumber}: {currentStation.titleTh}
              </span>
              <span className="text-[10px] text-slate-300 block">{currentStation.subtitle}</span>
            </div>
          </div>

          {/* Tour Play/Pause, Speed & Sound Controls */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setIsPlayingTour(!isPlayingTour)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all',
                isPlayingTour ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-white'
              )}
            >
              {isPlayingTour ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlayingTour ? 'หยุดชั่วคราว' : 'Auto Tour'}
            </button>

            {/* Speed Selector */}
            <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
              {([1, 2, 5] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setTourSpeed(spd)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all',
                    tourSpeed === spd ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={soundEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
