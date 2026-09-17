'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Receipt,
  Plus,
  Search,
  RefreshCw,
  Calculator,
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Box,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Users
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';
import { ThirdPartyClient, BillingPeriodCalculation } from '@/lib/billingEngine';

export default function ThreePlBillingPage() {
  const [clients, setClients] = useState<ThirdPartyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ThirdPartyClient | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [billingResult, setBillingResult] = useState<{
    invoiceNumber: string;
    calculation: BillingPeriodCalculation;
  } | null>(null);

  // Billing Params Form State
  const [billingDays, setBillingDays] = useState(30);
  const [occupiedCbm, setOccupiedCbm] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newStorageRate, setNewStorageRate] = useState(0);
  const [newPickBase, setNewPickBase] = useState(0);
  const [newPickItem, setNewPickItem] = useState(0);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/3pl/clients');
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
        if (data.clients.length > 0 && !selectedClient) {
          setSelectedClient(data.clients[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/3pl/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: newClientName,
          contactPerson: newContactPerson,
          phone: newPhone,
          email: newEmail,
          storageRatePerCbmDay: newStorageRate,
          pickFeeBase: newPickBase,
          pickFeePerItem: newPickItem
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('เพิ่มผู้ว่าจ้างใหม่เรียบร้อย');
        setShowAddClientModal(false);
        fetchClients();
      } else {
        toast.error(data.error || 'ล้มเหลว');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGenerateBilling = async () => {
    if (!selectedClient) return;
    setIsCalculating(true);
    try {
      const res = await fetch('/api/3pl/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          clientName: selectedClient.clientName,
          daysCount: Number(billingDays),
          avgOccupiedCbm: Number(occupiedCbm),
          ordersCount: Number(ordersCount),
          itemsCount: Number(itemsCount),
          storageRatePerCbmDay: selectedClient.storageRatePerCbmDay,
          pickFeeBase: selectedClient.pickFeeBase,
          pickFeePerItem: selectedClient.pickFeePerItem
        })
      });
      const data = await res.json();
      if (data.success) {
        setBillingResult({
          invoiceNumber: data.invoiceNumber,
          calculation: data.calculation
        });
        toast.success('คำนวณบิลค่าบริการคลังสำเร็จ!');
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.clientName.toLowerCase().includes(search.toLowerCase()) ||
    c.clientCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 font-mono text-[#dee2ec]">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* Header Tactical Banner */}
        <div className="relative mx-auto flex flex-col gap-4 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
          <div className="relative z-10">
            <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#4cd7f6]" />
              3PL MULTI-TENANCY & AUTOMATED FULFILLMENT BILLING
            </p>
            <h1 className="font-headline text-2xl md:text-3xl font-black text-[#dee2ec] tracking-tight mb-1 flex items-center gap-3">
              <div className="bg-[#4cd7f6] text-[#042027] p-2 rounded-lg shadow-md">
                <Building2 className="w-6 h-6" />
              </div>
              3PL Client Portal & Automated Billing
            </h1>
            <p className="text-[#8a92a6] font-mono text-xs">
              ระบบบริหารคลังรับฝากสินค้าสำหรับแบรนด์ลูกค้า และระบบคำนวณค่าฝากเก็บ / ค่าหยิบ-แพ็คอัตโนมัติ
            </p>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={fetchClients}
              className="p-2.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-xl border border-[#30353d] transition"
              title="รีเฟรช"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddClientModal(true)}
              className="px-4 py-2.5 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-xl shadow-lg shadow-[#4cd7f6]/20 font-black transition flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              + เพิ่มผู้ว่าจ้างใหม่
            </button>
          </div>
        </div>

        {/* Main Grid: Client List & Detail/Billing Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Client List */}
          <div className="bg-[#171c23]/90 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
              <h2 className="font-bold text-[#dee2ec] text-xs">รายชื่อลูกค้า 3PL ({clients.length})</h2>
              <div className="relative w-40">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a92a6]" />
                <input
                  type="text"
                  placeholder="ค้นหาแบรนด์..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 text-xs bg-[#12161d] border border-[#30353d] rounded-lg text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-[#8a92a6] text-xs">กำลังโหลด...</div>
              ) : filteredClients.length === 0 ? (
                <div className="p-8 text-center text-[#8a92a6] text-xs border border-[#30353d] rounded-xl bg-[#12161d]">
                  <Users className="w-8 h-8 text-[#8a92a6] mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-[#dee2ec]">ยังไม่มีรายชื่อผู้ว่าจ้าง 3PL</p>
                  <p>กดปุ่ม "+ เพิ่มผู้ว่าจ้างใหม่" เพื่อบันทึกสัญญาจัดเก็บและอัตราค่าบริการ</p>
                </div>
              ) : filteredClients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClient(c);
                    setBillingResult(null);
                  }}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    selectedClient?.id === c.id
                      ? 'bg-[#4cd7f6]/10 border-[#4cd7f6] ring-1 ring-[#4cd7f6]'
                      : 'bg-[#12161d] hover:bg-white/5 border-[#30353d]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#dee2ec] text-xs">{c.clientName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1e242e] text-[#4cd7f6] border border-[#30353d]">
                      {c.clientCode}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8a92a6]">ผู้ติดต่อ: {c.contactPerson || '-'}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#8a92a6] pt-1.5 border-t border-[#262c36]">
                    <span>ค่าฝาก: <strong className="text-[#4cd7f6]">฿{c.storageRatePerCbmDay}</strong>/CBM</span>
                    <span>ค่าหยิบ: <strong className="text-[#57ec7f]">฿{c.pickFeeBase}</strong>/บิล</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Columns: Selected Client Profile & Billing Engine Simulator */}
          <div className="lg:col-span-2 space-y-6">
            {selectedClient ? (
              <>
                {/* Profile Card */}
                <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#30353d] shadow-2xl backdrop-blur-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                    <div>
                      <h2 className="text-lg font-black text-[#dee2ec]">{selectedClient.clientName}</h2>
                      <p className="text-xs text-[#4cd7f6] font-mono">รหัสลูกค้า: {selectedClient.clientCode}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#57ec7f]/20 text-[#57ec7f] border border-[#57ec7f]/30">
                      สัญญาใช้งานปกติ (Active)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-[#12161d] rounded-xl border border-[#30353d]">
                      <span className="text-[#8a92a6] block text-[10px]">ค่าฝากเก็บ (Storage Rate)</span>
                      <strong className="text-sm text-[#dee2ec]">฿{selectedClient.storageRatePerCbmDay}</strong>
                      <span className="text-[10px] text-[#8a92a6] block">/ CBM / วัน</span>
                    </div>
                    <div className="p-3 bg-[#12161d] rounded-xl border border-[#30353d]">
                      <span className="text-[#8a92a6] block text-[10px]">ค่าหยิบพื้นฐาน (Base Pick)</span>
                      <strong className="text-sm text-[#dee2ec]">฿{selectedClient.pickFeeBase}</strong>
                      <span className="text-[10px] text-[#8a92a6] block">/ ออเดอร์</span>
                    </div>
                    <div className="p-3 bg-[#12161d] rounded-xl border border-[#30353d]">
                      <span className="text-[#8a92a6] block text-[10px]">ค่าหยิบชิ้นถัดไป (Item Fee)</span>
                      <strong className="text-sm text-[#dee2ec]">฿{selectedClient.pickFeePerItem}</strong>
                      <span className="text-[10px] text-[#8a92a6] block">/ ชิ้น</span>
                    </div>
                    <div className="p-3 bg-[#12161d] rounded-xl border border-[#30353d]">
                      <span className="text-[#8a92a6] block text-[10px]">ค่ากล่อง & วัสดุแพ็ค</span>
                      <strong className="text-sm text-[#dee2ec]">฿{selectedClient.packMaterialFee}</strong>
                      <span className="text-[10px] text-[#8a92a6] block">/ กล่องพัสดุ</span>
                    </div>
                  </div>

                  {/* Billing Generator Parameters */}
                  <div className="bg-[#12161d] p-4 rounded-xl border border-[#30353d] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-[#facc15] flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-[#facc15]" />
                        คำนวณบิลรอบค่าบริการ (Automated Invoice Calculation)
                      </h3>
                      <button
                        onClick={handleGenerateBilling}
                        disabled={isCalculating}
                        className="px-4 py-1.5 bg-[#facc15] hover:bg-[#eab308] text-[#1b1600] rounded-lg text-xs font-black shadow transition flex items-center gap-1"
                      >
                        {isCalculating ? 'กำลังคำนวณ...' : '⚡ คำนวณบิลทันที'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[#8a92a6] mb-1">จำนวนวันรอบบิล (วัน)</label>
                        <input
                          type="number"
                          min="1"
                          value={billingDays}
                          onChange={(e) => setBillingDays(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-[#1c222b] border border-[#30353d] rounded-lg text-[#dee2ec] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[#8a92a6] mb-1">พื้นที่เฉลี่ย (CBM)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={occupiedCbm}
                          onChange={(e) => setOccupiedCbm(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-[#1c222b] border border-[#30353d] rounded-lg text-[#dee2ec] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[#8a92a6] mb-1">ยอดออเดอร์ที่แพ็ค (ใบ)</label>
                        <input
                          type="number"
                          min="0"
                          value={ordersCount}
                          onChange={(e) => setOrdersCount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-[#1c222b] border border-[#30353d] rounded-lg text-[#dee2ec] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[#8a92a6] mb-1">ยอดชิ้นสินค้าที่หยิบ (ชิ้น)</label>
                        <input
                          type="number"
                          min="0"
                          value={itemsCount}
                          onChange={(e) => setItemsCount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-[#1c222b] border border-[#30353d] rounded-lg text-[#dee2ec] font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing Result Invoice Preview */}
                {billingResult && (
                  <div className="bg-[#171c23]/90 p-5 rounded-xl border border-[#4cd7f6]/40 shadow-2xl backdrop-blur-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#30353d] pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4cd7f6]">ใบแจ้งหนี้ค่าบริการคลังสินค้า (Proforma Invoice)</span>
                        <h3 className="text-lg font-black text-[#dee2ec]">{billingResult.invoiceNumber}</h3>
                      </div>
                      <button
                        onClick={() => toast.success('ดาวน์โหลดเอกสาร PDF สำเร็จ')}
                        className="px-3 py-1.5 bg-[#252a32] hover:bg-[#30353d] text-[#dee2ec] rounded-lg text-xs font-bold flex items-center gap-1.5 transition border border-[#30353d]"
                      >
                        <Download className="w-3.5 h-3.5" /> พิมพ์ / ส่งออก PDF
                      </button>
                    </div>

                    <div className="space-y-2 text-xs divide-y divide-[#262c36]">
                      <div className="flex justify-between py-2">
                        <span className="text-[#8a92a6]">
                          1. ค่าบริการจัดเก็บสินค้า ({billingResult.calculation.occupiedCbm} CBM x {billingResult.calculation.totalDays} วัน @ ฿{selectedClient.storageRatePerCbmDay})
                        </span>
                        <span className="font-mono font-bold text-[#dee2ec]">
                          ฿{billingResult.calculation.storageAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2">
                        <span className="text-[#8a92a6]">
                          2. ค่าบริการหยิบ-แพ็คตามออเดอร์ ({billingResult.calculation.totalOrdersFulfilled} ออเดอร์ @ ฿{selectedClient.pickFeeBase})
                        </span>
                        <span className="font-mono font-bold text-[#dee2ec]">
                          ฿{billingResult.calculation.baseOrderFee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2">
                        <span className="text-[#8a92a6]">
                          3. ค่าบริการหยิบสินค้าชิ้นถัดไป ({billingResult.calculation.totalItemsPicked} ชิ้น @ ฿{selectedClient.pickFeePerItem})
                        </span>
                        <span className="font-mono font-bold text-[#dee2ec]">
                          ฿{billingResult.calculation.itemPickFee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2">
                        <span className="text-[#8a92a6]">
                          4. ค่าวัสดุบรรจุภัณฑ์และกล่องพัสดุ ({billingResult.calculation.totalOrdersFulfilled} กล่อง @ ฿{selectedClient.packMaterialFee})
                        </span>
                        <span className="font-mono font-bold text-[#dee2ec]">
                          ฿{billingResult.calculation.packingMaterialsAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2 bg-[#12161d] px-3 rounded-lg border border-[#30353d]">
                        <span className="font-bold text-[#dee2ec]">ยอดรวมก่อนภาษี (Subtotal)</span>
                        <span className="font-mono font-bold text-[#dee2ec]">
                          ฿{billingResult.calculation.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2 bg-[#12161d] px-3 rounded-lg border border-[#30353d]">
                        <span className="text-[#8a92a6]">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                        <span className="font-mono text-[#8a92a6]">
                          ฿{billingResult.calculation.taxAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between py-3 bg-[#facc15]/10 border border-[#facc15]/30 px-4 rounded-xl text-sm">
                        <span className="font-black text-[#facc15]">ยอดสุทธิที่ต้องชำระ (Grand Total)</span>
                        <span className="font-mono font-black text-lg text-[#facc15]">
                          ฿{billingResult.calculation.grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-[#8a92a6] bg-[#171c23]/90 rounded-xl border border-[#30353d]">
                กรุณาเลือกลูกค้า 3PL จากรายการด้านซ้าย
              </div>
            )}
          </div>
        </div>

        {/* Modal Add Client */}
        {showAddClientModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#30353d] bg-[#171c23] shadow-2xl p-6 text-xs font-mono text-[#dee2ec]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4cd7f6] via-[#facc15] to-[#57ec7f]" />
              <h3 className="text-base font-black text-[#dee2ec] mb-4">เพิ่มผู้ว่าจ้างใหม่ (3PL Tenant)</h3>
              <form onSubmit={handleCreateClient} className="space-y-3">
                <div>
                  <label className="block text-[#8a92a6] font-bold mb-1">ชื่อบริษัท / แบรนด์สินค้า *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น บจก. พลังงานสะอาด สยาม"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec] focus:border-[#4cd7f6] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">ชื่อผู้ติดต่อ</label>
                    <input
                      type="text"
                      value={newContactPerson}
                      onChange={(e) => setNewContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8a92a6] font-bold mb-1">เบอร์โทรศัพท์</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#30353d] rounded-xl bg-[#12161d] text-[#dee2ec]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-[#12161d] p-3 rounded-xl border border-[#30353d]">
                  <div>
                    <label className="block text-[10px] text-[#8a92a6] font-bold mb-1">ค่าฝาก (฿/CBM)</label>
                    <input
                      type="number"
                      value={newStorageRate}
                      onChange={(e) => setNewStorageRate(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-[#1c222b] border border-[#30353d] rounded text-[#dee2ec] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8a92a6] font-bold mb-1">ค่าหยิบฐาน (฿)</label>
                    <input
                      type="number"
                      value={newPickBase}
                      onChange={(e) => setNewPickBase(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-[#1c222b] border border-[#30353d] rounded text-[#dee2ec] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8a92a6] font-bold mb-1">ชิ้นถัดไป (฿)</label>
                    <input
                      type="number"
                      value={newPickItem}
                      onChange={(e) => setNewPickItem(Number(e.target.value))}
                      className="w-full px-2 py-1 bg-[#1c222b] border border-[#30353d] rounded text-[#dee2ec] font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#30353d]">
                  <button
                    type="button"
                    onClick={() => setShowAddClientModal(false)}
                    className="px-4 py-2 bg-[#252a32] text-[#8a92a6] hover:text-white rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#042027] rounded-xl font-black shadow"
                  >
                    บันทึก
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
