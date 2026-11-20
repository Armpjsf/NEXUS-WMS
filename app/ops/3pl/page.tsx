'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Calculator,
  Download,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ThirdPartyClient, BillingPeriodCalculation } from '@/lib/billingEngine';
import { ExperimentalBanner } from '@/components/ui/ExperimentalBanner';
import { errorMessage } from '@/lib/errors';

export default function ThreePlBillingPage() {
  const [clients, setClients] = useState<ThirdPartyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ThirdPartyClient | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
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
          pickFeePerItem: newPickItem,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('เพิ่มผู้ว่าจ้างใหม่เรียบร้อย');
        setShowAddClientModal(false);
        fetchClients();
      } else {
        toast.error(data.error || 'ล้มเหลว');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleLoadLiveUsage = async () => {
    if (!selectedClient) return;
    setIsLoadingUsage(true);
    try {
      const params = new URLSearchParams({
        clientCode: selectedClient.clientCode || '',
        clientId: selectedClient.id || '',
        clientName: selectedClient.clientName || '',
        daysCount: String(billingDays || 30),
      });
      const res = await fetch(`/api/3pl/billing/generate?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const usage = data.usage || data;
        setOccupiedCbm(Number(usage.avgOccupiedCbm || 0));
        setOrdersCount(Number(usage.ordersCount || 0));
        setItemsCount(Number(usage.itemsCount || 0));
        toast.success(
          `ดึงยอดจริงจากคลังแล้ว: ${Number(usage.avgOccupiedCbm || 0)} CBM, ${Number(usage.ordersCount || 0)} ออเดอร์, ${Number(usage.itemsCount || 0)} ชิ้น`
        );
      } else {
        toast.error(data.error || 'ดึงข้อมูลการใช้งานไม่สำเร็จ');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsLoadingUsage(false);
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
          pickFeePerItem: selectedClient.pickFeePerItem,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBillingResult({
          invoiceNumber: data.invoiceNumber,
          calculation: data.calculation,
        });
        toast.success('คำนวณบิลค่าบริการคลังสำเร็จ!');
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsCalculating(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.clientCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-28 sm:px-6 lg:p-8 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="print:hidden">
          <ExperimentalBanner>
            ตัวคำนวณค่าบริการเป็นแบบร่าง — ปริมาณพื้นที่/ออเดอร์มาจากที่กรอกเอง ยังไม่ดึงจากการใช้งานจริง และยังไม่บันทึกเป็นใบแจ้งหนี้
          </ExperimentalBanner>
        </div>

        {/* Open Hybrid Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1 print:hidden">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/70 backdrop-blur-md border border-white/85 px-2.5 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 text-sky-600" />
                3PL Multi-Tenancy & Automated Billing
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/12 border border-sky-500/20 text-sky-700">
                <Building2 className="w-5 h-5" />
              </span>
              <span>3PL Client Portal & Automated Billing</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ระบบบริหารคลังรับฝากสินค้าสำหรับแบรนด์ลูกค้า และระบบคำนวณค่าฝากเก็บ / ค่าหยิบ-แพ็คอัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchClients}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-slate-200/80 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition disabled:opacity-50"
              title="รีเฟรช"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
              <span>รีเฟรช</span>
            </button>
            <button
              onClick={() => setShowAddClientModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผู้ว่าจ้างใหม่</span>
            </button>
          </div>
        </div>

        {/* Main Grid: Client List & Detail/Billing Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Client List */}
          <div className="nx-glass-card p-5 space-y-4 print:hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
              <h2 className="font-bold text-slate-900 text-sm">
                รายชื่อลูกค้า 3PL <span className="text-slate-500 font-normal tabular-nums">({clients.length})</span>
              </h2>
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาแบรนด์..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/90 border border-slate-200/80 rounded-full text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-0.5">
              {loading ? (
                <div className="p-6 text-center text-slate-500 text-xs">กำลังโหลด...</div>
              ) : filteredClients.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-2xl bg-white/50">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">ยังไม่มีรายชื่อผู้ว่าจ้าง 3PL</p>
                  <p className="mt-1">กดปุ่ม &quot;เพิ่มผู้ว่าจ้างใหม่&quot; เพื่อบันทึกสัญญาจัดเก็บและอัตราค่าบริการ</p>
                </div>
              ) : (
                filteredClients.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c);
                      setBillingResult(null);
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      selectedClient?.id === c.id
                        ? 'bg-sky-500/10 border-sky-500/40 ring-1 ring-sky-500/30 shadow-xs'
                        : 'bg-white/75 hover:bg-white border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">{c.clientName}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/12 text-sky-700 border border-sky-500/20">
                        {c.clientCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">ผู้ติดต่อ: {c.contactPerson || '-'}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-200/70 tabular-nums">
                      <span>
                        ค่าฝาก: <strong className="text-sky-700">฿{c.storageRatePerCbmDay}</strong>/CBM
                      </span>
                      <span>
                        ค่าหยิบ: <strong className="text-emerald-700">฿{c.pickFeeBase}</strong>/บิล
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Columns: Selected Client Profile & Billing Engine Simulator */}
          <div className="lg:col-span-2 space-y-6">
            {selectedClient ? (
              <>
                {/* Profile Card */}
                <div className="nx-glass-card p-6 space-y-5 print:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{selectedClient.clientName}</h2>
                      <p className="text-xs text-sky-700 font-mono font-semibold mt-0.5">
                        รหัสลูกค้า: {selectedClient.clientCode}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
                      สัญญาใช้งานปกติ (Active)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 bg-white/80 rounded-2xl border border-slate-200/80">
                      <span className="text-slate-500 block text-[11px] font-medium">ค่าฝากเก็บ (Storage Rate)</span>
                      <strong className="text-base font-bold text-slate-900 tabular-nums mt-0.5 block">
                        ฿{selectedClient.storageRatePerCbmDay}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ CBM / วัน</span>
                    </div>
                    <div className="p-3.5 bg-white/80 rounded-2xl border border-slate-200/80">
                      <span className="text-slate-500 block text-[11px] font-medium">ค่าหยิบพื้นฐาน (Base Pick)</span>
                      <strong className="text-base font-bold text-slate-900 tabular-nums mt-0.5 block">
                        ฿{selectedClient.pickFeeBase}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ ออเดอร์</span>
                    </div>
                    <div className="p-3.5 bg-white/80 rounded-2xl border border-slate-200/80">
                      <span className="text-slate-500 block text-[11px] font-medium">ค่าหยิบชิ้นถัดไป (Item Fee)</span>
                      <strong className="text-base font-bold text-slate-900 tabular-nums mt-0.5 block">
                        ฿{selectedClient.pickFeePerItem}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ ชิ้น</span>
                    </div>
                    <div className="p-3.5 bg-white/80 rounded-2xl border border-slate-200/80">
                      <span className="text-slate-500 block text-[11px] font-medium">ค่ากล่อง & วัสดุแพ็ค</span>
                      <strong className="text-base font-bold text-slate-900 tabular-nums mt-0.5 block">
                        ฿{selectedClient.packMaterialFee}
                      </strong>
                      <span className="text-[10px] text-slate-500 block">/ กล่องพัสดุ</span>
                    </div>
                  </div>

                  {/* Billing Generator Parameters */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-amber-600" />
                        คำนวณบิลรอบค่าบริการ (Automated Invoice Calculation)
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleLoadLiveUsage}
                          disabled={isLoadingUsage}
                          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-sky-500/30 text-sky-700 rounded-full text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsage ? 'animate-spin' : ''}`} />
                          {isLoadingUsage ? 'กำลังดึงข้อมูล...' : 'ดึงยอดใช้งานจริงจากคลัง (Load Live Usage)'}
                        </button>
                        <button
                          onClick={handleGenerateBilling}
                          disabled={isCalculating}
                          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-full text-xs font-bold shadow-xs transition flex items-center gap-1 disabled:opacity-50"
                        >
                          {isCalculating ? 'กำลังคำนวณ...' : '⚡ คำนวณบิลทันที'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">จำนวนวันรอบบิล (วัน)</label>
                        <input
                          type="number"
                          min="1"
                          value={billingDays}
                          onChange={(e) => setBillingDays(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-xl text-slate-900 font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">พื้นที่เฉลี่ย (CBM)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={occupiedCbm}
                          onChange={(e) => setOccupiedCbm(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-xl text-slate-900 font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">ยอดออเดอร์ที่แพ็ค (ใบ)</label>
                        <input
                          type="number"
                          min="0"
                          value={ordersCount}
                          onChange={(e) => setOrdersCount(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-xl text-slate-900 font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">ยอดชิ้นสินค้าที่หยิบ (ชิ้น)</label>
                        <input
                          type="number"
                          min="0"
                          value={itemsCount}
                          onChange={(e) => setItemsCount(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-xl text-slate-900 font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing Result Invoice Preview */}
                {billingResult && (
                  <div className="nx-glass-card p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                          ใบแจ้งหนี้ค่าบริการคลังสินค้า (Proforma Invoice)
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                          {billingResult.invoiceNumber}
                        </h3>
                      </div>
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200/80 shadow-xs print:hidden"
                      >
                        <Download className="w-3.5 h-3.5" /> พิมพ์ / ส่งออก PDF
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-2.5 border-b border-slate-200/70">
                        <span className="text-slate-600">
                          1. ค่าบริการจัดเก็บสินค้า ({billingResult.calculation.occupiedCbm} CBM x{' '}
                          {billingResult.calculation.totalDays} วัน @ ฿{selectedClient.storageRatePerCbmDay})
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          ฿
                          {billingResult.calculation.storageAmount.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2.5 border-b border-slate-200/70">
                        <span className="text-slate-600">
                          2. ค่าบริการหยิบ-แพ็คตามออเดอร์ ({billingResult.calculation.totalOrdersFulfilled}{' '}
                          ออเดอร์ @ ฿{selectedClient.pickFeeBase})
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          ฿
                          {billingResult.calculation.baseOrderFee.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2.5 border-b border-slate-200/70">
                        <span className="text-slate-600">
                          3. ค่าบริการหยิบสินค้าชิ้นถัดไป ({billingResult.calculation.totalItemsPicked} ชิ้น @ ฿
                          {selectedClient.pickFeePerItem})
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          ฿
                          {billingResult.calculation.itemPickFee.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2.5 border-b border-slate-200/70">
                        <span className="text-slate-600">
                          4. ค่าวัสดุบรรจุภัณฑ์และกล่องพัสดุ ({billingResult.calculation.totalOrdersFulfilled}{' '}
                          กล่อง @ ฿{selectedClient.packMaterialFee})
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          ฿
                          {billingResult.calculation.packingMaterialsAmount.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2.5 bg-slate-50/90 px-4 rounded-xl border border-slate-200/80">
                        <span className="font-bold text-slate-900">ยอดรวมก่อนภาษี (Subtotal)</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          ฿
                          {billingResult.calculation.subtotal.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between py-2.5 bg-slate-50/90 px-4 rounded-xl border border-slate-200/80">
                        <span className="text-slate-600">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                        <span className="font-mono text-slate-600 tabular-nums">
                          ฿
                          {billingResult.calculation.taxAmount.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="nx-dark-accent-card flex justify-between items-center py-4 px-5 text-sm mt-2">
                        <span className="font-bold text-amber-300">ยอดสุทธิที่ต้องชำระ (Grand Total)</span>
                        <span className="font-mono font-bold text-xl text-white tabular-nums">
                          ฿
                          {billingResult.calculation.grandTotal.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="nx-glass-card p-12 text-center text-slate-600 text-sm">
                กรุณาเลือกลูกค้า 3PL จากรายการด้านซ้าย
              </div>
            )}
          </div>
        </div>

        {/* Modal Add Client */}
        {showAddClientModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 text-xs text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-900">เพิ่มผู้ว่าจ้างใหม่ (3PL Tenant)</h3>
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateClient} className="space-y-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ชื่อบริษัท / แบรนด์สินค้า *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น บจก. พลังงานสะอาด สยาม"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">ชื่อผู้ติดต่อ</label>
                    <input
                      type="text"
                      value={newContactPerson}
                      onChange={(e) => setNewContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">เบอร์โทรศัพท์</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200/80 rounded-xl bg-slate-50/70 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-semibold mb-1">ค่าฝาก (฿/CBM)</label>
                    <input
                      type="number"
                      value={newStorageRate}
                      onChange={(e) => setNewStorageRate(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-semibold mb-1">ค่าหยิบฐาน (฿)</label>
                    <input
                      type="number"
                      value={newPickBase}
                      onChange={(e) => setNewPickBase(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-semibold mb-1">ชิ้นถัดไป (฿)</label>
                    <input
                      type="number"
                      value={newPickItem}
                      onChange={(e) => setNewPickItem(Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowAddClientModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold shadow-xs"
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
