'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Layers,
  Search,
  RefreshCw,
  Split,
  Hammer,
  Sparkles,
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';
import { BillOfMaterials, BomComponent } from '@/lib/kittingEngine';
import { errorMessage } from '@/lib/errors';

export default function KittingPage() {
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBom, setSelectedBom] = useState<BillOfMaterials | null>(null);
  const [buildQty, setBuildQty] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal new BOM
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKitSku, setNewKitSku] = useState('');
  const [newKitName, setNewKitName] = useState('');
  const [newLaborCost, setNewLaborCost] = useState(0);
  const [componentsList, setComponentsList] = useState<BomComponent[]>([]);

  const fetchBoms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kitting');
      const data = await res.json();
      if (data.boms) {
        setBoms(data.boms);
        if (data.boms.length > 0 && !selectedBom) {
          setSelectedBom(data.boms[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoms();
  }, []);

  const handleBuildOrDisassemble = async (action: 'ASSEMBLE' | 'DISASSEMBLE') => {
    if (!selectedBom) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/kitting/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomId: selectedBom.id,
          quantity: Number(buildQty),
          action
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/kitting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitSku: newKitSku,
          kitName: newKitName,
          assemblyLaborCost: newLaborCost,
          components: componentsList
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('สร้างสูตร BOM สำเร็จ');
        setShowCreateModal(false);
        fetchBoms();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const filteredBoms = boms.filter(b => 
    b.kitName.toLowerCase().includes(search.toLowerCase()) ||
    b.kitSku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 font-mono text-[#dee2ec]">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* Header Tactical Banner */}
        <div className="relative mx-auto flex flex-col gap-4 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#57ec7f] via-[#4cd7f6] to-[#facc15]" />
          <div className="relative z-10">
            <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#57ec7f] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#57ec7f]" />
              BILL OF MATERIALS (BOM) & KITTING WORKSHOP
            </p>
            <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
              <div className="bg-[#57ec7f] text-[#0a2012] p-2 rounded-lg shadow-md">
                <Boxes className="w-6 h-6" />
              </div>
              Kitting & Bundling Engine (BOM Management)
            </h1>
            <p className="text-[#8a92a6] font-mono text-xs">
              บริหารสูตรสินค้าชุด (Bill of Materials), รวมชิ้นส่วนย่อยเป็นชุดเซ็ต และแยกชิ้นส่วนคืนคลังพร้อมระบบตรวจสอบสต็อก
            </p>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={fetchBoms}
              className="p-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-xl border border-[#30353d] transition"
              title="รีเฟรช"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-[#57ec7f] hover:bg-[#43d469] text-[#0a2012] rounded-xl shadow-lg shadow-[#57ec7f]/20 font-black transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> + กำหนดสูตร BOM ใหม่
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: BOM List */}
          <div className="bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
              <h2 className="font-bold text-[#dee2ec] text-xs">สูตรสินค้าชุด ({boms.length})</h2>
              <div className="relative w-36">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
                <input
                  type="text"
                  placeholder="ค้นหาชุด..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 text-xs bg-[#12161d] border border-[#30353d] rounded-lg text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-[#8a92a6] text-xs">กำลังโหลด...</div>
              ) : filteredBoms.length === 0 ? (
                <div className="p-8 text-center text-[#8a92a6] text-xs border border-[#30353d] rounded-xl bg-[#12161d]">
                  <Layers className="w-8 h-8 text-[#8a92a6] mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-[#dee2ec]">ยังไม่มีสูตรสินค้าชุด (BOM)</p>
                  <p>กดปุ่ม "+ กำหนดสูตร BOM ใหม่" เพื่อสร้างโครงสร้างสินค้าจัดเซ็ต</p>
                </div>
              ) : filteredBoms.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBom(b)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    selectedBom?.id === b.id
                      ? 'bg-[#57ec7f]/10 border-[#57ec7f] ring-1 ring-[#57ec7f]'
                      : 'bg-[#12161d] hover:bg-white/5 border-[#30353d]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#dee2ec] text-xs">{b.kitName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#57ec7f]/20 text-[#57ec7f] font-bold border border-[#57ec7f]/30">
                      v{b.version}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#4cd7f6]">{b.kitSku}</div>
                  <div className="mt-2 text-[11px] text-[#8a92a6]">
                    ประกอบด้วย <strong className="text-[#57ec7f]">{b.components.length}</strong> ชิ้นส่วน
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: BOM Details & Assembly Terminal */}
          <div className="lg:col-span-2 space-y-6">
            {selectedBom ? (
              <div className="bg-[#171c23]/90 p-6 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl space-y-6">
                <div className="flex items-center justify-between border-b border-[#30353d] pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-[#57ec7f] uppercase tracking-widest">
                      Bill of Materials (BOM Master)
                    </span>
                    <h2 className="text-xl font-black text-[#dee2ec] mt-0.5">{selectedBom.kitName}</h2>
                    <p className="text-xs font-mono text-[#4cd7f6]">Parent SKU: {selectedBom.kitSku}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/30">
                    {selectedBom.status}
                  </span>
                </div>

                {/* Component breakdown table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a92a6]">
                    รายการชิ้นส่วนประกอบ (Components per 1 Kit)
                  </h3>
                  <div className="border border-[#30353d] rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left font-mono">
                      <thead className="bg-[#12161d] border-b border-[#30353d] text-[#8a92a6] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">รหัสชิ้นส่วน (Component SKU)</th>
                          <th className="py-2.5 px-3">ชื่อสินค้าชิ้นส่วน</th>
                          <th className="py-2.5 px-3 text-center">จำนวนต่อชุด</th>
                          <th className="py-2.5 px-3 text-center">ต้องใช้รวม ({buildQty} ชุด)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#262c36]">
                        {selectedBom.components.map((comp) => (
                          <tr key={comp.componentSku} className="hover:bg-white/5">
                            <td className="py-2.5 px-3 font-mono font-bold text-[#dee2ec]">{comp.componentSku}</td>
                            <td className="py-2.5 px-3 text-[#dee2ec]">{comp.componentName}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#8a92a6]">
                              {comp.quantity} {comp.unit}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-[#57ec7f] bg-[#57ec7f]/5">
                              {comp.quantity * buildQty} {comp.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Box: Assemble or Disassemble */}
                <div className="bg-[#12161d] p-5 rounded-xl border border-[#30353d] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-[#8a92a6]">จำนวนชุดที่ต้องการจัดการ:</label>
                      <input
                        type="number"
                        min="1"
                        value={buildQty}
                        onChange={(e) => setBuildQty(Math.max(1, Number(e.target.value)))}
                        className="w-24 px-3 py-1.5 border border-[#30353d] rounded-xl font-mono font-black text-base text-center bg-[#1c222b] text-[#dee2ec]"
                      />
                      <span className="text-xs text-[#8a92a6]">ชุด</span>
                    </div>
                    <div className="text-xs text-[#8a92a6]">
                      ค่าแรงประกอบรวม: <strong className="text-[#dee2ec]">฿{selectedBom.assemblyLaborCost * buildQty}</strong>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#262c36]">
                    <button
                      onClick={() => handleBuildOrDisassemble('ASSEMBLE')}
                      disabled={isProcessing}
                      className="flex-1 px-5 py-3 bg-[#57ec7f] hover:bg-[#43d469] text-[#0a2012] rounded-xl font-black text-xs shadow-lg shadow-[#57ec7f]/20 transition flex items-center justify-center gap-2"
                    >
                      <Hammer className="w-4 h-4" />
                      สั่งประกอบชุดเซ็ต (Assemble Kit & Deduct Stock)
                    </button>

                    <button
                      onClick={() => handleBuildOrDisassemble('DISASSEMBLE')}
                      disabled={isProcessing}
                      className="px-5 py-3 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] border border-[#30353d] rounded-xl font-bold text-xs transition flex items-center justify-center gap-2"
                    >
                      <Split className="w-4 h-4" />
                      แยกชิ้นส่วนคืนคลัง (De-kitting)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-[#8a92a6] bg-[#171c23]/90 rounded-xl border border-[#30353d]">
                กรุณาเลือกสูตร BOM จากรายการด้านซ้าย
              </div>
            )}
          </div>
        </div>

        {/* Modal new BOM */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs font-mono text-[#dee2ec] space-y-4">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#57ec7f] via-[#4cd7f6] to-[#facc15]" />
              <h3 className="text-base font-black text-[#dee2ec]">กำหนดสูตรสินค้าชุดใหม่ (New BOM)</h3>
              <form onSubmit={handleCreateBom} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">รหัสชุดสินค้า (Parent SKU) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น KIT-CAMPING-01"
                      value={newKitSku}
                      onChange={(e) => setNewKitSku(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">ชื่อชุดสินค้า *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ชุดแคมป์ปิ้งพรีเมียม"
                      value={newKitName}
                      onChange={(e) => setNewKitName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">ค่าแรงประกอบต่อชุด (฿)</label>
                  <input
                    type="number"
                    value={newLaborCost}
                    onChange={(e) => setNewLaborCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                  />
                </div>

                <div className="p-3 bg-[#12161d] rounded-xl border border-[#30353d] space-y-2">
                  <span className="font-bold text-[#8a92a6] block text-[11px]">ชิ้นส่วนในชุด (ตัวอย่างอัตโนมัติ):</span>
                  {componentsList.map((c, i) => (
                    <div key={i} className="flex justify-between items-center text-[#dee2ec]">
                      <span>{c.componentSku} - {c.componentName}</span>
                      <span className="font-bold text-[#57ec7f]">{c.quantity} {c.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#30353d]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[#252a32] text-[#8a92a6] hover:text-white rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#57ec7f] hover:bg-[#43d469] text-[#0a2012] rounded-xl font-black shadow"
                  >
                    สร้างสูตร BOM
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
