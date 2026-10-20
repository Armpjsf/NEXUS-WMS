'use client';

import { useState, useRef } from 'react';
import {
  X,
  Printer,
  Barcode as BarcodeIcon,
  CheckCircle2,
  Copy,
  Download,
  Filter,
} from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-hot-toast';

interface WarehouseBatchLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  bins: string[]; // List of bin codes e.g. ["A-01-01-01", "A-01-01-02", ...]
}

export default function WarehouseBatchLabelModal({
  isOpen,
  onClose,
  branchName,
  bins = [],
}: WarehouseBatchLabelModalProps) {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Shelf-Labels-${branchName}`,
  });

  if (!isOpen) return null;

  // Extract unique zones
  const zones = Array.from(new Set(bins.map(b => b.split('-')[0] || 'A'))).sort();

  // Filter bins
  const filteredBins = bins.filter(b => {
    if (selectedZone !== 'ALL' && !b.startsWith(selectedZone)) return false;
    if (searchFilter && !b.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#171c23] border border-[#30353d] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#30353d] flex items-center justify-between bg-[#1f242c]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#57ec7f]/10 border border-[#57ec7f]/30 flex items-center justify-center text-[#57ec7f]">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#dee2ec] flex items-center gap-2">
                พิมพ์สติ๊กเกอร์บาร์โค้ดติดเสาแร็ก (Shelf & Bin Barcodes)
              </h3>
              <p className="text-xs text-[#8a92a6]">
                ขนาดมาตรฐาน 100 × 50 มม. (Thermal Label) พร้อมติดหน้างานจริงทันที • {filteredBins.length} ป้าย
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-[#30353d] bg-[#12161d] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#8a92a6] font-mono">เลือกโซน:</span>
            <div className="flex items-center bg-[#171c23] p-1 rounded-xl border border-[#30353d]">
              <button
                onClick={() => setSelectedZone('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedZone === 'ALL'
                    ? 'bg-[#facc15] text-[#1b1600]'
                    : 'text-[#8a92a6] hover:text-[#dee2ec]'
                }`}
              >
                ทั้งหมด ({bins.length})
              </button>
              {zones.map(z => (
                <button
                  key={z}
                  onClick={() => setSelectedZone(z)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    selectedZone === z
                      ? 'bg-[#facc15] text-[#1b1600]'
                      : 'text-[#8a92a6] hover:text-[#dee2ec]'
                  }`}
                >
                  Zone {z} ({bins.filter(b => b.startsWith(z)).length})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="ค้นหารหัส Bin..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="bg-[#171c23] border border-[#30353d] rounded-xl px-3 py-1.5 text-xs text-[#dee2ec] placeholder-[#8a92a6] focus:border-[#facc15] outline-none"
            />
          </div>
        </div>

        {/* Printable & Scrollable Labels Preview */}
        <div className="p-6 overflow-y-auto max-h-[60vh] bg-[#0c1015]">
          <div
            ref={printRef}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-2 print:gap-2 print:p-0"
          >
            {filteredBins.map(binCode => {
              const parts = binCode.split('-');
              const zone = parts[0] || 'A';
              const aisle = parts[1] || '01';
              const rack = parts[2] || '01';
              const bay = parts[3] || '01';
              const level = parts[4] || '01';

              return (
                <div
                  key={binCode}
                  className="bg-white text-black p-4 rounded-xl border-2 border-slate-300 shadow-md flex flex-col justify-between print:rounded-none print:shadow-none print:border print:border-black print:page-break-inside-avoid print:w-[100mm] print:h-[50mm]"
                  style={{ minHeight: '180px' }}
                >
                  {/* Label Top Bar */}
                  <div className="flex items-start justify-between border-b-2 border-black pb-1.5 mb-2">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest uppercase block text-slate-700">
                        {branchName} • BIN LOCATION
                      </span>
                      <h4 className="text-xl font-black font-mono tracking-tight leading-none text-black mt-0.5">
                        {binCode}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black bg-black text-white px-2 py-0.5 rounded">
                        ZONE {zone}
                      </span>
                    </div>
                  </div>

                  {/* Coordinates Badge */}
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 mb-2">
                    <span>แร็ก: {zone}-{aisle}-{rack}</span>
                    <span>ช่อง: {bay}</span>
                    <span className="text-black font-black">ชั้น: {level}</span>
                  </div>

                  {/* Barcode & QR Code */}
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <div className="grow overflow-hidden flex flex-col items-center">
                      <Barcode
                        value={binCode}
                        width={1.4}
                        height={35}
                        fontSize={11}
                        margin={0}
                        displayValue={false}
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-700 mt-0.5">
                        *{binCode}*
                      </span>
                    </div>
                    <div className="shrink-0 p-1 bg-white rounded border border-slate-300">
                      <QRCodeSVG value={binCode} size={48} level="M" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBins.length === 0 && (
            <div className="text-center py-16 text-[#8a92a6]">
              ไม่พบรหัส Location ตามเงื่อนไขค้นหา
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#30353d] bg-[#1f242c]/50 flex items-center justify-between">
          <div className="text-xs text-[#8a92a6] font-mono">
            แสดง <strong className="text-[#dee2ec]">{filteredBins.length}</strong> จากทั้งหมด {bins.length} ป้าย
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32] transition-colors"
            >
              ปิด
            </button>
            <button
              onClick={() => handlePrint()}
              className="px-6 py-2.5 rounded-xl bg-[#57ec7f] text-[#09150c] font-black text-xs hover:bg-[#72f595] transition-all flex items-center gap-2 shadow-lg shadow-[#57ec7f]/20"
            >
              <Printer className="w-4 h-4" /> สั่งพิมพ์สติ๊กเกอร์บาร์โค้ด ({filteredBins.length} ใบ)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
