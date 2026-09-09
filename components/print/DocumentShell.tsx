'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Printer, Loader2 } from 'lucide-react';

interface Org { name: string; brandingLogo: string; brandingColor: string; }

interface DocumentShellProps {
  docType: string;      // ประเภทเอกสาร ไทย เช่น "ใบส่งสินค้า"
  docTypeEn: string;    // ENGLISH e.g. "DELIVERY NOTE"
  docNo: string;        // เลขที่เอกสาร
  meta?: { label: string; value: ReactNode }[]; // แถวรายละเอียดมุมขวา (วันที่/ขนส่ง ฯลฯ)
  children: ReactNode;
  printLabel?: string;
}

// Shared, system-owned document design. Pulls org branding (logo / accent color)
// so every printed document is consistent and white-labels per organization.
export function DocumentShell({ docType, docTypeEn, docNo, meta = [], children, printLabel = 'พิมพ์เอกสาร' }: DocumentShellProps) {
  const [org, setOrg] = useState<Org>({ name: 'WMS 360', brandingLogo: '', brandingColor: '#0ea5e9' });

  useEffect(() => {
    fetch('/api/org', { cache: 'no-store' }).then(r => r.json())
      .then(d => setOrg({ name: d.name || 'WMS 360', brandingLogo: d.brandingLogo || '', brandingColor: d.brandingColor || '#0ea5e9' }))
      .catch(() => {});
  }, []);

  const accent = org.brandingColor;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-8 px-4">
      <style>{`@media print { .no-print{display:none!important} @page{margin:13mm} body{-webkit-print-color-adjust:exact;print-color-adjust:exact} }`}</style>

      <div className="max-w-[820px] mx-auto mb-4 flex justify-end no-print">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-transform" style={{ background: accent }}>
          <Printer className="w-5 h-5" /> {printLabel}
        </button>
      </div>

      <div className="max-w-[820px] mx-auto bg-white rounded-2xl print:rounded-none shadow-xl print:shadow-none overflow-hidden text-slate-800">
        {/* Accent bar */}
        <div className="h-2" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

        <div className="p-10">
          {/* Header */}
          <div className="flex justify-between items-start gap-6 pb-6 mb-7 border-b border-slate-200">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl grid place-items-center shrink-0 overflow-hidden text-white font-black text-xl" style={{ background: org.brandingLogo ? '#fff' : accent }}>
                {org.brandingLogo
                  ? <img src={org.brandingLogo} alt={org.name} className="w-full h-full object-contain" />
                  : (org.name || 'W').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black tracking-tight truncate">{org.name}</div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>Warehouse Management</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-black tracking-tight leading-none">{docType}</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-0.5">{docTypeEn}</div>
              <div className="mt-2 inline-block rounded-lg px-3 py-1 font-mono font-bold text-sm text-white" style={{ background: accent }}>{docNo}</div>
            </div>
          </div>

          {/* Meta row */}
          {meta.length > 0 && (
            <div className="flex flex-wrap gap-x-10 gap-y-2 mb-7 text-sm">
              {meta.map((m, i) => (
                <div key={i}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</div>
                  <div className="font-bold text-slate-800">{m.value || '-'}</div>
                </div>
              ))}
            </div>
          )}

          {children}

          <div className="mt-10 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
            เอกสารสร้างจากระบบ {org.name} · {docNo} · {new Date().toLocaleDateString('th-TH')}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocLoading() {
  return <div className="min-h-screen grid place-items-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
}
