'use client';

import { useState } from 'react';
import {
  Wand2,
  X,
  Building2,
  Layers,
  Truck,
  ArrowRight,
  CheckCircle2,
  Box,
  Printer,
  Sparkles,
  Info,
} from 'lucide-react';
import { RackConfig, WarehouseLayoutPayload } from '@/app/api/warehouse/layout/route';

interface WarehouseWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  onApplyLayout: (layout: WarehouseLayoutPayload, generatedBins: string[]) => Promise<void>;
}

export default function WarehouseWizardModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  onApplyLayout,
}: WarehouseWizardModalProps) {
  // Survey Form Inputs
  const [name, setName] = useState(branchName || 'คลังสินค้าใหม่');
  const [widthM, setWidthM] = useState<number>(30); // 30 meters wide
  const [lengthM, setLengthM] = useState<number>(50); // 50 meters long
  const [heightM, setHeightM] = useState<number>(9); // 9 meters ceiling
  const [storageType, setStorageType] = useState<'SELECTIVE' | 'DOUBLE_DEEP' | 'FLOOR_STACK' | 'SHELVING'>('SELECTIVE');
  const [mheType, setMheType] = useState<'REACH_TRUCK' | 'COUNTERBALANCE' | 'VNA' | 'MANUAL'>('REACH_TRUCK');
  const [levels, setLevels] = useState<number>(4);
  const [includeCrossDock, setIncludeCrossDock] = useState(true);
  const [includeFloorBulk, setIncludeFloorBulk] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Aisle Clearance by MHE
  const aisleClearance = {
    COUNTERBALANCE: 3.6,
    REACH_TRUCK: 2.8,
    VNA: 1.8,
    MANUAL: 1.5,
  }[mheType];

  // Rack Depth and Bay Width
  const rackDepth = storageType === 'SHELVING' ? 0.8 : storageType === 'FLOOR_STACK' ? 1.5 : 1.2;
  const bayWidth = storageType === 'SHELVING' ? 1.8 : 2.7; // 2.7m fits 2 Euro pallets or 2 standard 1.2m pallets
  const levelHeight = Math.max(1.4, Math.min(2.2, Math.floor(((heightM - 2) / levels) * 10) / 10));

  // Staging area at front (length reserved for staging & packing)
  const stagingLength = Math.max(8, Math.min(12, lengthM * 0.2));
  const usableLength = lengthM - stagingLength - 4; // 2m rear wall buffer
  const baysPerRack = Math.max(3, Math.floor(usableLength / bayWidth));

  // Usable width for aisles & racks
  const wallBuffer = 2.5; // clearance from side walls
  const usableWidth = widthM - (wallBuffer * 2);

  // Width needed for 1 Aisle + Pair of Racks (back-to-back)
  // [Rack] [Rack] (aisle) [Rack] [Rack]
  const rackPairWidth = rackDepth * 2;
  const unitWidth = rackPairWidth + aisleClearance;
  const estimatedAisles = Math.max(1, Math.floor(usableWidth / unitWidth));
  const estimatedRacks = estimatedAisles * 2;
  const totalBinsCount = estimatedRacks * baysPerRack * levels;

  // Generate Layout and Bins Algorithm
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const racks: RackConfig[] = [];
      const generatedBins: string[] = [];

      const zoneLetters = ['A', 'B', 'C', 'D'];
      const zoneColors: Record<string, string> = {
        A: '#57ec7f', // Green - Fast moving front
        B: '#4cd7f6', // Cyan - Medium moving
        C: '#facc15', // Yellow - Slow moving
        D: '#ffb4ab', // Red/Orange - Reserve / Deep
      };

      // Start positioning from left to right (X)
      // Center of warehouse is (0, 0)
      const startX = -(usableWidth / 2) + rackDepth;
      const startZ = -(lengthM / 2) + 4 + (baysPerRack * bayWidth) / 2;

      let rackIndex = 1;

      for (let aisle = 1; aisle <= estimatedAisles; aisle++) {
        // Zone distribution: earlier aisles = Zone A, middle = Zone B/C, back = Zone D
        const zoneIdx = Math.min(zoneLetters.length - 1, Math.floor(((aisle - 1) / estimatedAisles) * zoneLetters.length));
        const zone = zoneLetters[zoneIdx];

        // 2 Racks per Aisle (Facing each other across aisleClearance)
        const leftRackX = startX + (aisle - 1) * unitWidth;
        const rightRackX = leftRackX + rackPairWidth;

        // Rack 1 (Left of aisle)
        const rackCode1 = `${zone}-${String(aisle).padStart(2, '0')}-01`;
        racks.push({
          rackCode: rackCode1,
          zoneCode: zone,
          posX: Math.round(leftRackX * 10) / 10,
          posZ: Math.round(startZ * 10) / 10,
          rotationY: 0,
          bays: baysPerRack,
          levels,
          bayWidth,
          levelHeight,
          rackDepth,
          color: zoneColors[zone],
        });

        // Rack 2 (Right of aisle)
        const rackCode2 = `${zone}-${String(aisle).padStart(2, '0')}-02`;
        racks.push({
          rackCode: rackCode2,
          zoneCode: zone,
          posX: Math.round(rightRackX * 10) / 10,
          posZ: Math.round(startZ * 10) / 10,
          rotationY: 0,
          bays: baysPerRack,
          levels,
          bayWidth,
          levelHeight,
          rackDepth,
          color: zoneColors[zone],
        });

        // Generate Bin Codes for these racks
        [rackCode1, rackCode2].forEach(rCode => {
          for (let bay = 1; bay <= baysPerRack; bay++) {
            for (let lvl = 1; lvl <= levels; lvl++) {
              generatedBins.push(`${rCode}-${String(bay).padStart(2, '0')}-${String(lvl).padStart(2, '0')}`);
            }
          }
        });

        rackIndex += 2;
      }

      // Add Cross-Dock Staging Area if enabled
      if (includeCrossDock) {
        const xdockRackCode = 'XDOCK-01';
        const xdockBays = Math.max(3, Math.min(6, Math.floor(usableWidth / 3.5)));
        racks.push({
          rackCode: xdockRackCode,
          zoneCode: 'XDOCK',
          posX: Math.round((usableWidth / 4) * 10) / 10,
          posZ: Math.round((lengthM / 2 - stagingLength / 2) * 10) / 10,
          rotationY: 0,
          bays: xdockBays,
          levels: 1,
          bayWidth: 2.2,
          levelHeight: 1.2,
          rackDepth: 2.4,
          color: '#facc15',
          type: 'CROSS_DOCK',
        });
        for (let b = 1; b <= xdockBays; b++) {
          generatedBins.push(`${xdockRackCode}-${String(b).padStart(2, '0')}-01`);
        }
      }

      // Add Floor Bulk Storage Block if enabled
      if (includeFloorBulk) {
        const bulkRackCode = 'BULK-01';
        const bulkBays = Math.max(3, Math.min(6, Math.floor(usableWidth / 3.5)));
        racks.push({
          rackCode: bulkRackCode,
          zoneCode: 'BULK',
          posX: Math.round((-usableWidth / 4) * 10) / 10,
          posZ: Math.round((lengthM / 2 - stagingLength / 2) * 10) / 10,
          rotationY: 0,
          bays: bulkBays,
          levels: 1,
          bayWidth: 2.2,
          levelHeight: 1.2,
          rackDepth: 2.4,
          color: '#4cd7f6',
          type: 'FLOOR_BLOCK',
        });
        for (let b = 1; b <= bulkBays; b++) {
          generatedBins.push(`${bulkRackCode}-${String(b).padStart(2, '0')}-01`);
        }
      }

      const payload: WarehouseLayoutPayload = {
        branchId,
        name,
        widthM,
        lengthM,
        heightM,
        racks,
      };

      await onApplyLayout(payload, generatedBins);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#171c23] border border-[#30353d] w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#30353d] flex items-center justify-between bg-[#1f242c]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#facc15]/10 border border-[#facc15]/30 flex items-center justify-center text-[#facc15]">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#dee2ec] flex items-center gap-2">
                Warehouse Setup Wizard (ระบบสร้างผังคลังและรหัส Location ด่วน)
              </h3>
              <p className="text-xs text-[#8a92a6]">
                ตอบคำถามสำรวจหน้างาน 4 ข้อ ระบบจะคำนวณและสร้างโมเดล 3D พร้อมรหัส Bin ให้อัตโนมัติทันที
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

        {/* Survey Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#dee2ec]">
          {/* Step 1: Branch & Building Dimensions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#facc15] uppercase tracking-wider font-mono">
              <Building2 className="w-4 h-4" /> 1. มิติอาคารคลังสินค้า (Physical Dimensions)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-xs text-[#8a92a6] block mb-1">ชื่อผัง / สาขา</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-3 py-2 text-xs font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#8a92a6] block mb-1">ความกว้าง (เมตร)</label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={widthM}
                  onChange={e => setWidthM(Number(e.target.value))}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#8a92a6] block mb-1">ความยาว (เมตร)</label>
                <input
                  type="number"
                  min={15}
                  max={400}
                  value={lengthM}
                  onChange={e => setLengthM(Number(e.target.value))}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#8a92a6] block mb-1">ความสูงเพดาน (เมตร)</label>
                <input
                  type="number"
                  min={4}
                  max={25}
                  value={heightM}
                  onChange={e => setHeightM(Number(e.target.value))}
                  className="w-full bg-[#12161d] border border-[#30353d] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#dee2ec] focus:border-[#facc15] outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#8a92a6]">
              พื้นที่รวม: <span className="font-mono font-bold text-[#dee2ec]">{(widthM * lengthM).toLocaleString()} ตร.ม.</span> • สงวนพื้นที่ด้านหน้า {stagingLength.toFixed(0)}m สำหรับลานรับของ (Inbound Dock) และจุดแพ็ก (Packing Station)
            </p>
          </div>

          {/* Step 2: Storage Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#facc15] uppercase tracking-wider font-mono">
              <Layers className="w-4 h-4" /> 2. รูปแบบการจัดวางสินค้า (Storage Structure)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'SELECTIVE',
                  title: 'Selective Pallet Racking (แนะนำ)',
                  desc: 'ชั้นวางพาเลทมาตรฐาน เข้าถึงสินค้าได้ 100% ทุกพาเลท เหมาะกับคลังทั่วไปและ 3PL',
                },
                {
                  id: 'DOUBLE_DEEP',
                  title: 'Double-Deep Racks (ความจุสูง)',
                  desc: 'วางซ้อน 2 พาเลทลึก เพิ่มความจุ 30% เหมาะกับสินค้าที่มีปริมาณสต็อกหลายพาเลทต่อ SKU',
                },
                {
                  id: 'SHELVING',
                  title: 'Multi-tier Shelving / กล่องเล็ก',
                  desc: 'ชั้นวางกล่องชิ้นส่วน/อีคอมเมิร์ซ ช่องเก็บกะทัดรัด ทางเดินแคบสำหรับการเดินหยิบด้วยมือ',
                },
                {
                  id: 'FLOOR_STACK',
                  title: 'Floor Bulk Stacking (วางกองพื้น)',
                  desc: 'ไม่มีแร็กเหล็ก แบ่งบล็อกตีเส้นบนพื้น เหมาะกับสินค้าเทกอง เครื่องจักร หรือพาเลทหนัก',
                },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setStorageType(opt.id as any)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    storageType === opt.id
                      ? 'bg-[#facc15]/10 border-[#facc15] text-[#dee2ec]'
                      : 'bg-[#12161d] border-[#30353d] text-[#8a92a6] hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[#dee2ec]">{opt.title}</span>
                    {storageType === opt.id && <CheckCircle2 className="w-4 h-4 text-[#facc15]" />}
                  </div>
                  <p className="text-[11px] leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Material Handling Equipment (Aisle Width) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#facc15] uppercase tracking-wider font-mono">
              <Truck className="w-4 h-4" /> 3. เครื่องมือยก/รถโฟล์กลิฟต์ (กำหนดความกว้างทางเดิน Aisle)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'REACH_TRUCK', title: 'Reach Truck', aisle: '2.8m ทางเดิน', desc: 'ยอดนิยมสำหรับคลังสูง' },
                { id: 'COUNTERBALANCE', title: 'Forklift นั่งขับ', aisle: '3.6m ทางเดิน', desc: 'โฟล์กลิฟต์เครื่องยนต์/ไฟฟ้าทั่วไป' },
                { id: 'VNA', title: 'VNA แคบพิเศษ', aisle: '1.8m ทางเดิน', desc: 'รถยกวิ่งตามรางแม่เหล็ก' },
                { id: 'MANUAL', title: 'ลากมือ / เดินหยิบ', aisle: '1.5m ทางเดิน', desc: 'แฮนด์พาเลท / รถเข็นหยิบ' },
              ].map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setMheType(opt.id as any)}
                  className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                    mheType === opt.id
                      ? 'bg-[#facc15]/10 border-[#facc15] text-[#dee2ec]'
                      : 'bg-[#12161d] border-[#30353d] text-[#8a92a6] hover:border-slate-500'
                  }`}
                >
                  <span className="font-bold text-xs block text-[#dee2ec]">{opt.title}</span>
                  <span className="text-[11px] font-mono text-[#facc15] font-semibold">{opt.aisle}</span>
                  <p className="text-[10px] text-[#8a92a6] mt-0.5">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Levels & Height */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#facc15] uppercase tracking-wider font-mono">
              <Box className="w-4 h-4" /> 4. จำนวนชั้นวางแนวตั้ง (Rack Levels)
            </div>
            <div className="flex items-center gap-2">
              {[2, 3, 4, 5, 6].map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevels(lvl)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                    levels === lvl
                      ? 'bg-[#facc15] text-[#1b1600] border-[#facc15] font-black shadow-lg shadow-[#facc15]/20'
                      : 'bg-[#12161d] border-[#30353d] text-[#dee2ec] hover:border-slate-500'
                  }`}
                >
                  {lvl} ชั้น ({lvl * 2} พาเลท/ช่อง)
                </button>
              ))}
            </div>
          </div>

          {/* Step 5: Floor Staging & Cross-Dock Areas */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#facc15] uppercase tracking-wider font-mono">
              <Layers className="w-4 h-4" /> 5. โซนวางพื้นและเปลี่ยนถ่ายสินค้า (Floor Staging & Cross-Dock)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#12161d] border border-[#30353d] cursor-pointer hover:border-slate-500 transition-all">
                <input
                  type="checkbox"
                  checked={includeCrossDock}
                  onChange={e => setIncludeCrossDock(e.target.checked)}
                  className="mt-0.5 rounded text-[#facc15] focus:ring-0 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-[#dee2ec] block">ลาน Cross-Dock หน้าคลัง (XDOCK)</span>
                  <span className="text-[11px] text-[#8a92a6] block mt-0.5">
                    สำหรับสินค้าผ่านคลัง รับเช้า-ส่งบ่าย ไม่ยกขึ้นแร็ก ตั้งติดกับประตูสไลด์/Dock
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#12161d] border border-[#30353d] cursor-pointer hover:border-slate-500 transition-all">
                <input
                  type="checkbox"
                  checked={includeFloorBulk}
                  onChange={e => setIncludeFloorBulk(e.target.checked)}
                  className="mt-0.5 rounded text-[#4cd7f6] focus:ring-0 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-[#dee2ec] block">ลานวางพื้นเทกอง (Floor Bulk Storage)</span>
                  <span className="text-[11px] text-[#8a92a6] block mt-0.5">
                    บล็อกตีเส้นบนพื้นปูน สำหรับสินค้าหนัก เครื่องจักร หรือพาเลทซ้อนบนพื้น
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Generated Result Preview Banner */}
          <div className="bg-[#12161d] border border-[#facc15]/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#facc15] font-bold block mb-1">
                การจำลองผลลัพธ์ที่จะถูกสร้างขึ้น:
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                <span>ทางเดิน: <strong className="text-[#dee2ec]">{estimatedAisles} ช่อง</strong></span>
                <span>แถวแร็ก: <strong className="text-[#dee2ec]">{estimatedRacks} แถว</strong></span>
                <span>ช่วงเสาต่อแถว: <strong className="text-[#dee2ec]">{baysPerRack} ช่วงเสา</strong></span>
                <span>จำนวนชั้น: <strong className="text-[#dee2ec]">{levels} ชั้น</strong></span>
                <span className="text-[#57ec7f] font-bold">
                  รวมความจุ: {totalBinsCount.toLocaleString()} โลเคชัน (Bins)
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-[#8a92a6] font-mono">พร้อมสร้างรหัส Bin และบาร์โค้ด</div>
              <div className="text-xs font-bold text-[#dee2ec]">A-01-01 ถึง D-{String(baysPerRack).padStart(2, '0')}-{String(levels).padStart(2, '0')}</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#30353d] bg-[#1f242c]/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32] transition-colors"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#facc15] text-[#1b1600] font-black text-xs hover:bg-[#ffe043] transition-all flex items-center gap-2 shadow-lg shadow-[#facc15]/20 disabled:opacity-50"
          >
            {loading ? (
              'กำลังประมวลผลผังคลังและบันทึก...'
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> สร้างผัง 3D และรหัส Location ทันที
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
