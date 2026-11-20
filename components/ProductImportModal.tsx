'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  RefreshCw,
  FileText,
  Table,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errors';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedProduct {
  sku: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  price: number;
  cost: number;
  unit: string;
  location: string;
  barcode: string;
  status: string;
  lot_no?: string;
  expiry_date?: string;
  image_url?: string;
  isValid: boolean;
  errorReason?: string;
}

export function ProductImportModal({ isOpen, onClose, onSuccess }: ProductImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Template (Excel & CSV)
  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    const templateRows = [
      {
        'รหัสสินค้า (SKU) *': 'SKU-MED-001',
        'ชื่อสินค้า (Name) *': 'พาราเซตามอล 500mg (100 เม็ด)',
        'หมวดหมู่ (Category)': 'เวชภัณฑ์และยา',
        'จำนวนสต็อก (Stock)': 150,
        'จุดเตือนสต็อกต่ำ (Min Stock)': 30,
        'ราคาขาย (Price)': 120,
        'ต้นทุน (Cost)': 85,
        'หน่วยนับ (Unit)': 'กล่อง',
        'พิกัดจัดเก็บ (Location)': 'A-01-02',
        'สถานะ (Status)': 'Active',
        'บาร์โค้ด (Barcode)': '8850123450011',
        'หมายเลข Lot (Lot No)': 'LOT-2026-MED1',
        'วันหมดอายุ (Expiry: YYYY-MM-DD)': '2028-12-31',
        'ลิงก์รูปสินค้า (Image URL)': 'https://example.com/para500.jpg'
      },
      {
        'รหัสสินค้า (SKU) *': 'SKU-BEV-002',
        'ชื่อสินค้า (Name) *': 'นมสดพาสเจอร์ไรส์ 100% (2 ลิตร)',
        'หมวดหมู่ (Category)': 'อาหารสดและเครื่องดื่ม',
        'จำนวนสต็อก (Stock)': 80,
        'จุดเตือนสต็อกต่ำ (Min Stock)': 20,
        'ราคาขาย (Price)': 95,
        'ต้นทุน (Cost)': 65,
        'หน่วยนับ (Unit)': 'ขวด',
        'พิกัดจัดเก็บ (Location)': 'B-02-01',
        'สถานะ (Status)': 'Active',
        'บาร์โค้ด (Barcode)': '8850123450028',
        'หมายเลข Lot (Lot No)': 'LOT-2026-MILK',
        'วันหมดอายุ (Expiry: YYYY-MM-DD)': '2026-10-15',
        'ลิงก์รูปสินค้า (Image URL)': 'https://example.com/milk2l.jpg'
      },
      {
        'รหัสสินค้า (SKU) *': 'SKU-IND-003',
        'ชื่อสินค้า (Name) *': 'น้ำมันหล่อลื่นสังเคราะห์ 10W-40 (4 ลิตร)',
        'หมวดหมู่ (Category)': 'เคมีภัณฑ์อุตสาหกรรม',
        'จำนวนสต็อก (Stock)': 45,
        'จุดเตือนสต็อกต่ำ (Min Stock)': 10,
        'ราคาขาย (Price)': 850,
        'ต้นทุน (Cost)': 600,
        'หน่วยนับ (Unit)': 'แกลลอน',
        'พิกัดจัดเก็บ (Location)': 'D-03-02',
        'สถานะ (Status)': 'Active',
        'บาร์โค้ด (Barcode)': '8850123450042',
        'หมายเลข Lot (Lot No)': 'LOT-2026-OIL',
        'วันหมดอายุ (Expiry: YYYY-MM-DD)': '2029-06-30',
        'ลิงก์รูปสินค้า (Image URL)': 'https://example.com/oil10w40.jpg'
      },
      {
        'รหัสสินค้า (SKU) *': 'SKU-OLD-004',
        'ชื่อสินค้า (Name) *': 'กรองอากาศรุ่นเก่า (ขายหมดแล้ว/ยกเลิกจำหน่าย)',
        'หมวดหมู่ (Category)': 'อะไหล่และอุปกรณ์',
        'จำนวนสต็อก (Stock)': 0,
        'จุดเตือนสต็อกต่ำ (Min Stock)': 0,
        'ราคาขาย (Price)': 450,
        'ต้นทุน (Cost)': 300,
        'หน่วยนับ (Unit)': 'ชิ้น',
        'พิกัดจัดเก็บ (Location)': 'UNASSIGNED',
        'สถานะ (Status)': 'Inactive',
        'บาร์โค้ด (Barcode)': '8850123450099',
        'หมายเลข Lot (Lot No)': '',
        'วันหมดอายุ (Expiry: YYYY-MM-DD)': '',
        'ลิงก์รูปสินค้า (Image URL)': ''
      },
      {
        'รหัสสินค้า (SKU) *': 'SKU-RTV-005',
        'ชื่อสินค้า (Name) *': 'หลอดไฟ LED ชำรุด (รอส่งคืนโรงงานผลิต/คลังแม่)',
        'หมวดหมู่ (Category)': 'อุปกรณ์ไฟฟ้า',
        'จำนวนสต็อก (Stock)': 20,
        'จุดเตือนสต็อกต่ำ (Min Stock)': 0,
        'ราคาขาย (Price)': 199,
        'ต้นทุน (Cost)': 120,
        'หน่วยนับ (Unit)': 'กล่อง',
        'พิกัดจัดเก็บ (Location)': 'RTN-STAGE-01',
        'สถานะ (Status)': 'Active',
        'บาร์โค้ด (Barcode)': '8850123450088',
        'หมายเลข Lot (Lot No)': 'LOT-RTV-01',
        'วันหมดอายุ (Expiry: YYYY-MM-DD)': '',
        'ลิงก์รูปสินค้า (Image URL)': ''
      }
    ];

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(templateRows);
      // set column widths
      ws['!cols'] = [
        { wch: 18 }, { wch: 42 }, { wch: 22 }, { wch: 18 },
        { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 35 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Product_Template');
      XLSX.writeFile(wb, 'NEXUS_WMS_Product_Template.xlsx');
      toast.success('ดาวน์โหลดแม่แบบ Excel เรียบร้อยแล้ว');
    } else {
      const ws = XLSX.utils.json_to_sheet(templateRows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'NEXUS_WMS_Product_Template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('ดาวน์โหลดแม่แบบ CSV เรียบร้อยแล้ว');
    }
  };

  // 2. Parse uploaded File
  const handleFileChange = (uploadedFile: File) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          toast.error('ไฟล์ไม่มีข้อมูล หรือตารางว่างเปล่า');
          setIsProcessing(false);
          return;
        }

        // Helper to extract value by multiple possible header keys
        const extract = (row: any, ...keys: string[]) => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== '') return row[k];
            // case insensitive match
            const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
            if (found && row[found] !== undefined && row[found] !== '') return row[found];
          }
          return '';
        };

        const parsed: ParsedProduct[] = rawRows.map((row, idx) => {
          const sku = String(extract(row, 'รหัสสินค้า (SKU) *', 'รหัสสินค้า', 'SKU', 'sku', 'Item Code', 'code', 'id') || '').trim();
          const name = String(extract(row, 'ชื่อสินค้า (Name) *', 'ชื่อสินค้า', 'Name', 'name', 'Product Name', 'title') || '').trim();
          const category = String(extract(row, 'หมวดหมู่ (Category)', 'หมวดหมู่', 'Category', 'category') || 'General').trim();
          const stock = Number(extract(row, 'จำนวนสต็อก (Stock)', 'จำนวนคงเหลือ (Stock)', 'จำนวน', 'Stock', 'stock', 'qty', 'quantity') || 0);
          const min_stock = Number(extract(row, 'จุดเตือนสต็อกต่ำ (Min Stock)', 'Min Stock', 'min_stock', 'minStock', 'จุดสั่งซื้อ') || 5);
          const price = Number(extract(row, 'ราคาขาย (Price)', 'ราคา', 'Price', 'price') || 0);
          const cost = Number(extract(row, 'ต้นทุน (Cost)', 'ต้นทุน', 'Cost', 'cost') || 0);
          const unit = String(extract(row, 'หน่วยนับ (Unit)', 'หน่วย', 'Unit', 'unit') || 'ชิ้น').trim();
          const location = String(extract(row, 'พิกัดจัดเก็บ (Location)', 'พิกัด', 'Location', 'location', 'Bin') || 'Unassigned').trim();
          const barcode = String(extract(row, 'บาร์โค้ด (Barcode)', 'บาร์โค้ด', 'Barcode', 'barcode') || '').trim();
          const lot_no = String(extract(row, 'หมายเลข Lot (Lot No)', 'หมายเลข Lot', 'Lot', 'lot', 'Lot No', 'lot_no', 'Batch') || '').trim();
          const image_url = String(extract(row, 'ลิงก์รูปสินค้า (Image URL)', 'ลิงก์รูป', 'รูปภาพ', 'Image URL', 'image_url', 'image', 'imageUrl', 'photo') || '').trim();

          let expiry_date = extract(row, 'วันหมดอายุ (Expiry: YYYY-MM-DD)', 'วันหมดอายุ', 'Expiry', 'expiry', 'exp_date', 'expiry_date');
          if (expiry_date instanceof Date) {
            expiry_date = expiry_date.toISOString().split('T')[0];
          } else {
            expiry_date = String(expiry_date || '').trim();
          }

          const rawStatus = String(extract(row, 'สถานะ (Status)', 'สถานะ', 'Status', 'status', 'Master Status') || 'Active').trim();
          const isInactive = ['inactive', 'ยกเลิก', 'discontinued', 'ระงับ', 'หมด'].includes(rawStatus.toLowerCase());
          const status = isInactive ? 'Inactive' : 'Active';

          const isValid = Boolean(sku || name);
          const errorReason = !isValid ? 'ต้องระบุรหัสสินค้า (SKU) หรือชื่อสินค้า' : undefined;

          return {
            sku: sku || name,
            name: name || sku,
            category,
            stock: isNaN(stock) ? 0 : stock,
            min_stock: isNaN(min_stock) ? 5 : min_stock,
            price: isNaN(price) ? 0 : price,
            cost: isNaN(cost) ? 0 : cost,
            unit,
            location,
            barcode,
            status,
            lot_no: lot_no || undefined,
            expiry_date: expiry_date || undefined,
            image_url: image_url || undefined,
            isValid,
            errorReason
          };
        });

        setParsedData(parsed);
        toast.success(`อ่านข้อมูลสำเร็จ ตรวจพบ ${parsed.length} รายการ`);
      } catch (err) {
        console.error('File parsing error:', err);
        toast.error('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  // 3. Submit Import to Backend
  const handleImportSubmit = async () => {
    const validItems = parsedData.filter(p => p.isValid);
    if (validItems.length === 0) {
      toast.error('ไม่มีรายการสินค้าที่ถูกต้องสำหรับนำเข้า');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: validItems })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'นำเข้าข้อมูลไม่สำเร็จ');

      toast.success(json.message || `นำเข้าสำเร็จ ${json.count} รายการ`);
      onSuccess();
      onClose();
      // Reset
      setFile(null);
      setParsedData([]);
    } catch (err) {
      toast.error(errorMessage(err) || 'เกิดข้อผิดพลาดในการนำเข้าสินค้า');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedData.filter(p => p.isValid).length;
  const invalidCount = parsedData.length - validCount;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-3 sm:p-4 font-mono">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[24px] border border-white/90 bg-white/95 backdrop-blur-xl shadow-2xl text-slate-900 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-white/90 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-200">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-headline text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>นำเข้าสินค้าเป็นชุด (Batch Product Import)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Excel / CSV
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  อัปโหลดไฟล์ Excel (.xlsx, .xls) หรือ CSV เพื่อเพิ่ม/อัปเดตรายการสินค้าในระบบคลังพร้อมกัน
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Download Template Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>ดาวน์โหลดไฟล์แม่แบบที่มีหัวตารางและตัวอย่าง:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplate('xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>แม่แบบ Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => downloadTemplate('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>แม่แบบ CSV (.csv)</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Upload Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
                dragActive 
                  ? "border-emerald-500 bg-emerald-50/70 scale-[0.99]" 
                  : "border-slate-200 bg-slate-50/80 hover:border-emerald-400 hover:bg-emerald-50/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 text-emerald-600 mb-2" />
              <p className="font-bold text-sm text-slate-900 mb-1">
                {file ? file.name : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
              </p>
              <p className="text-xs text-slate-500">
                รองรับไฟล์นามสกุล .xlsx, .xls และ .csv (ขนาดไม่เกิน 10MB)
              </p>
              {file && (
                <span className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  เลือกไฟล์แล้ว ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            {/* Preview Section */}
            {isProcessing ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-600" />
                กำลังแปลงข้อมูลจากไฟล์...
              </div>
            ) : parsedData.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900">
                      ตัวอย่างข้อมูลที่ตรวจพบ ({parsedData.length} รายการ)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                      พร้อมนำเข้า: {validCount}
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                        ไม่สมบูรณ์: {invalidCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-64">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 font-bold">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">รหัสสินค้า (SKU)</th>
                        <th className="py-2 px-3">ชื่อสินค้า</th>
                        <th className="py-2 px-3">หมวดหมู่</th>
                        <th className="py-2 px-3 text-right">จำนวน</th>
                        <th className="py-2 px-3 text-right">ราคา</th>
                        <th className="py-2 px-3">พิกัดจัดเก็บ</th>
                        <th className="py-2 px-3">สถานะ</th>
                        <th className="py-2 px-3">Lot No</th>
                        <th className="py-2 px-3">วันหมดอายุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedData.slice(0, 30).map((row, idx) => (
                        <tr key={idx} className={cn("hover:bg-slate-50/70", !row.isValid && "bg-rose-50/70")}>
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{row.sku}</td>
                          <td className="py-2 px-3 max-w-[200px] truncate">{row.name}</td>
                          <td className="py-2 px-3 text-slate-500">{row.category}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">{row.stock.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">฿{row.price.toLocaleString()}</td>
                          <td className="py-2 px-3 text-teal-700 font-semibold">{row.location}</td>
                          <td className="py-2 px-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              row.status === 'Active' 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            )}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2 px-3">{row.lot_no || '-'}</td>
                          <td className="py-2 px-3">{row.expiry_date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedData.length > 30 && (
                  <p className="text-[10px] text-slate-500 text-right">
                    * แสดงตัวอย่าง 30 รายการแรก จากทั้งหมด {parsedData.length} รายการ
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-bold transition-colors"
            >
              ยกเลิก
            </button>

            <div className="flex items-center gap-3">
              {parsedData.length > 0 && (
                <span className="text-slate-600">
                  เตรียมนำเข้า <strong className="text-slate-900">{validCount}</strong> รายการ
                </span>
              )}
              <button
                onClick={handleImportSubmit}
                disabled={isImporting || validCount === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังนำเข้าข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันนำเข้าสินค้า ({validCount} รายการ)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
