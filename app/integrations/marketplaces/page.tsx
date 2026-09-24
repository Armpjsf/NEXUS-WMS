'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
  UploadCloud,
  FileSpreadsheet,
  Boxes,
  Printer,
  Copy,
  ShieldCheck,
  Trash2,
  Settings2,
  Download,
  FileDown,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  parseMarketplaceFile,
  NormalizedMarketplaceOrder,
  MarketplacePlatform,
} from '@/lib/marketplaceParser';
import { triggerHaptic } from '@/lib/voiceAssistant';
import { errorMessage } from '@/lib/errors';

type ActiveTab = 'IMPORT' | 'API_CONFIG' | 'HISTORY';

export default function MarketplaceIntegrationsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('IMPORT');

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<NormalizedMarketplaceOrder[]>([]);
  const [detectedPlatform, setDetectedPlatform] = useState<MarketplacePlatform | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);

  // Template Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // API Config State (Future Readiness)
  const [shopeeConfig, setShopeeConfig] = useState({
    partnerId: '',
    partnerKey: '',
    shopId: '',
    enabled: false,
  });

  const [tiktokConfig, setTiktokConfig] = useState({
    appKey: '',
    appSecret: '',
    shopCipher: '',
    enabled: false,
  });

  const [lazadaConfig, setLazadaConfig] = useState({
    appKey: '',
    appSecret: '',
    accessToken: '',
    enabled: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process File
  const handleFile = async (file: File) => {
    if (!file) return;
    setParsing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseMarketplaceFile(buffer);

      if (result.orders.length === 0) {
        toast.error('ไม่พบรายการคำสั่งซื้อในไฟล์');
        return;
      }

      setParsedOrders(result.orders);
      setDetectedPlatform(result.platform);
      triggerHaptic('success');
      toast.success(
        `นำเข้าสำเร็จ! พบ ${result.totalOrders} ออเดอร์ (${result.totalItemsCount} รายการ) จาก ${result.platform}`
      );
    } catch (e) {
      console.error('Error parsing file:', e);
      triggerHaptic('error');
      toast.error('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + errorMessage(e));
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleCopyWebhook = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('คัดลอก Webhook URL แล้ว!');
  };

  // Download Sample Excel Template
  const downloadSampleTemplate = (type: 'GENERIC' | 'SHOPEE' | 'TIKTOK' | 'LAZADA') => {
    let data: any[] = [];
    let filename = 'Order_Import_Template.xlsx';

    if (type === 'SHOPEE') {
      filename = 'Shopee_Order_Template_Sample.xlsx';
      data = [
        {
          'หมายเลขคำสั่งซื้อ': '260820ABC001',
          'สถานะคำสั่งซื้อ': 'ที่ต้องจัดส่ง',
          'SKU อ้างอิง': 'SKU-BOX-01',
          'ชื่อสินค้า': 'กล่องไปรษณีย์ ฝาชน เบอร์ A (14x20x6 cm)',
          'จำนวน': 10,
          'ราคาขาย': 45,
          'ชื่อผู้รับ': 'คุณสมศรี มีสุข',
          'เบอร์โทรศัพท์': '089-999-8888',
          'ที่อยู่จัดส่ง': '88/8 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี',
          'รหัสไปรษณีย์': '12120',
          'หมายเลขพัสดุ': 'SPXTH012345678',
        },
        {
          'หมายเลขคำสั่งซื้อ': '260820ABC002',
          'สถานะคำสั่งซื้อ': 'ที่ต้องจัดส่ง',
          'SKU อ้างอิง': 'SKU-TAPE-02',
          'ชื่อสินค้า': 'เทปใสปิดกล่อง 2 นิ้ว 100 หลา',
          'จำนวน': 4,
          'ราคาขาย': 35,
          'ชื่อผู้รับ': 'คุณสมชาย ใจดี',
          'เบอร์โทรศัพท์': '081-234-5678',
          'ที่อยู่จัดส่ง': '123/45 ซอย 9 แขวงบางเขน เขตสายไหม กรุงเทพมหานคร',
          'รหัสไปรษณีย์': '10220',
          'หมายเลขพัสดุ': 'SPXTH098765432',
        },
      ];
    } else if (type === 'TIKTOK') {
      filename = 'TikTok_Order_Template_Sample.xlsx';
      data = [
        {
          'Order ID': '578912345678901234',
          'Order Status': 'Awaiting Shipment',
          'Seller SKU': 'TT-SKU-99',
          'Product Name': 'ถุงบับเบิ้ลกันกระแทก 20x30 cm',
          'Quantity': 3,
          'Product Unit Price': 120,
          'Recipient': 'คุณอนันต์ กิจเจริญ',
          'Phone Number': '082-345-6789',
          'Shipping Address': '55/1 ถนนสุขุมวิท คลองเตย กรุงเทพมหานคร',
          'Postal Code': '10110',
          'Tracking ID': 'JNTTH0987654321',
        },
      ];
    } else if (type === 'LAZADA') {
      filename = 'Lazada_Order_Template_Sample.xlsx';
      data = [
        {
          'orderNumber': '890123456789012',
          'sellerSku': 'LZD-SKU-77',
          'itemName': 'ซองพลาสติกไปรษณีย์กันน้ำ เบอร์ A3',
          'quantity': 5,
          'unitPrice': 80,
          'customerName': 'คุณวิภาวรรณ สดใส',
          'shippingAddress': '99 หมู่ 3 ต.บางกระดี อ.เมือง จ.ปทุมธานี 12000',
          'trackingCode': 'LEXTH0123456789',
        },
      ];
    } else {
      // GENERIC STANDARD
      filename = 'WMS_Standard_Order_Template.xlsx';
      data = [
        {
          'หมายเลขคำสั่งซื้อ': 'ORD-2026-001',
          'รหัสสินค้า (SKU)': 'SKU-001',
          'ชื่อสินค้า': 'กล่องพัสดุ เบอร์ 0',
          'จำนวน': 5,
          'ราคา': 120,
          'ชื่อผู้รับ': 'คุณสมชาย ใจดี',
          'เบอร์โทรศัพท์': '081-234-5678',
          'ที่อยู่จัดส่ง': '123/45 ซอย 9 แขวงบางเขน เขตสายไหม กรุงเทพมหานคร',
          'รหัสไปรษณีย์': '10220',
          'หมายเลขพัสดุ': 'TH0123456789A',
        },
        {
          'หมายเลขคำสั่งซื้อ': 'ORD-2026-002',
          'รหัสสินค้า (SKU)': 'SKU-002',
          'ชื่อสินค้า': 'เทปกาวปิดกล่อง',
          'จำนวน': 2,
          'ราคา': 70,
          'ชื่อผู้รับ': 'คุณสมศรี มีสุข',
          'เบอร์โทรศัพท์': '089-999-8888',
          'ที่อยู่จัดส่ง': '88/8 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี',
          'รหัสไปรษณีย์': '12120',
          'หมายเลขพัสดุ': 'TH0987654321B',
        },
      ];
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, filename);

    triggerHaptic('success');
    toast.success(`ดาวน์โหลด ${filename} เรียบร้อยแล้ว!`);
    setShowTemplateModal(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:p-8 bg-[#1b2027]">
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[1.75rem] border border-orange-500/30 bg-[#171c23] p-6 shadow-xl shadow-orange-900/5 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-500 via-rose-500 to-blue-500" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-3 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl border border-orange-500/30 text-orange-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#dee2ec] flex items-center gap-2.5">
                  <ShoppingBag className="w-8 h-8 text-orange-600" />
                  Marketplace Integration Hub
                </h1>
                <p className="text-sm text-[#8a92a6] mt-0.5">
                  เชื่อมต่อคำสั่งซื้อ Shopee, TikTok Shop, Lazada • นำเข้าไฟล์ออเดอร์ • รองรับการเชื่อมต่อ API ในอนาคต
                </p>
              </div>
            </div>

            {/* Platform Badges */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-orange-500/20 text-orange-800 font-bold rounded-lg text-xs border border-orange-500/30">
                Shopee
              </span>
              <span className="px-3 py-1 bg-slate-900 text-cyan-300 font-bold rounded-lg text-xs border border-slate-800">
                TikTok
              </span>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-800 font-bold rounded-lg text-xs border border-blue-500/30">
                Lazada
              </span>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-[#171c23] p-2 rounded-2xl border border-[#30353d] shadow-sm">
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              activeTab === 'IMPORT'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-[#d1c6ab] hover:bg-[#1b2027]'
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้าไฟล์คำสั่งซื้อ (Smart Excel/CSV)
          </button>

          <button
            onClick={() => setActiveTab('API_CONFIG')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2',
              activeTab === 'API_CONFIG'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-[#d1c6ab] hover:bg-[#1b2027]'
            )}
          >
            <Settings2 className="w-4 h-4" />
            ตั้งค่าการเชื่อมต่อ API (Direct API Readiness)
          </button>
        </div>

        {/* TAB 1: SMART FILE IMPORTER */}
        {activeTab === 'IMPORT' && (
          <div className="space-y-6">
            {/* Top Action Bar: Template Download */}
            <div className="flex items-center justify-between bg-[#171c23] p-4 rounded-2xl border border-[#30353d] shadow-sm">
              <div className="flex items-center gap-2">
                <FileDown className="w-5 h-5 text-orange-600" />
                <span className="text-xs font-bold text-[#d1c6ab]">
                  ต้องการเทมเพลตตัวอย่างสำหรับกรอกออเดอร์?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-800 border border-orange-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดเทมเพลตตัวอย่าง (.xlsx)
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-[#171c23] shadow-sm flex flex-col items-center justify-center space-y-4',
                isDragging
                  ? 'border-orange-500 bg-orange-500/10/50 scale-[1.01]'
                  : 'border-[#30353d] hover:border-orange-400 hover:bg-orange-500/10/20'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              <div className="p-4 bg-orange-500/10 text-orange-600 rounded-2xl border border-orange-500/30">
                <UploadCloud className="w-10 h-10" />
              </div>

              <div className="max-w-md space-y-1">
                <h3 className="text-base font-black text-[#dee2ec]">
                  ลากไฟล์ Excel / CSV คำสั่งซื้อมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                </h3>
                <p className="text-xs text-[#8a92a6] leading-relaxed">
                  รองรับไฟล์ Export จาก <strong>Shopee Seller Centre</strong>, <strong>TikTok Shop</strong>,{' '}
                  <strong>Lazada</strong> หรือไฟล์ออเดอร์ทั่วไป (.xlsx, .csv)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className="px-2.5 py-1 bg-[#252a32] text-[#d1c6ab] rounded-md text-[11px] font-mono">
                  .XLSX
                </span>
                <span className="px-2.5 py-1 bg-[#252a32] text-[#d1c6ab] rounded-md text-[11px] font-mono">
                  .CSV
                </span>
                <span className="px-2.5 py-1 bg-[#252a32] text-[#d1c6ab] rounded-md text-[11px] font-mono">
                  Auto Platform Detection
                </span>
              </div>
            </div>

            {/* Parsed Orders Preview Table */}
            {parsedOrders.length > 0 && (
              <div className="bg-[#171c23] border border-[#30353d] rounded-2xl shadow-xl overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#30353d] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-orange-500/20 text-orange-800 font-mono font-black text-xs rounded-md">
                        {detectedPlatform}
                      </span>
                      <span className="text-xs text-[#8a92a6] font-mono">ไฟล์: {fileName}</span>
                    </div>
                    <h3 className="text-lg font-black text-[#dee2ec] mt-1">
                      พบคำสั่งซื้อทั้งหมด {new Set(parsedOrders.map(o => o.orderNo)).size} ออเดอร์ ({parsedOrders.length} รายการ)
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/ops/wave-picking"
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Boxes className="w-4 h-4" /> ส่งเข้า Wave Picking ทันที
                    </Link>

                    <Link
                      href="/barcode/thermal-labels"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Printer className="w-4 h-4" /> พิมพ์ใบปะหน้า 100x150
                    </Link>

                    <button
                      onClick={() => {
                        setParsedOrders([]);
                        setDetectedPlatform(null);
                      }}
                      className="p-2 text-[#8a92a6] hover:text-rose-600 rounded-xl hover:bg-[#1b2027]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#252a32] text-[#d1c6ab] font-bold border-b border-[#30353d] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">แพลตฟอร์ม</th>
                        <th className="py-2.5 px-3">เลขออเดอร์ (Order No)</th>
                        <th className="py-2.5 px-3">ผู้รับ (Customer)</th>
                        <th className="py-2.5 px-3">รหัสสินค้า (SKU)</th>
                        <th className="py-2.5 px-3">ชื่อสินค้า</th>
                        <th className="py-2.5 px-3 text-center">จำนวน</th>
                        <th className="py-2.5 px-3">เลขพัสดุ (Tracking)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30353d]">
                      {parsedOrders.map((ord, idx) => (
                        <tr key={idx} className="hover:bg-[#1b2027] transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-[#252a32] text-[#dee2ec]">
                              {ord.platform}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#dee2ec]">{ord.orderNo}</td>
                          <td className="py-2.5 px-3">{ord.customerName}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-orange-700">{ord.sku}</td>
                          <td className="py-2.5 px-3 truncate max-w-[200px]">{ord.productName}</td>
                          <td className="py-2.5 px-3 text-center font-black text-[#dee2ec] text-sm">
                            {ord.qty}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#8a92a6]">
                            {ord.trackingNo || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DIRECT API CONFIGURATIONS (Future Readiness) */}
        {activeTab === 'API_CONFIG' && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-blue-950">โครงสร้างรองรับการเชื่อมต่อ Direct API</h4>
                <p className="mt-0.5 leading-relaxed text-blue-800">
                  ระบบได้เตรียมฟิลด์ Credential และ Webhook Endpoints สำหรับแต่ละแพลตฟอร์มไว้แล้ว เมื่อคุณพร้อมสมัครบัญชี Developer สามารถนำ Key มากรอกเพื่อเปิดใช้งานได้ทันที
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SHOPEE CARD */}
              <div className="bg-[#171c23] border-2 border-orange-500/30 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black text-sm">
                      S
                    </div>
                    <h3 className="font-black text-[#dee2ec]">Shopee Open API</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-[#252a32] text-[#d1c6ab] text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">Partner ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 2005432"
                      value={shopeeConfig.partnerId}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, partnerId: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">Partner Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={shopeeConfig.partnerKey}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, partnerKey: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">Shop ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 98765432"
                      value={shopeeConfig.shopId}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, shopId: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#30353d]">
                  <span className="text-[10px] text-[#8a92a6] font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center gap-1 bg-[#252a32] p-1.5 rounded-lg text-[10px] font-mono text-[#d1c6ab] truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/shopee</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/shopee')}
                      className="text-[#8a92a6] hover:text-[#d1c6ab] p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* TIKTOK CARD */}
              <div className="bg-[#171c23] border-2 border-slate-800 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-950 text-cyan-400 flex items-center justify-center font-black text-sm">
                      TT
                    </div>
                    <h3 className="font-black text-[#dee2ec]">TikTok Shop Partner</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-[#252a32] text-[#d1c6ab] text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">App Key</label>
                    <input
                      type="text"
                      placeholder="e.g. 6xxyyzz"
                      value={tiktokConfig.appKey}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, appKey: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={tiktokConfig.appSecret}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, appSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">Shop Cipher</label>
                    <input
                      type="text"
                      placeholder="e.g. ROW_xyz..."
                      value={tiktokConfig.shopCipher}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, shopCipher: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#30353d]">
                  <span className="text-[10px] text-[#8a92a6] font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center gap-1 bg-[#252a32] p-1.5 rounded-lg text-[10px] font-mono text-[#d1c6ab] truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/tiktok</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/tiktok')}
                      className="text-[#8a92a6] hover:text-[#d1c6ab] p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* LAZADA CARD */}
              <div className="bg-[#171c23] border-2 border-blue-500/30 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                      L
                    </div>
                    <h3 className="font-black text-[#dee2ec]">Lazada Open Platform</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-[#252a32] text-[#d1c6ab] text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">App Key</label>
                    <input
                      type="text"
                      placeholder="e.g. 102938"
                      value={lazadaConfig.appKey}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, appKey: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={lazadaConfig.appSecret}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, appSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">Access Token</label>
                    <input
                      type="text"
                      placeholder="e.g. 50000..."
                      value={lazadaConfig.accessToken}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, accessToken: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1b2027] border border-[#30353d] rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#30353d]">
                  <span className="text-[10px] text-[#8a92a6] font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center gap-1 bg-[#252a32] p-1.5 rounded-lg text-[10px] font-mono text-[#d1c6ab] truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/lazada</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/lazada')}
                      className="text-[#8a92a6] hover:text-[#d1c6ab] p-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Template Selector */}
        <AnimatePresence>
          {showTemplateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowTemplateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#171c23] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#30353d] space-y-5 text-[#dee2ec]"
              >
                <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                  <h3 className="font-black text-lg text-[#dee2ec] flex items-center gap-2">
                    <Download className="w-5 h-5 text-orange-600" />
                    เลือกรูปแบบไฟล์เทมเพลต
                  </h3>
                  <button
                    onClick={() => setShowTemplateModal(false)}
                    className="text-[#8a92a6] hover:text-[#d1c6ab] text-xs font-bold"
                  >
                    ปิด
                  </button>
                </div>

                <p className="text-xs text-[#8a92a6]">
                  เลือกว่าคุณต้องการดาวน์โหลดเทมเพลตมาตรฐานทั่วไป หรือตัวอย่างไฟล์ตามรูปแบบของแต่ละแพลตฟอร์ม (.xlsx):
                </p>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('GENERIC')}
                    className="w-full p-3.5 rounded-2xl border border-[#30353d] hover:border-orange-400 hover:bg-orange-500/10/40 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#dee2ec]">1. เทมเพลตมาตรฐาน WMS 360 PRO</div>
                      <div className="text-[11px] text-[#8a92a6] mt-0.5">
                        เหมาะสำหรับออเดอร์ทั่วไป, หน้าร้าน, Facebook, LINE OA
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-orange-500/20 text-orange-800 rounded-lg font-bold text-[10px]">
                      .xlsx
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('SHOPEE')}
                    className="w-full p-3.5 rounded-2xl border border-orange-500/30 hover:bg-orange-500/10/40 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-orange-950">2. ตัวอย่างรูปแบบไฟล์ Shopee</div>
                      <div className="text-[11px] text-orange-800/70 mt-0.5">
                        โครงสร้างหัวคอลัมน์เหมือน Shopee Seller Centre
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-orange-500 text-white rounded-lg font-bold text-[10px]">
                      Shopee
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('TIKTOK')}
                    className="w-full p-3.5 rounded-2xl border border-slate-800 hover:bg-slate-900/5 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#dee2ec]">3. ตัวอย่างรูปแบบไฟล์ TikTok Shop</div>
                      <div className="text-[11px] text-[#8a92a6] mt-0.5">
                        โครงสร้างหัวคอลัมน์เหมือน TikTok Seller Center
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-950 text-cyan-300 rounded-lg font-bold text-[10px]">
                      TikTok
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('LAZADA')}
                    className="w-full p-3.5 rounded-2xl border border-blue-500/30 hover:bg-blue-500/10/40 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-blue-950">4. ตัวอย่างรูปแบบไฟล์ Lazada</div>
                      <div className="text-[11px] text-blue-800/70 mt-0.5">
                        โครงสร้างหัวคอลัมน์เหมือน Lazada Seller Center
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-[10px]">
                      Lazada
                    </span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
