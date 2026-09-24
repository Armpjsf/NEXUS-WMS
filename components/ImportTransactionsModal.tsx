'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { FileSpreadsheet, Upload, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'IN' | 'OUT';
  products: any[];
  onImported: (items: any[]) => void;
}

export function ImportTransactionsModal({ isOpen, onClose, type, products, onImported }: ImportModalProps) {
  const { t } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [filename, setFilename] = useState('');

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setErrors([]);
    setPreviewData([]);
    setFilename(file.name);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (json.length < 2) {
            setErrors(["ไฟล์นี้ไม่มีข้อมูล หรือมีเพียงแถวหัวข้อเท่านั้น"]);
            setLoading(false);
            return;
          }

          // Read headers
          const headers = json[0].map((h: any) => String(h || '').trim().toLowerCase());
          
          // Map columns (Support multiple languages and synonyms)
          const skuKeywords = ['sku', 'product', 'สินค้า', 'ชื่อสินค้า', 'รหัสสินค้า', 'item'];
          const qtyKeywords = ['qty', 'quantity', 'จำนวน', 'จำนวนสินค้า', 'ชิ้น'];
          const priceKeywords = ['price', 'cost', 'ราคา', 'ต้นทุน', 'ราคาขาย', 'หน่วยละ'];
          const docKeywords = ['doc', 'ref', 'po', 'inv', 'เอกสาร', 'เลขที่เอกสาร', 'อ้างอิง'];
          const batchKeywords = ['batch', 'lot', 'ล็อต'];
          const expiryKeywords = ['expiry', 'exp', 'หมดอายุ', 'วันที่หมดอายุ'];
          const ownerKeywords = ['owner', 'customer', 'เจ้าของ', 'ลูกค้า'];

          const skuIdx = headers.findIndex((h: string) => skuKeywords.some(k => h.includes(k)));
          const qtyIdx = headers.findIndex((h: string) => qtyKeywords.some(k => h.includes(k)));
          const priceIdx = headers.findIndex((h: string) => priceKeywords.some(k => h.includes(k)));
          const docIdx = headers.findIndex((h: string) => docKeywords.some(k => h.includes(k)));
          const batchIdx = headers.findIndex((h: string) => batchKeywords.some(k => h.includes(k)));
          const expiryIdx = headers.findIndex((h: string) => expiryKeywords.some(k => h.includes(k)));
          const ownerIdx = headers.findIndex((h: string) => ownerKeywords.some(k => h.includes(k)));

          if (skuIdx === -1 || qtyIdx === -1) {
            setErrors(["ไม่พบหัวข้อสินค้า (SKU/Product) หรือจำนวน (Qty/Quantity) กรุณาตรวจสอบหัวตาราง"]);
            setLoading(false);
            return;
          }

          const parsedItems: any[] = [];
          const rowErrors: string[] = [];

          for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0 || !row[skuIdx]) continue; // Skip empty rows

            const sku = String(row[skuIdx]).trim();
            const qtyRaw = row[qtyIdx];
            const qty = parseFloat(String(qtyRaw).replace(/,/g, ''));
            const price = priceIdx > -1 && row[priceIdx] ? parseFloat(String(row[priceIdx]).replace(/,/g, '')) : 0;
            const docRef = docIdx > -1 && row[docIdx] ? String(row[docIdx]).trim() : '';
            const batch = batchIdx > -1 && row[batchIdx] ? String(row[batchIdx]).trim() : '';
            
            // Format expiry date if it is an Excel serial date number
            let expiryDate = '';
            if (expiryIdx > -1 && row[expiryIdx]) {
              const val = row[expiryIdx];
              if (typeof val === 'number') {
                const dateObj = new Date((val - 25569) * 86400 * 1000);
                expiryDate = dateObj.toISOString().split('T')[0];
              } else {
                expiryDate = String(val).trim();
              }
            }
            
            const owner = ownerIdx > -1 && row[ownerIdx] ? String(row[ownerIdx]).trim() : '';

            // Validate SKU matches products list
            const matchedProduct = products.find(p => p.name.toLowerCase() === sku.toLowerCase() || p.id.toLowerCase() === sku.toLowerCase());
            if (!matchedProduct) {
              rowErrors.push(`แถวที่ ${i + 1}: ไม่พบสินค้าชื่อหรือรหัส "${sku}" ในระบบคลังสินค้าหลัก`);
              continue;
            }

            // Validate Qty
            if (isNaN(qty) || qty <= 0) {
              rowErrors.push(`แถวที่ ${i + 1}: จำนวนสินค้า "${qtyRaw}" ไม่ถูกต้อง (ต้องมากกว่า 0)`);
              continue;
            }

            // For OUT transactions, check stock availability
            if (type === 'OUT' && matchedProduct.stock < qty) {
              rowErrors.push(`แถวที่ ${i + 1}: สินค้า "${matchedProduct.name}" มีสต็อกคงเหลือ ${matchedProduct.stock} ไม่เพียงพอสำหรับการเบิกจ่ายจำนวน ${qty}`);
              continue;
            }

            parsedItems.push({
              sku: matchedProduct.name, // normalize to standard master name
              qty,
              salePrice: price || matchedProduct.price,
              docRef,
              batch,
              expiryDate,
              owner,
              stock: matchedProduct.stock
            });
          }

          if (rowErrors.length > 0) {
            setErrors(rowErrors);
          }
          setPreviewData(parsedItems);
        } catch (err) {
          setErrors([`เกิดข้อผิดพลาดในการอ่านไฟล์: ${errorMessage(err)}`]);
        } finally {
          setLoading(false);
        }
      };

      reader.readAsBinaryString(file);
    } catch (err) {
      setErrors([`เกิดข้อผิดพลาดในการเปิดไฟล์: ${errorMessage(err)}`]);
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirm = () => {
    if (previewData.length === 0) return;
    onImported(previewData);
    toast.success(`นำเข้าข้อมูลสำเร็จ ${previewData.length} รายการ!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
            <FileSpreadsheet className={`w-6 h-6 ${type === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`} />
            {t('import_excel')} ({type === 'IN' ? t('menu_inbound') : t('menu_outbound')})
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Drag and drop area */}
          {!previewData.length && !loading && (
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-3 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 transition-all ${
                dragActive ? 'border-indigo-500 bg-indigo-50/50 scale-98' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
              }`}
            >
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-700 text-lg">ลากไฟล์ Excel (.xlsx) หรือ CSV มาวางที่นี่</p>
                <p className="text-slate-400 text-sm mt-1">หรือคลิกปุ่มด้านล่างเพื่อเลือกไฟล์จากเครื่องคอมพิวเตอร์</p>
              </div>
              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 text-sm">
                เลือกไฟล์เอกสาร
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleChange} className="hidden" />
              </label>
              
              <div className="mt-4 pt-4 border-t border-slate-200/50 w-full max-w-md text-xs text-left text-slate-400 space-y-1">
                <p className="font-bold text-slate-500 mb-1">💡 รูปแบบคอลัมน์ที่รองรับ:</p>
                <p>• <b>ชื่อสินค้า (SKU)</b> เช่น: สินค้า, ชื่อสินค้า, รหัสสินค้า, SKU</p>
                <p>• <b>จำนวนสินค้า (Qty)</b> เช่น: จำนวน, จำนวนสินค้า, Qty, Quantity</p>
                <p>• <i>คอลัมน์เสริม: ราคา (Price), เลขที่เอกสาร (Doc Ref), ล็อตสินค้า (Batch), วันหมดอายุ (Expiry)</i></p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <p className="font-bold text-slate-600">กำลังตรวจสอบโครงสร้างตารางข้อมูล...</p>
            </div>
          )}

          {/* Errors list */}
          {errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-rose-800 flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4" /> พบข้อผิดพลาดหรือข้อควรระวังในเอกสาร ({errors.length} รายการ):
              </h4>
              <ul className="list-disc list-inside text-xs text-rose-700 space-y-1 max-h-40 overflow-y-auto font-medium">
                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
              </ul>
            </div>
          )}

          {/* Preview list */}
          {previewData.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold">ไฟล์: {filename} (ตรวจสอบพบ {previewData.length} รายการที่ถูกต้อง)</span>
                </div>
                <button 
                  onClick={() => { setPreviewData([]); setErrors([]); }} 
                  className="text-xs text-rose-500 hover:text-rose-700 font-bold uppercase"
                >
                  เลือกไฟล์ใหม่
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3">สินค้า (SKU)</th>
                      <th className="p-3 text-right">จำนวน</th>
                      <th className="p-3 text-right">ราคาหน่วยละ</th>
                      <th className="p-3">เลขที่เอกสาร</th>
                      <th className="p-3">ล็อต / วันหมดอายุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">{item.sku}</td>
                        <td className={`p-3 text-right font-bold ${type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.qty.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">฿{item.salePrice.toLocaleString()}</td>
                        <td className="p-3 text-slate-500 truncate max-w-[120px]">{item.docRef || '-'}</td>
                        <td className="p-3 text-xs text-slate-500">
                          {item.batch && <span>Lot: {item.batch} </span>}
                          {item.expiryDate && <span>(Exp: {item.expiryDate})</span>}
                          {!item.batch && !item.expiryDate && '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            {t('cancel')}
          </button>
          {previewData.length > 0 && (
            <button 
              onClick={handleConfirm}
              className={`px-8 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-200'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              ยืนยันการนำเข้า ({previewData.length} รายการ)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
