'use client';

import { useState } from 'react';
import { 
  Network, 
  CheckCircle2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  Printer, 
  Database, 
  Key, 
  ShieldCheck, 
  Code,
  Copy,
  ExternalLink,
  Play,
  Download,
  Info,
  Barcode
} from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import toast from 'react-hot-toast';

export default function ErpIntegrationPage() {
  const [selectedTab, setSelectedTab] = useState<'status' | 'asn' | 'orders' | 'zpl'>('status');
  const [zplType, setZplType] = useState<'PALLET' | 'PRODUCT'>('PALLET');
  const [zplOutput, setZplOutput] = useState<string>('');
  const [loadingZpl, setLoadingZpl] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Simulation states
  const [simulatingAsn, setSimulatingAsn] = useState(false);
  const [asnResult, setAsnResult] = useState<any>(null);
  const [simulatingOrder, setSimulatingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  const sampleAsn = {
    asnNumber: "ASN-2026-0091",
    supplierName: "Global Electronics Corp",
    expectedDeliveryDate: "2026-09-20",
    containerNumber: "MSKU-982341-2",
    dockBay: "BAY-02",
    items: [
      {
        sku: "SKU-SOLAR-5K",
        expectedQty: 120,
        lotNumber: "LOT-2609-A",
        expDate: "2028-12-31",
        unitCost: 15000
      }
    ]
  };

  const sampleOrder = {
    orderNumber: "SO-2026-88190",
    customerName: "Siam Solar Energy Co., Ltd.",
    shippingAddress: "88/1 ถ.บางนา-ตราด กม.18 สมุทรปราการ",
    carrier: "FLASH_EXPRESS",
    priority: "EXPRESS",
    items: [
      { sku: "SKU-SOLAR-5K", requestedQty: 4, unitPrice: 18500 }
    ]
  };

  const handleSimulateAsn = async () => {
    setSimulatingAsn(true);
    setAsnResult(null);
    try {
      const res = await fetch('/api/erp/asn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleAsn)
      });
      const data = await res.json();
      setAsnResult(data);
      if (res.ok) {
        toast.success('ส่งข้อมูล ASN เข้าสู่ WMS สำเร็จ! งาน Putaway ถูกสร้างแล้ว');
      } else {
        toast.error(data.error || 'ส่งข้อมูลไม่สำเร็จ');
      }
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSimulatingAsn(false);
    }
  };

  const handleSimulateOrder = async () => {
    setSimulatingOrder(true);
    setOrderResult(null);
    try {
      const res = await fetch('/api/erp/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleOrder)
      });
      const data = await res.json();
      setOrderResult(data);
      if (res.ok) {
        toast.success('ส่งใบสั่งขายเข้าสู่ WMS สำเร็จ! งานเบิกสินค้าถูกสร้างแล้ว');
      } else {
        toast.error(data.error || 'ส่งข้อมูลไม่สำเร็จ');
      }
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSimulatingOrder(false);
    }
  };

  const handleGenerateZpl = async () => {
    try {
      setLoadingZpl(true);
      const payload = zplType === 'PALLET' ? {
        type: 'PALLET',
        options: {
          sscc: '008851234567890128',
          sku: 'SKU-ENT-8840',
          productName: 'Heavy Duty Solar Inverter 5kW',
          lotNumber: 'LOT-2026-09B',
          qty: 24,
          uom: 'BOX',
          expDate: '2028-12-31',
          destinationDock: 'BAY-04'
        }
      } : {
        type: 'PRODUCT',
        options: {
          sku: 'SKU-ENT-8840',
          productName: 'Heavy Duty Solar Inverter 5kW',
          barcode: '8851234567890',
          price: 18500,
          lotNumber: 'LOT-2026-09B',
          expDate: '2028-12-31'
        }
      };

      const res = await fetch('/api/print/zpl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setZplOutput(data.zpl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingZpl(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('คัดลอกโค้ด ZPL เรียบร้อยแล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadZplFile = () => {
    if (!zplOutput) return;
    const blob = new Blob([zplOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${zplType.toLowerCase()}_label.zpl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ดาวน์โหลดไฟล์ .zpl สำเร็จ');
  };

  return (
    <div className="relative min-h-screen p-4 md:p-8 pb-32 font-mono">
      <AmbientBackground />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#30353d] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4cd7f6] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6]">
                ENTERPRISE INTEGRATION HUB & CARRIER GATEWAY
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#dee2ec] tracking-tight">
              ศูนย์เชื่อมต่อระบบองค์กร (ERP & Hardware Console)
            </h1>
            <p className="text-xs text-[#8a92a6] mt-1">
              ระบบเชื่อมต่อ 2 ทิศทาง: SAP, Odoo, Dynamics 365, e-Logistics Carriers และเครื่องพิมพ์ ZPL อุตสาหกรรม
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg border border-[#57ec7f]/40 bg-[#57ec7f]/10 text-[#57ec7f] text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Open API Ready
            </span>
          </div>
        </div>

        {/* Explain Box */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#4cd7f6]/30 bg-[#4cd7f6]/5 text-xs text-[#dee2ec]">
          <Info className="w-5 h-5 text-[#4cd7f6] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[#4cd7f6]">คำแนะนำสำหรับผู้ใช้งาน:</p>
            <p className="text-[#8a92a6] leading-relaxed">
              หน้านี้จัดทำขึ้นสำหรับ <strong>ฝ่าย IT, วิศวกรระบบ และผู้ดูแล ERP</strong> เพื่อดู <strong>API Payload Schemas (รูปแบบ JSON)</strong> สำหรับนำไปเชื่อมโยงกับ SAP / Odoo ให้ส่งข้อมูลเข้า WMS อัตโนมัติ รวมถึงสร้าง <strong>โค้ดคำสั่ง ZPL II</strong> ส่งตรงเข้าเครื่องพิมพ์สลากความร้อนระดับอุตสาหกรรม (Zebra/TSC) ผ่านระบบเครือข่าย
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-[#30353d] pb-3 text-xs">
          {[
            { id: 'status', label: 'สถานะเชื่อมต่อ (ERP Status)', icon: Network },
            { id: 'asn', label: 'รับเข้า ASN (Inbound API)', icon: ArrowDownLeft },
            { id: 'orders', label: 'ออเดอร์ขาย (Outbound API)', icon: ArrowUpRight },
            { id: 'zpl', label: 'ZPL Direct Printing (เครื่องพิมพ์อุตสาหกรรม)', icon: Printer }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  selectedTab === tab.id
                    ? 'bg-[#facc15] text-[#1b1600] border-[#facc15] font-bold shadow-md'
                    : 'bg-[#171c23] text-[#d1c6ab] border-[#30353d] hover:bg-[#252a32]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content: Status */}
        {selectedTab === 'status' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'SAP S/4HANA / ECC', status: 'READY (API)', ping: '18ms', type: 'REST / RFC' },
              { name: 'Odoo Enterprise ERP', status: 'READY (WEBHOOK)', ping: '24ms', type: 'JSON-RPC' },
              { name: 'Microsoft Dynamics 365', status: 'READY (API)', ping: '32ms', type: 'OData v4' },
              { name: 'Oracle NetSuite', status: 'STANDBY', ping: '--', type: 'SuiteTalk REST' },
              { name: 'e-Logistics Carriers (Flash/Kerry)', status: 'ACTIVE', ping: '45ms', type: 'Carrier AWB' },
              { name: 'Zebra / TSC Network Printers', status: 'READY (PORT 9100)', ping: '2ms', type: 'Raw TCP Socket' }
            ].map((conn, idx) => (
              <div key={idx} className="p-5 rounded-xl border border-[#30353d] bg-[#171c23] shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-[#4cd7f6] border border-[#4cd7f6]/30 font-bold">
                      {conn.type}
                    </span>
                    <span className="text-[10px] text-[#57ec7f] flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#57ec7f]" /> {conn.ping}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#dee2ec]">{conn.name}</h3>
                </div>
                <div className="pt-4 border-t border-[#30353d] mt-4 flex justify-between items-center text-xs">
                  <span className="text-[#8a92a6]">สถานะ:</span>
                  <span className="text-[#57ec7f] font-bold">{conn.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: ASN */}
        {selectedTab === 'asn' && (
          <div className="p-6 rounded-xl border border-[#30353d] bg-[#171c23] space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#dee2ec]">Inbound ASN Ingestion Endpoint (รับตู้คอนเทนเนอร์เข้าคลัง)</h3>
                <p className="text-xs text-[#8a92a6]">
                  ส่งข้อมูลตู้สินค้าและใบส่งของล่วงหน้า (Advanced Shipping Notice) จาก ERP เข้าสู่ระบบ WMS
                </p>
              </div>
              <button
                onClick={handleSimulateAsn}
                disabled={simulatingAsn}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#57ec7f] text-[#090f15] font-bold text-xs hover:bg-[#48cb6d] transition-all shadow-md disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{simulatingAsn ? 'กำลังส่งข้อมูล...' : '🚀 ทดสอบยิงข้อมูล ASN เข้า WMS จริง'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#090f15] p-3 rounded-lg border border-[#30353d] text-xs">
              <span className="text-[#4cd7f6] font-bold">POST /api/erp/asn</span>
              <span className="text-[10px] text-[#8a92a6]">Format: application/json · Header: x-api-key</span>
            </div>

            <div className="bg-[#090f15] p-4 rounded-lg border border-[#30353d] text-xs text-[#dee2ec] overflow-x-auto">
              <pre>{JSON.stringify(sampleAsn, null, 2)}</pre>
            </div>

            {asnResult && (
              <div className="p-4 rounded-lg border border-[#57ec7f]/40 bg-[#57ec7f]/10 text-xs space-y-1">
                <div className="font-bold text-[#57ec7f] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> ผลลัพธ์การตอบกลับจาก WMS Backend (200 OK):
                </div>
                <pre className="text-[#dee2ec] overflow-x-auto">{JSON.stringify(asnResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Orders */}
        {selectedTab === 'orders' && (
          <div className="p-6 rounded-xl border border-[#30353d] bg-[#171c23] space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#dee2ec]">Outbound Sales Orders Ingestion (คำสั่งขายจาก ERP)</h3>
                <p className="text-xs text-[#8a92a6]">
                  ส่งใบสั่งขายจาก ERP / OMS เพื่อนำไปจัดกลุ่ม Wave Picking และพิมพ์ใบปะหน้าอัตโนมัติ
                </p>
              </div>
              <button
                onClick={handleSimulateOrder}
                disabled={simulatingOrder}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#57ec7f] text-[#090f15] font-bold text-xs hover:bg-[#48cb6d] transition-all shadow-md disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{simulatingOrder ? 'กำลังส่งข้อมูล...' : '🚀 ทดสอบยิงคำสั่งขายเข้า WMS จริง'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#090f15] p-3 rounded-lg border border-[#30353d] text-xs">
              <span className="text-[#57ec7f] font-bold">POST /api/erp/orders</span>
              <span className="text-[10px] text-[#8a92a6]">Format: application/json · Header: x-api-key</span>
            </div>

            <div className="bg-[#090f15] p-4 rounded-lg border border-[#30353d] text-xs text-[#dee2ec] overflow-x-auto">
              <pre>{JSON.stringify(sampleOrder, null, 2)}</pre>
            </div>

            {orderResult && (
              <div className="p-4 rounded-lg border border-[#57ec7f]/40 bg-[#57ec7f]/10 text-xs space-y-1">
                <div className="font-bold text-[#57ec7f] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> ผลลัพธ์การตอบกลับจาก WMS Backend (200 OK):
                </div>
                <pre className="text-[#dee2ec] overflow-x-auto">{JSON.stringify(orderResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: ZPL */}
        {selectedTab === 'zpl' && (
          <div className="p-6 rounded-xl border border-[#30353d] bg-[#171c23] space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#dee2ec]">ZPL II Thermal Label Generator (เครื่องพิมพ์บาร์โค้ดความร้อน)</h3>
                <p className="text-xs text-[#8a92a6]">
                  สร้างคำสั่งพิมพ์ ZPL ตรงเข้าเครื่องพิมพ์บาร์โค้ดความร้อนอุตสาหกรรม (Zebra / TSC / Godex)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setZplType('PALLET'); setZplOutput(''); }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    zplType === 'PALLET' ? 'bg-[#facc15] text-[#1b1600] border-[#facc15]' : 'bg-[#090f15] border-[#30353d] text-[#dee2ec]'
                  }`}
                >
                  ฉลากพาเลท (Pallet 4x6")
                </button>
                <button
                  onClick={() => { setZplType('PRODUCT'); setZplOutput(''); }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    zplType === 'PRODUCT' ? 'bg-[#facc15] text-[#1b1600] border-[#facc15]' : 'bg-[#090f15] border-[#30353d] text-[#dee2ec]'
                  }`}
                >
                  ฉลากสินค้า (Product 3x2")
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleGenerateZpl}
                disabled={loadingZpl}
                className="px-4 py-2 rounded-lg bg-[#facc15] hover:bg-[#ffe083] text-[#1b1600] font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {loadingZpl ? 'กำลังประมวลผล...' : 'สร้างโค้ด ZPL อัตโนมัติ (Generate ZPL)'}
              </button>

              {zplOutput && (
                <button
                  onClick={downloadZplFile}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#30353d] bg-[#252a32] text-[#dee2ec] hover:text-[#facc15] text-xs font-bold transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดไฟล์ .zpl</span>
                </button>
              )}
            </div>

            {/* Visual Preview + Raw Code Side-by-side */}
            {zplOutput && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Visual Label Mockup */}
                <div className="p-4 rounded-xl border border-[#30353d] bg-[#090f15] flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-[#8a92a6] mb-3 self-start">
                    👁️ จำลองหน้าตาสลากที่พิมพ์ออกมา (Label Visual Mockup):
                  </span>
                  
                  {zplType === 'PALLET' ? (
                    <div className="w-72 bg-white text-black p-4 rounded shadow-2xl border-2 border-black font-sans text-[11px] space-y-2">
                      <div className="border-b-2 border-black pb-1 flex justify-between items-center font-bold">
                        <span className="text-xs">NEXUS LOGISTICS PALLET</span>
                        <span className="text-[9px] bg-black text-white px-1">GS1-128</span>
                      </div>
                      <div className="text-xs font-bold leading-tight">
                        SKU-ENT-8840
                        <div className="text-[10px] font-normal text-gray-700">Heavy Duty Solar Inverter 5kW</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 border border-black p-1 text-[9px]">
                        <div>LOT: <strong>LOT-2026-09B</strong></div>
                        <div>QTY: <strong>24 BOX</strong></div>
                        <div>EXP: <strong>2028-12-31</strong></div>
                        <div>DOCK: <strong>BAY-04</strong></div>
                      </div>
                      <div className="pt-2 text-center border-t border-black">
                        <div className="font-mono text-[9px] font-bold tracking-widest mb-1">(00) 0 0885123 456789012 8</div>
                        <div className="h-10 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_4px)] w-full border border-black" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-64 bg-white text-black p-3 rounded shadow-2xl border-2 border-black font-sans text-[10px] space-y-1.5">
                      <div className="font-bold text-xs leading-tight">Heavy Duty Solar Inverter 5kW</div>
                      <div className="flex justify-between font-mono text-[9px]">
                        <span>SKU: <strong>SKU-ENT-8840</strong></span>
                        <span>฿<strong>18,500</strong></span>
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-700">
                        <span>LOT: LOT-2026-09B</span>
                        <span>EXP: 2028-12-31</span>
                      </div>
                      <div className="pt-1 text-center">
                        <div className="h-8 bg-[repeating-linear-gradient(90deg,#000,#000_1.5px,#fff_1.5px,#fff_3px)] w-full border border-black" />
                        <span className="font-mono text-[9px]">8851234567890</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Raw ZPL Code */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-[#d1c6ab]">
                    <span>Raw ZPL II Payload (พร้อมส่ง TCP Port 9100):</span>
                    <button
                      onClick={() => copyToClipboard(zplOutput)}
                      className="flex items-center gap-1 text-[#facc15] hover:underline"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                    </button>
                  </div>
                  <pre className="bg-[#090f15] p-4 rounded-xl border border-[#30353d] text-[11px] text-[#57ec7f] overflow-x-auto max-h-80 font-mono">
                    {zplOutput}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
