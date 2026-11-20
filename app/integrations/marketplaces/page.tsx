'use client';

import { useState, useRef, useEffect } from 'react';
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
  Save,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('IMPORT');

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [parsedOrders, setParsedOrders] = useState<NormalizedMarketplaceOrder[]>([]);
  const [detectedPlatform, setDetectedPlatform] = useState<MarketplacePlatform | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

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

  useEffect(() => {
    const applyConfig = (raw: any) => {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return;
        if (parsed.shopeeConfig) setShopeeConfig(prev => ({ ...prev, ...parsed.shopeeConfig }));
        if (parsed.tiktokConfig) setTiktokConfig(prev => ({ ...prev, ...parsed.tiktokConfig }));
        if (parsed.lazadaConfig) setLazadaConfig(prev => ({ ...prev, ...parsed.lazadaConfig }));
      } catch {
        // ignore invalid config
      }
    };

    try {
      const local = localStorage.getItem('marketplace_api_config');
      if (local) applyConfig(local);
    } catch {
      // ignore storage error
    }

    fetch('/api/user/config?key=marketplace_api_config')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.value) {
          applyConfig(data.value);
          try {
            localStorage.setItem(
              'marketplace_api_config',
              typeof data.value === 'string' ? data.value : JSON.stringify(data.value)
            );
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveApiConfig = async () => {
    setSavingConfig(true);
    const payload = { shopeeConfig, tiktokConfig, lazadaConfig, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem('marketplace_api_config', JSON.stringify(payload));
      await fetch('/api/user/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'marketplace_api_config', value: payload }),
      }).catch(() => {});
      triggerHaptic('success');
      toast.success('บันทึกการตั้งค่า Marketplace API เรียบร้อยแล้ว!');
    } catch (e) {
      toast.error('บันทึกการตั้งค่าไม่สำเร็จ: ' + errorMessage(e));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleImportToWavePicking = async () => {
    if (parsedOrders.length === 0 || importing) return;
    setImporting(true);

    try {
      const grouped = new Map<string, NormalizedMarketplaceOrder[]>();
      for (const row of parsedOrders) {
        const key = (row.orderNo || '').trim();
        if (!key) continue;
        const list = grouped.get(key) || [];
        list.push(row);
        grouped.set(key, list);
      }

      const entries = Array.from(grouped.entries());
      const total = entries.length;
      setImportProgress({ current: 0, total });

      const existingRefs = new Set<string>();
      try {
        const existingRes = await fetch('/api/orders?limit=500');
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          for (const ord of existingData.orders || []) {
            if (ord.refNo) existingRefs.add(String(ord.refNo).trim().toLowerCase());
            if (ord.orderNo) existingRefs.add(String(ord.orderNo).trim().toLowerCase());
            const m = String(ord.notes || '').match(/Order #([^\s(]+)/i);
            if (m?.[1]) existingRefs.add(m[1].trim().toLowerCase());
          }
        }
      } catch {
        // non-fatal if check fails
      }

      let createdCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < entries.length; i++) {
        const [orderNo, rows] = entries[i];
        setImportProgress({ current: i + 1, total });

        if (existingRefs.has(orderNo.toLowerCase())) {
          skippedCount++;
          continue;
        }

        const first = rows[0];
        const platform = first.platform || detectedPlatform || 'CUSTOM';
        const defaultCarrier =
          platform === 'SHOPEE'
            ? 'SPX'
            : platform === 'TIKTOK'
            ? 'JNT'
            : platform === 'LAZADA'
            ? 'LEX'
            : 'FLASH';
        const shipAddress = [first.address, first.postalCode].filter(Boolean).join(' ').trim();

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNo,
            channel: platform,
            refNo: orderNo,
            customerName: first.customerName || 'ลูกค้าทั่วไป',
            phone: first.phone || '',
            shipAddress,
            carrier: defaultCarrier,
            trackingNo: first.trackingNo || '',
            notes: `[${platform}] Order #${orderNo}${first.trackingNo ? ` (Tracking: ${first.trackingNo})` : ''}`,
            items: rows.map(r => ({
              sku: r.sku,
              name: r.productName || r.sku,
              qty: Number(r.qty) || 1,
              price: Number(r.price) || 0,
            })),
          }),
        });

        if (res.ok) {
          createdCount++;
          existingRefs.add(orderNo.toLowerCase());
        } else if (res.status === 409) {
          skippedCount++;
        } else {
          failedCount++;
        }
      }

      triggerHaptic('success');
      if (createdCount > 0) {
        const extra = skippedCount > 0 ? ` (ข้ามซ้ำ ${skippedCount} ออเดอร์)` : '';
        toast.success(`สร้างคำสั่งซื้อสำเร็จ ${createdCount} ออเดอร์${extra}! กำลังเข้าสู่ Wave Picking...`);
        router.push('/ops/wave-picking');
      } else if (skippedCount > 0 && failedCount === 0) {
        toast.success(`ออเดอร์ทั้ง ${skippedCount} รายการถูกนำเข้าไปแล้ว กำลังเข้าสู่ Wave Picking...`);
        router.push('/ops/wave-picking');
      } else {
        toast.error(`ไม่สามารถนำเข้าออเดอร์ได้ (ล้มเหลว ${failedCount} รายการ)`);
      }
    } catch (e) {
      triggerHaptic('error');
      toast.error('เกิดข้อผิดพลาดในการสร้างออเดอร์: ' + errorMessage(e));
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

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
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> กลับแดชบอร์ด
        </Link>

        {/* Open Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <ShoppingBag className="w-3 h-3 text-amber-600" />
                Omnichannel Order Sync
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Marketplace Integration Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              เชื่อมต่อคำสั่งซื้อ Shopee, TikTok Shop, Lazada • นำเข้าไฟล์ออเดอร์ • รองรับการเชื่อมต่อ API ในอนาคต
            </p>
          </div>

          {/* Platform Badges */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/15 text-amber-800 font-bold rounded-full text-xs border border-amber-500/25">
              Shopee
            </span>
            <span className="px-3 py-1 bg-slate-900 text-sky-300 font-bold rounded-full text-xs border border-slate-900">
              TikTok
            </span>
            <span className="px-3 py-1 bg-sky-500/12 text-sky-700 font-bold rounded-full text-xs border border-sky-500/20">
              Lazada
            </span>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="nx-glass-card flex items-center gap-2 p-2">
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-2',
              activeTab === 'IMPORT'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้าไฟล์คำสั่งซื้อ (Smart Excel/CSV)
          </button>

          <button
            onClick={() => setActiveTab('API_CONFIG')}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-2',
              activeTab === 'API_CONFIG'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
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
            <div className="nx-glass-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2.5">
                <FileDown className="w-5 h-5 text-amber-600" />
                <span className="text-xs font-bold text-slate-700">
                  ต้องการเทมเพลตตัวอย่างสำหรับกรอกออเดอร์?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 border border-amber-500/25 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5"
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
                'nx-glass-card border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4',
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                  : 'border-slate-300/80 hover:border-emerald-500 hover:bg-white/90'
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

              <div className="p-4 bg-amber-500/15 text-amber-700 rounded-2xl border border-amber-500/25">
                <UploadCloud className="w-10 h-10" />
              </div>

              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {parsing ? 'กำลังประมวลผลไฟล์...' : 'ลากไฟล์ Excel / CSV คำสั่งซื้อมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  รองรับไฟล์ Export จาก <strong>Shopee Seller Centre</strong>, <strong>TikTok Shop</strong>,{' '}
                  <strong>Lazada</strong> หรือไฟล์ออเดอร์ทั่วไป (.xlsx, .csv)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[11px] font-mono font-semibold">
                  .XLSX
                </span>
                <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[11px] font-mono font-semibold">
                  .CSV
                </span>
                <span className="px-3 py-1 bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 rounded-full text-[11px] font-semibold">
                  Auto Platform Detection
                </span>
              </div>
            </div>

            {/* Parsed Orders Preview Table */}
            {parsedOrders.length > 0 && (
              <div className="nx-glass-card overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-0.5 bg-amber-500/15 text-amber-800 border border-amber-500/25 font-mono font-bold text-xs rounded-full">
                        {detectedPlatform}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">ไฟล์: {fileName}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      พบคำสั่งซื้อทั้งหมด {new Set(parsedOrders.map(o => o.orderNo)).size.toLocaleString()} ออเดอร์ ({parsedOrders.length.toLocaleString()} รายการ)
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleImportToWavePicking}
                      disabled={importing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-full text-xs shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {importProgress
                            ? `กำลังนำเข้า ${importProgress.current}/${importProgress.total} ออเดอร์...`
                            : 'กำลังนำเข้าออเดอร์...'}
                        </>
                      ) : (
                        <>
                          <Boxes className="w-4 h-4" /> ส่งเข้า Wave Picking ทันที
                        </>
                      )}
                    </button>

                    <Link
                      href="/barcode/thermal-labels"
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-full text-xs shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      <Printer className="w-4 h-4" /> พิมพ์ใบปะหน้า 100x150
                    </Link>

                    <button
                      onClick={() => {
                        setParsedOrders([]);
                        setDetectedPlatform(null);
                      }}
                      className="p-2 text-slate-500 hover:text-rose-600 rounded-full hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200/80 sticky top-0 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-3">แพลตฟอร์ม</th>
                        <th className="py-3 px-3">เลขออเดอร์ (Order No)</th>
                        <th className="py-3 px-3">ผู้รับ (Customer)</th>
                        <th className="py-3 px-3">รหัสสินค้า (SKU)</th>
                        <th className="py-3 px-3">ชื่อสินค้า</th>
                        <th className="py-3 px-3 text-center">จำนวน</th>
                        <th className="py-3 px-3">เลขพัสดุ (Tracking)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {parsedOrders.map((ord, idx) => (
                        <tr key={idx} className="hover:bg-white/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 border border-slate-200 text-slate-700">
                              {ord.platform}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{ord.orderNo}</td>
                          <td className="py-2.5 px-3 text-slate-700">{ord.customerName}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{ord.sku}</td>
                          <td className="py-2.5 px-3 truncate max-w-[200px] text-slate-700">{ord.productName}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 text-sm tabular-nums">
                            {ord.qty}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
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
            <div className="nx-glass-card p-5 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-sky-500">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">โครงสร้างรองรับการเชื่อมต่อ Direct API</h4>
                  <p className="mt-0.5 leading-relaxed text-slate-600">
                    ระบบได้เตรียมฟิลด์ Credential และ Webhook Endpoints สำหรับแต่ละแพลตฟอร์มไว้แล้ว เมื่อคุณพร้อมสมัครบัญชี Developer สามารถนำ Key มากรอกเพื่อเปิดใช้งานได้ทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveApiConfig}
                disabled={savingConfig}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold rounded-full text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all flex-shrink-0"
              >
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการตั้งค่า
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SHOPEE CARD */}
              <div className="nx-glass-card p-6 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm">
                      S
                    </div>
                    <h3 className="font-bold text-slate-900">Shopee Open API</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Partner ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 2005432"
                      value={shopeeConfig.partnerId}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, partnerId: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Partner Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={shopeeConfig.partnerKey}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, partnerKey: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Shop ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 98765432"
                      value={shopeeConfig.shopId}
                      onChange={e => setShopeeConfig({ ...shopeeConfig, shopId: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-[10px] font-mono text-slate-700 truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/shopee</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/shopee')}
                      className="text-slate-500 hover:text-slate-900 p-1 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* TIKTOK CARD */}
              <div className="nx-glass-card p-6 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-sky-300 flex items-center justify-center font-black text-sm">
                      TT
                    </div>
                    <h3 className="font-bold text-slate-900">TikTok Shop Partner</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">App Key</label>
                    <input
                      type="text"
                      placeholder="e.g. 6xxyyzz"
                      value={tiktokConfig.appKey}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, appKey: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={tiktokConfig.appSecret}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, appSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Shop Cipher</label>
                    <input
                      type="text"
                      placeholder="e.g. ROW_xyz..."
                      value={tiktokConfig.shopCipher}
                      onChange={e => setTiktokConfig({ ...tiktokConfig, shopCipher: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-[10px] font-mono text-slate-700 truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/tiktok</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/tiktok')}
                      className="text-slate-500 hover:text-slate-900 p-1 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* LAZADA CARD */}
              <div className="nx-glass-card p-6 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-sm">
                      L
                    </div>
                    <h3 className="font-bold text-slate-900">Lazada Open Platform</h3>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-500/12 border border-emerald-500/20 text-emerald-700 text-[10px] font-bold rounded-full">
                    พร้อมเชื่อมต่อ
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">App Key</label>
                    <input
                      type="text"
                      placeholder="e.g. 102938"
                      value={lazadaConfig.appKey}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, appKey: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">App Secret</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={lazadaConfig.appSecret}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, appSecret: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Access Token</label>
                    <input
                      type="text"
                      placeholder="e.g. 50000..."
                      value={lazadaConfig.accessToken}
                      onChange={e => setLazadaConfig({ ...lazadaConfig, accessToken: e.target.value })}
                      className="w-full px-3 py-2 bg-white/90 border border-slate-200/80 rounded-xl font-mono text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">Webhook Callback URL:</span>
                  <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200/80 p-2 rounded-xl text-[10px] font-mono text-slate-700 truncate">
                    <span className="truncate">https://wms-360-pro.vercel.app/api/webhooks/lazada</span>
                    <button
                      onClick={() => handleCopyWebhook('https://wms-360-pro.vercel.app/api/webhooks/lazada')}
                      className="text-slate-500 hover:text-slate-900 p-1 shrink-0"
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
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowTemplateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-white/95 backdrop-blur-xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-5 text-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <Download className="w-5 h-5 text-amber-600" />
                    เลือกรูปแบบไฟล์เทมเพลต
                  </h3>
                  <button
                    onClick={() => setShowTemplateModal(false)}
                    className="text-slate-500 hover:text-slate-900 text-xs font-bold px-2.5 py-1 rounded-full hover:bg-slate-100"
                  >
                    ปิด
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  เลือกว่าคุณต้องการดาวน์โหลดเทมเพลตมาตรฐานทั่วไป หรือตัวอย่างไฟล์ตามรูปแบบของแต่ละแพลตฟอร์ม (.xlsx):
                </p>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('GENERIC')}
                    className="w-full p-3.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:border-amber-400 hover:bg-amber-500/5 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">1. เทมเพลตมาตรฐาน Nexus WMS</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        เหมาะสำหรับออเดอร์ทั่วไป, หน้าร้าน, Facebook, LINE OA
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/15 text-amber-800 rounded-full font-bold text-[10px]">
                      .xlsx
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('SHOPEE')}
                    className="w-full p-3.5 rounded-2xl border border-amber-500/30 bg-white/80 hover:bg-amber-500/5 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">2. ตัวอย่างรูปแบบไฟล์ Shopee</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        โครงสร้างหัวคอลัมน์เหมือน Shopee Seller Centre
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-600 text-white rounded-full font-bold text-[10px]">
                      Shopee
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('TIKTOK')}
                    className="w-full p-3.5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-slate-50 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">3. ตัวอย่างรูปแบบไฟล์ TikTok Shop</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        โครงสร้างหัวคอลัมน์เหมือน TikTok Seller Center
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-900 text-sky-300 rounded-full font-bold text-[10px]">
                      TikTok
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('LAZADA')}
                    className="w-full p-3.5 rounded-2xl border border-sky-500/30 bg-white/80 hover:bg-sky-500/5 text-left transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">4. ตัวอย่างรูปแบบไฟล์ Lazada</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        โครงสร้างหัวคอลัมน์เหมือน Lazada Seller Center
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-sky-600 text-white rounded-full font-bold text-[10px]">
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
