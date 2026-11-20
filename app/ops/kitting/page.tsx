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
  Trash2,
  X,
} from 'lucide-react';
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
  const [products, setProducts] = useState<any[]>([]);
  const [compSkuInput, setCompSkuInput] = useState('');
  const [compNameInput, setCompNameInput] = useState('');
  const [compQtyInput, setCompQtyInput] = useState(1);

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
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setProducts(d);
      })
      .catch(() => {});
  }, []);

  const handleAddComponent = () => {
    const skuTrimmed = compSkuInput.trim();
    if (!skuTrimmed) {
      toast.error('กรุณาเลือกหรือระบุรหัสชิ้นส่วน (Component SKU)');
      return;
    }
    const qty = Math.max(1, Number(compQtyInput) || 1);
    const matchedProd = products.find(
      (p) =>
        (p.id || p.sku || '').toLowerCase() === skuTrimmed.toLowerCase() ||
        (p.name || '').toLowerCase() === skuTrimmed.toLowerCase()
    );
    const finalSku = matchedProd?.id || matchedProd?.sku || skuTrimmed;
    const finalName = compNameInput.trim() || matchedProd?.name || finalSku;
    const finalUnit = matchedProd?.unit || 'ชิ้น';

    setComponentsList((prev) => {
      const existingIdx = prev.findIndex((c) => c.componentSku === finalSku);
      if (existingIdx >= 0) {
        return prev.map((c, idx) => (idx === existingIdx ? { ...c, quantity: c.quantity + qty } : c));
      }
      return [
        ...prev,
        {
          componentSku: finalSku,
          componentName: finalName,
          quantity: qty,
          unit: finalUnit,
        },
      ];
    });
    setCompSkuInput('');
    setCompNameInput('');
    setCompQtyInput(1);
  };

  const handleRemoveComponent = (index: number) => {
    setComponentsList((prev) => prev.filter((_, idx) => idx !== index));
  };

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
          action,
        }),
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
    if (componentsList.length === 0) {
      toast.error('กรุณาเพิ่มชิ้นส่วนประกอบอย่างน้อย 1 รายการ');
      return;
    }
    try {
      const res = await fetch('/api/kitting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kitSku: newKitSku,
          kitName: newKitName,
          assemblyLaborCost: newLaborCost,
          components: componentsList,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('สร้างสูตร BOM สำเร็จ');
        setShowCreateModal(false);
        setNewKitSku('');
        setNewKitName('');
        setNewLaborCost(0);
        setComponentsList([]);
        fetchBoms();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const filteredBoms = boms.filter(
    (b) =>
      b.kitName.toLowerCase().includes(search.toLowerCase()) ||
      b.kitSku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Open Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Bill of Materials & Kitting Workshop
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 border border-emerald-500/20 text-emerald-700">
                <Boxes className="w-5 h-5" />
              </span>
              <span>Kitting & Bundling Engine (BOM Management)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              บริหารสูตรสินค้าชุด (Bill of Materials), รวมชิ้นส่วนย่อยเป็นชุดเซ็ต และแยกชิ้นส่วนคืนคลังพร้อมระบบตรวจสอบสต็อก
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchBoms}
              disabled={loading}
              className="p-2.5 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full border border-slate-200/80 shadow-xs transition disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-sm font-semibold transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" /> กำหนดสูตร BOM ใหม่
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: BOM List */}
          <div className="nx-glass-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
              <h2 className="font-bold text-slate-900 text-sm">
                สูตรสินค้าชุด <span className="text-slate-500 font-normal tabular-nums">({boms.length})</span>
              </h2>
              <div className="relative w-40">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชุด..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/90 border border-slate-200/80 rounded-full text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-0.5">
              {loading ? (
                <div className="p-6 text-center text-slate-500 text-xs">กำลังโหลด...</div>
              ) : filteredBoms.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-2xl bg-white/50">
                  <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">ยังไม่มีสูตรสินค้าชุด (BOM)</p>
                  <p className="mt-1">กดปุ่ม &quot;กำหนดสูตร BOM ใหม่&quot; เพื่อสร้างโครงสร้างสินค้าจัดเซ็ต</p>
                </div>
              ) : (
                filteredBoms.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBom(b)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      selectedBom?.id === b.id
                        ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30 shadow-xs'
                        : 'bg-white/75 hover:bg-white border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">{b.kitName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 font-bold border border-emerald-500/20">
                        v{b.version}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-sky-700 font-semibold">{b.kitSku}</div>
                    <div className="mt-2 text-[11px] text-slate-600 tabular-nums">
                      ประกอบด้วย <strong className="text-emerald-700">{b.components.length}</strong> ชิ้นส่วน
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: BOM Details & Assembly Terminal */}
          <div className="lg:col-span-2 space-y-6">
            {selectedBom ? (
              <div className="nx-glass-card p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                      Bill of Materials (BOM Master)
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-0.5">{selectedBom.kitName}</h2>
                    <p className="text-xs font-mono text-sky-700 font-semibold">Parent SKU: {selectedBom.kitSku}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
                    {selectedBom.status}
                  </span>
                </div>

                {/* Component breakdown table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    รายการชิ้นส่วนประกอบ (Components per 1 Kit)
                  </h3>
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden text-xs bg-white/60">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">รหัสชิ้นส่วน (Component SKU)</th>
                          <th className="py-3 px-4">ชื่อสินค้าชิ้นส่วน</th>
                          <th className="py-3 px-4 text-center">จำนวนต่อชุด</th>
                          <th className="py-3 px-4 text-center">ต้องใช้รวม ({buildQty} ชุด)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {selectedBom.components.map((comp) => (
                          <tr key={comp.componentSku} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{comp.componentSku}</td>
                            <td className="py-3 px-4 text-slate-800">{comp.componentName}</td>
                            <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600 tabular-nums">
                              {comp.quantity} {comp.unit}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 bg-emerald-500/8 tabular-nums">
                              {comp.quantity * buildQty} {comp.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Box: Assemble or Disassemble */}
                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-slate-700">จำนวนชุดที่ต้องการจัดการ:</label>
                      <input
                        type="number"
                        min="1"
                        value={buildQty}
                        onChange={(e) => setBuildQty(Math.max(1, Number(e.target.value)))}
                        className="w-24 px-3 py-1.5 border border-slate-200/80 rounded-xl font-mono font-bold text-base text-center bg-white text-slate-900 tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-xs text-slate-600">ชุด</span>
                    </div>
                    <div className="text-xs text-slate-600 tabular-nums">
                      ค่าแรงประกอบรวม:{' '}
                      <strong className="text-slate-900 font-mono">
                        ฿{(selectedBom.assemblyLaborCost * buildQty).toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-200/70">
                    <button
                      onClick={() => handleBuildOrDisassemble('ASSEMBLE')}
                      disabled={isProcessing}
                      className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Hammer className="w-4 h-4" />
                      สั่งประกอบชุดเซ็ต (Assemble Kit & Deduct Stock)
                    </button>

                    <button
                      onClick={() => handleBuildOrDisassemble('DISASSEMBLE')}
                      disabled={isProcessing}
                      className="px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200/80 rounded-full font-semibold text-xs shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Split className="w-4 h-4" />
                      แยกชิ้นส่วนคืนคลัง (De-kitting)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="nx-glass-card p-12 text-center text-slate-500 text-sm">
                กรุณาเลือกสูตร BOM จากรายการด้านซ้าย
              </div>
            )}
          </div>
        </div>

        {/* Modal new BOM */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 text-xs text-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <h3 className="text-base font-bold text-slate-900">กำหนดสูตรสินค้าชุดใหม่ (New BOM)</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateBom} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">รหัสชุดสินค้า (Parent SKU) *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น KIT-CAMPING-01"
                      value={newKitSku}
                      onChange={(e) => setNewKitSku(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 font-mono focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ชื่อชุดสินค้า *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ชุดแคมป์ปิ้งพรีเมียม"
                      value={newKitName}
                      onChange={(e) => setNewKitName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ค่าแรงประกอบต่อชุด (฿)</label>
                  <input
                    type="number"
                    value={newLaborCost}
                    onChange={(e) => setNewLaborCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 tabular-nums focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="font-semibold text-slate-700 block text-[11px]">
                    เพิ่มชิ้นส่วนประกอบ (Add BOM Components):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        list="bom-product-skus"
                        placeholder="เลือกหรือพิมพ์รหัส SKU..."
                        value={compSkuInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCompSkuInput(val);
                          const matched = products.find(
                            (p) => (p.id || p.sku || '').toLowerCase() === val.toLowerCase()
                          );
                          if (matched && matched.name) {
                            setCompNameInput(matched.name);
                          }
                        }}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                      <datalist id="bom-product-skus">
                        {products.map((p: any, idx: number) => (
                          <option key={`${p.id || p.sku || idx}`} value={p.id || p.sku || p.name}>
                            {p.name}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="ชื่อชิ้นส่วน..."
                        value={compNameInput}
                        onChange={(e) => setCompNameInput(e.target.value)}
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3 flex gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={compQtyInput}
                        onChange={(e) => setCompQtyInput(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 px-2 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 text-center font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddComponent}
                        className="flex-1 px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
                        title="เพิ่มชิ้นส่วน (Add Component)"
                      >
                        <Plus className="w-3.5 h-3.5" /> เพิ่ม
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                    <span className="font-semibold text-slate-600 block text-[11px] tabular-nums">
                      ชิ้นส่วนในชุด ({componentsList.length} รายการ):
                    </span>
                    {componentsList.length === 0 ? (
                      <div className="text-[11px] text-slate-500 py-2 text-center">
                        ยังไม่มีชิ้นส่วนในชุด กรุณาเลือก SKU และกด &quot;+ เพิ่ม&quot;
                      </div>
                    ) : (
                      componentsList.map((c, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-200/80 text-slate-900"
                        >
                          <span className="truncate pr-2">
                            <strong className="text-sky-700 font-mono">{c.componentSku}</strong> - {c.componentName}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-emerald-700 tabular-nums">
                              {c.quantity} {c.unit}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(i)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="ลบชิ้นส่วน"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold shadow-xs"
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
