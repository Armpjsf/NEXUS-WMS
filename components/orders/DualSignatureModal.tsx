'use client';

import { useState, useRef, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { X, Check, Trash2, Printer, Plus, MapPin, ClipboardCheck, UserCheck, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const SignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any;

export interface DeliveryDestination {
  drop: number;
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface QCSignatures {
  clientSignature?: string;
  clientName?: string;
  staffSignature?: string;
  staffName?: string;
  signedAt?: string;
  notes?: string;
}

interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  location?: string;
}

interface DualSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    orderNo: string;
    customerName: string;
    phone?: string;
    shipAddress?: string;
    items: OrderItem[];
    totalQty: number;
    destinations?: DeliveryDestination[];
    qcSignatures?: QCSignatures;
  };
  onSaveSuccess: () => void;
}

// Reusable responsive signature pad
const CanvasPad = memo(({
  sigRef,
  onClear,
  placeholder,
  hasExisting,
  existingUrl,
  onResetExisting,
}: {
  sigRef: any;
  onClear: () => void;
  placeholder: string;
  hasExisting?: boolean;
  existingUrl?: string;
  onResetExisting?: () => void;
}) => {
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = sigRef.current?.getCanvas();
      if (canvas) {
        const ratio = Math.max(window.devicePixelRatio || 1, 2);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        sigRef.current?.clear();
      }
    };
    window.addEventListener('resize', resizeCanvas);
    const timer = setTimeout(resizeCanvas, 150);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearTimeout(timer);
    };
  }, [sigRef]);

  if (hasExisting && existingUrl) {
    return (
      <div className="relative h-44 bg-slate-50 border-2 border-emerald-300 rounded-2xl p-2 flex flex-col items-center justify-center overflow-hidden">
        <img src={existingUrl} alt="Signature" className="max-h-28 object-contain" />
        <span className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> ลงนามเรียบร้อยแล้ว
        </span>
        {onResetExisting && (
          <button
            type="button"
            onClick={onResetExisting}
            className="absolute top-2 right-2 px-2.5 py-1 text-xs bg-white text-slate-600 rounded-lg shadow-xs border border-slate-200 hover:text-rose-600 hover:border-rose-300"
          >
            เซ็นใหม่
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-44 bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-inner touch-none">
      <SignatureCanvas
        ref={sigRef}
        penColor="#0f172a"
        backgroundColor="#ffffff"
        velocityFilterWeight={0.1}
        minWidth={1.5}
        maxWidth={3}
        canvasProps={{
          className: 'w-full h-full cursor-crosshair',
          style: { touchAction: 'none' },
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 select-none">
        <span className="text-xl font-bold uppercase tracking-widest text-slate-400">{placeholder}</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); onClear(); }}
        className="absolute top-2 right-2 p-2 bg-slate-100/90 text-slate-500 rounded-xl shadow hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95"
        title="ล้างลายเซ็น"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
});

CanvasPad.displayName = 'CanvasPad';

export default function DualSignatureModal({ isOpen, onClose, order, onSaveSuccess }: DualSignatureModalProps) {
  const [clientName, setClientName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [saving, setSaving] = useState(false);

  // Existing signatures
  const [existingClientSig, setExistingClientSig] = useState<string | null>(null);
  const [existingStaffSig, setExistingStaffSig] = useState<string | null>(null);

  // Multi-drop destinations
  const [destinations, setDestinations] = useState<DeliveryDestination[]>([]);

  const clientSigRef = useRef<any>(null);
  const staffSigRef = useRef<any>(null);

  useEffect(() => {
    if (order) {
      setClientName(order.qcSignatures?.clientName || order.customerName || '');
      setStaffName(order.qcSignatures?.staffName || 'เจ้าหน้าที่ QC');
      setExistingClientSig(order.qcSignatures?.clientSignature || null);
      setExistingStaffSig(order.qcSignatures?.staffSignature || null);

      if (order.destinations && order.destinations.length > 0) {
        setDestinations(order.destinations);
      } else {
        setDestinations([{
          drop: 1,
          name: order.customerName || 'ผู้รับ',
          phone: order.phone || '',
          address: order.shipAddress || '',
          notes: '',
        }]);
      }
    }
  }, [order, isOpen]);

  if (!isOpen) return null;

  const addDrop = () => {
    const nextDropNum = destinations.length + 1;
    setDestinations([
      ...destinations,
      {
        drop: nextDropNum,
        name: '',
        phone: '',
        address: '',
        notes: '',
      },
    ]);
  };

  const removeDrop = (index: number) => {
    if (destinations.length <= 1) {
      toast.error('ต้องมีจุดส่งปลายทางอย่างน้อย 1 จุด');
      return;
    }
    const filtered = destinations.filter((_, i) => i !== index);
    const renumbered = filtered.map((d, i) => ({ ...d, drop: i + 1 }));
    setDestinations(renumbered);
  };

  const updateDrop = (index: number, field: keyof DeliveryDestination, val: any) => {
    const copy = [...destinations];
    copy[index] = { ...copy[index], [field]: val };
    setDestinations(copy);
  };

  const handleSave = async (andPrint: boolean = false) => {
    let clientDataUrl = existingClientSig;
    if (!existingClientSig && clientSigRef.current) {
      if (!clientSigRef.current.isEmpty()) {
        clientDataUrl = clientSigRef.current.getCanvas().toDataURL('image/png');
      }
    }

    let staffDataUrl = existingStaffSig;
    if (!existingStaffSig && staffSigRef.current) {
      if (!staffSigRef.current.isEmpty()) {
        staffDataUrl = staffSigRef.current.getCanvas().toDataURL('image/png');
      }
    }

    if (!clientDataUrl && !staffDataUrl) {
      toast.error('กรุณาลงลายเซ็นอย่างน้อย 1 ฝ่าย (หรือเซ็นทั้ง 2 ฝ่าย)');
      return;
    }

    setSaving(true);
    const loadToast = toast.loading('กำลังบันทึกการตรวจรับมอบ...');
    try {
      const qcSignatures: QCSignatures = {
        clientSignature: clientDataUrl || undefined,
        clientName: clientName.trim(),
        staffSignature: staffDataUrl || undefined,
        staffName: staffName.trim(),
        signedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          destinations,
          qcSignatures,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      toast.success('บันทึกการตรวจรับมอบและลายเซ็น 2 ฝ่ายเรียบร้อย', { id: loadToast });
      onSaveSuccess();
      onClose();

      if (andPrint) {
        window.open(`/print/qc-handover?id=${order.id}`, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการบันทึก', { id: loadToast });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-teal-700 via-emerald-600 to-cyan-700 text-white flex justify-between items-center sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">ใบตรวจรับมอบสินค้า (QC Handover Slip)</h2>
              <div className="text-xs text-teal-100 font-mono flex items-center gap-2 mt-0.5">
                <span>ออเดอร์: {order.orderNo}</span>
                <span>•</span>
                <span>ลูกค้า: {order.customerName}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Items Summary Table */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> รายการสินค้าที่ตรวจรับมอบ ({order.items.length} รายการ)
              </span>
              <span className="text-xs font-black text-slate-800 bg-white px-3 py-1 rounded-xl border border-slate-200">
                รวมทั้งหมด <span className="text-emerald-600 font-mono text-sm font-black">{order.totalQty}</span> ชิ้น
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl bg-white border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="py-2 px-3 w-8">#</th>
                    <th className="py-2 px-3">รหัสสินค้า</th>
                    <th className="py-2 px-3">ชื่อสินค้า</th>
                    <th className="py-2 px-3 text-right">จำนวนตรวจรับ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((it, i) => (
                    <tr key={it.sku + i} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{it.sku}</td>
                      <td className="py-2 px-3 font-medium text-slate-700">{it.name}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">{it.qty} ชิ้น</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-Drop Delivery Destinations */}
          <div className="bg-cyan-50/40 border border-cyan-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-xs font-black uppercase tracking-wider text-cyan-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-cyan-600" /> สถานที่จัดส่งปลายทาง (รองรับหลายดรอป / Multi-Drop)
              </div>
              <button
                type="button"
                onClick={addDrop}
                className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มดรอปถัดไป
              </button>
            </div>

            <div className="space-y-3">
              {destinations.map((drop, idx) => (
                <div key={idx} className="bg-white border border-cyan-100 rounded-xl p-3.5 relative shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-lg">
                      ดรอปที่ {drop.drop}
                    </span>
                    {destinations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDrop(idx)}
                        className="text-slate-400 hover:text-rose-600 text-xs font-medium flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> ลบจุดนี้
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">ชื่อผู้รับ / จุดส่ง</label>
                      <input
                        type="text"
                        placeholder="เช่น สาขาพระราม 9 หรือ คุณสมหมาย"
                        value={drop.name}
                        onChange={(e) => updateDrop(idx, 'name', e.target.value)}
                        className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">เบอร์โทรศัพท์</label>
                      <input
                        type="text"
                        placeholder="081-xxx-xxxx"
                        value={drop.phone}
                        onChange={(e) => updateDrop(idx, 'phone', e.target.value)}
                        className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">ที่อยู่จัดส่งปลายทาง</label>
                    <textarea
                      rows={2}
                      placeholder="ระบุที่อยู่จัดส่ง เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                      value={drop.address}
                      onChange={(e) => updateDrop(idx, 'address', e.target.value)}
                      className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dual Digital Signature Pads */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> การลงนามดิจิทัลยืนยัน 2 ฝ่าย (Dual Signatures)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pad 1: Customer (Sender) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-800">1. ลายเซ็นพนักงานลูกค้า</span>
                    <div className="text-[11px] text-slate-500">(ผู้ส่งมอบสินค้า)</div>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                    ฝั่งลูกค้า
                  </span>
                </div>

                <CanvasPad
                  sigRef={clientSigRef}
                  onClear={() => clientSigRef.current?.clear()}
                  placeholder="เซ็นชื่อที่นี่ (ผู้ส่งมอบ)"
                  hasExisting={Boolean(existingClientSig)}
                  existingUrl={existingClientSig || undefined}
                  onResetExisting={() => setExistingClientSig(null)}
                />

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    ชื่อ-นามสกุล ผู้ส่งมอบ (ลูกค้า)
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="เช่น คุณวิชัย / ตัวแทนลูกค้า"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Pad 2: Warehouse QC Staff (Receiver) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-800">2. ลายเซ็นเจ้าหน้าที่คลัง</span>
                    <div className="text-[11px] text-slate-500">(ผู้ตรวจรับมอบสินค้า QC)</div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                    ฝั่งคลัง QC
                  </span>
                </div>

                <CanvasPad
                  sigRef={staffSigRef}
                  onClear={() => staffSigRef.current?.clear()}
                  placeholder="เซ็นชื่อที่นี่ (ผู้ตรวจรับ)"
                  hasExisting={Boolean(existingStaffSig)}
                  existingUrl={existingStaffSig || undefined}
                  onResetExisting={() => setExistingStaffSig(null)}
                />

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    ชื่อ-นามสกุล ผู้ตรวจรับ (QC คลังเรา)
                  </label>
                  <input
                    type="text"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="เช่น เจ้าหน้าที่ QC พรชัย"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 text-xs transition-colors"
          >
            ปิดหน้าต่าง
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>บันทึก & พิมพ์ใบตรวจรับ</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตรวจรับ'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
