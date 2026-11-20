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
  const [palletMode, setPalletMode] = useState<'PALLET' | 'NON_PALLET'>('PALLET');
  const [palletsPerBay, setPalletsPerBay] = useState<number>(2);
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

  // Rack Depth and Bay Width based on Pallet vs Non-Pallet Mode
  const isNonPallet = palletMode === 'NON_PALLET' || storageType === 'SHELVING';
  const rackDepth = isNonPallet ? 0.8 : storageType === 'FLOOR_STACK' ? 1.5 : 1.2;
  const bayWidth = isNonPallet ? 1.8 : (palletsPerBay === 3 ? 3.6 : palletsPerBay === 1 ? 1.5 : 2.7);
  const levelHeight = isNonPallet
    ? Math.max(0.4, Math.min(1.4, Math.floor(((heightM - 1.5) / levels) * 10) / 10))
    : Math.max(1.2, Math.min(2.6, Math.floor(((heightM - 2) / levels) * 10) / 10));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 w-full max-w-3xl rounded-[24px] shadow-2xl text-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Warehouse Setup Wizard (ระบบสร้างผังคลังและรหัส Location ด่วน)
              </h3>
              <p className="text-xs text-slate-500">
                ตอบคำถามสำรวจหน้างาน 4 ข้อ ระบบจะคำนวณและสร้างโมเดล 3D พร้อมรหัส Bin ให้อัตโนมัติทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Survey Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-900">
          {/* Step 1: Branch & Building Dimensions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 uppercase tracking-wider font-mono">
              <Building2 className="w-4 h-4" /> 1. มิติอาคารคลังสินค้า (Physical Dimensions)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-xs text-slate-600 block mb-1 font-semibold">ชื่อผัง / สาขา</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">ความกว้าง (เมตร)</label>
                <input
                  type="number"
                  min={10}
                  max={200}
                  value={widthM}
                  onChange={e => setWidthM(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">ความยาว (เมตร)</label>
                <input
                  type="number"
                  min={15}
                  max={400}
                  value={lengthM}
                  onChange={e => setLengthM(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">ความสูงเพดาน (เมตร)</label>
                <input
                  type="number"
                  min={4}
                  max={25}
                  value={heightM}
                  onChange={e => setHeightM(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              พื้นที่รวม: <span className="font-mono font-bold text-slate-900">{(widthM * lengthM).toLocaleString()} ตร.ม.</span> • สงวนพื้นที่ด้านหน้า {stagingLength.toFixed(0)}m สำหรับลานรับของ (Inbound Dock) และจุดแพ็ก (Packing Station)
            </p>
          </div>

          {/* Step 2: Storage Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 uppercase tracking-wider font-mono">
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
                      ? 'bg-emerald-50 border-emerald-500 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{opt.title}</span>
                    {storageType === opt.id && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] leading-relaxed">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Material Handling Equipment (Aisle Width) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 uppercase tracking-wider font-mono">
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
                      ? 'bg-emerald-50 border-emerald-500 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="font-bold text-xs block text-slate-900">{opt.title}</span>
                  <span className="text-[11px] font-mono text-emerald-600 font-semibold">{opt.aisle}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Racking Levels & Pallet vs Non-Pallet Mode */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 uppercase tracking-wider font-mono">
                <Box className="w-4 h-4" /> 4. จำนวนชั้นวางและรูปแบบการจัดเก็บ (Levels & Loading Mode)
              </div>
              
              {/* Toggle Pallet vs Non-Pallet */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setPalletMode('PALLET');
                    if (levels > 6) setLevels(4);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    palletMode === 'PALLET'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  วางบนพาเลท (Palletized)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPalletMode('NON_PALLET');
                    if (levels < 4) setLevels(5);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    palletMode === 'NON_PALLET'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ไม่ออนพาเลท (วางกล่อง/ชิ้นสินค้า)
                </button>
              </div>
            </div>

            {/* Quick Level Preset Buttons + Custom Input */}
            <div className="flex flex-wrap items-center gap-2">
              {(palletMode === 'PALLET' ? [2, 3, 4, 5, 6] : [3, 4, 5, 6, 8, 10]).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevels(lvl)}
                  className={`flex-1 min-w-[70px] py-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                    levels === lvl
                      ? 'bg-emerald-600 text-white border-emerald-600 font-black shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {lvl} ชั้น
                  <span className="block text-[10px] font-normal opacity-80">
                    {palletMode === 'PALLET' ? `(${lvl * palletsPerBay} พาเลท/ช่อง)` : `(~${((heightM - 1.5)/lvl).toFixed(1)}m/ชั้น)`}
                  </span>
                </button>
              ))}

              {/* Custom Number Input */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-[10px] text-slate-500 font-mono">ระบุเอง:</span>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={levels}
                  onChange={e => setLevels(Math.max(1, Math.min(15, Number(e.target.value))))}
                  className="w-12 bg-transparent text-xs font-mono font-bold text-emerald-700 outline-none text-center"
                />
                <span className="text-xs text-slate-500">ชั้น</span>
              </div>
            </div>

            {/* Optional Pallets per Bay if in Pallet mode */}
            {palletMode === 'PALLET' ? (
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-600">ความจุพาเลทต่อ 1 ช่วงเสา (Bay):</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPalletsPerBay(p)}
                      className={`px-3 py-1 rounded-lg font-mono font-bold text-xs ${
                        palletsPerBay === p
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {p} พาเลท/ช่วงเสา
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-sky-50 px-4 py-2.5 rounded-xl border border-sky-200 text-xs flex items-center gap-2 text-sky-700">
                <Info className="w-4 h-4 shrink-0" />
                <span>โหมดไม่ออนพาเลท: ชั้นวางจะถูกปรับความลึกเป็น 0.8m สำหรับวางกล่อง/ชิ้นส่วนชิ้นเล็กเพื่อความสะดวกในการเดินหยิบ</span>
              </div>
            )}
          </div>

          {/* Step 5: Floor Staging & Cross-Dock Areas */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 uppercase tracking-wider font-mono">
              <Layers className="w-4 h-4" /> 5. โซนวางพื้นและเปลี่ยนถ่ายสินค้า (Floor Staging & Cross-Dock)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300 transition-all">
                <input
                  type="checkbox"
                  checked={includeCrossDock}
                  onChange={e => setIncludeCrossDock(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-600 focus:ring-0 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">ลาน Cross-Dock หน้าคลัง (XDOCK)</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    สำหรับสินค้าผ่านคลัง รับเช้า-ส่งบ่าย ไม่ยกขึ้นแร็ก ตั้งติดกับประตูสไลด์/Dock
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300 transition-all">
                <input
                  type="checkbox"
                  checked={includeFloorBulk}
                  onChange={e => setIncludeFloorBulk(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-600 focus:ring-0 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">ลานวางพื้นเทกอง (Floor Bulk Storage)</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    บล็อกตีเส้นบนพื้นปูน สำหรับสินค้าหนัก เครื่องจักร หรือพาเลทซ้อนบนพื้น
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Generated Result Preview Banner */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 font-bold block mb-1">
                การจำลองผลลัพธ์ที่จะถูกสร้างขึ้น:
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-600">
                <span>ทางเดิน: <strong className="text-slate-900">{estimatedAisles} ช่อง</strong></span>
                <span>แถวแร็ก: <strong className="text-slate-900">{estimatedRacks} แถว</strong></span>
                <span>ช่วงเสาต่อแถว: <strong className="text-slate-900">{baysPerRack} ช่วงเสา</strong></span>
                <span>จำนวนชั้น: <strong className="text-slate-900">{levels} ชั้น</strong></span>
                <span className="text-emerald-700 font-bold">
                  รวมความจุ: {totalBinsCount.toLocaleString()} โลเคชัน (Bins)
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-500 font-mono">พร้อมสร้างรหัส Bin และบาร์โค้ด</div>
              <div className="text-xs font-bold text-slate-900">A-01-01 ถึง D-{String(baysPerRack).padStart(2, '0')}-{String(levels).padStart(2, '0')}</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
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
