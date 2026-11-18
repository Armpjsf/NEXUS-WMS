'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Printer, Loader2, AlertTriangle } from 'lucide-react';
import Barcode from 'react-barcode';

export interface DocumentIssuerSnapshot {
  legalName?: string;
  name?: string;
  taxId?: string;
  taxBranchCode?: string;
  address?: string;
  phone?: string;
  brandingLogo?: string;
  brandingColor?: string;
  issuedAt?: string;
}

interface OrgState {
  name: string;
  legalName: string;
  taxId: string;
  taxBranchCode: string;
  address: string;
  phone: string;
  brandingLogo: string;
  brandingColor: string;
  setupComplete: boolean;
}

interface DocumentShellProps {
  docType: string;      // ประเภทเอกสาร ไทย เช่น "ใบส่งสินค้า"
  docTypeEn: string;    // ENGLISH e.g. "DELIVERY NOTE"
  docNo: string;        // เลขที่เอกสาร
  meta?: { label: string; value: ReactNode }[]; // แถวรายละเอียดมุมขวา (วันที่/ขนส่ง ฯลฯ)
  children: ReactNode;
  printLabel?: string;
  issuedSnapshot?: DocumentIssuerSnapshot;
  requireLegalProfile?: boolean;
}

const DEFAULT_ORG_STATE: OrgState = {
  name: 'NEXUS',
  legalName: '',
  taxId: '',
  taxBranchCode: '',
  address: '',
  phone: '',
  brandingLogo: '',
  brandingColor: '#0ea5e9',
  setupComplete: false,
};

// Shared, system-owned document design. Pulls org branding (logo / accent color)
// and legal issuer details (or freezes issuedSnapshot for historical documents).
export function DocumentShell({
  docType,
  docTypeEn,
  docNo,
  meta = [],
  children,
  printLabel = 'พิมพ์เอกสาร',
  issuedSnapshot,
  requireLegalProfile = true,
}: DocumentShellProps) {
  const [org, setOrg] = useState<OrgState>(DEFAULT_ORG_STATE);
  const [loading, setLoading] = useState<boolean>(!issuedSnapshot);

  useEffect(() => {
    if (issuedSnapshot) {
      setLoading(false);
      return;
    }
    let active = true;
    fetch('/api/org', { cache: 'no-store' })
      .then((r): Promise<Record<string, any>> => (r.ok ? r.json() : Promise.resolve({})))
      .then((d) => {
        if (!active) return;
        const legalName = d.legalName || '';
        const taxId = d.taxId || '';
        const address = d.address || '';
        setOrg({
          name: d.name || 'NEXUS',
          legalName,
          taxId,
          taxBranchCode: d.taxBranchCode || '',
          address,
          phone: d.phone || '',
          brandingLogo: d.documentLogo || d.brandingLogo || '',
          brandingColor: d.brandingColor || '#0ea5e9',
          setupComplete: d.setupComplete !== undefined ? Boolean(d.setupComplete) : Boolean(legalName && taxId && address),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [issuedSnapshot]);

  if (loading && !issuedSnapshot) {
    return <DocLoading />;
  }

  const effectiveLegalName = issuedSnapshot?.legalName || org.legalName;
  const effectiveName = issuedSnapshot?.name || org.name;
  const effectiveTaxId = issuedSnapshot?.taxId || org.taxId;
  const effectiveBranchCode = issuedSnapshot?.taxBranchCode || org.taxBranchCode;
  const effectiveAddress = issuedSnapshot?.address || org.address;
  const effectivePhone = issuedSnapshot?.phone || org.phone;
  const effectiveLogo = issuedSnapshot?.brandingLogo || org.brandingLogo;
  const accent = issuedSnapshot?.brandingColor || org.brandingColor || '#0ea5e9';

  // Ignore legacy "WMS 360" fallback if present.
  const rawBrand = effectiveLegalName || effectiveName || 'NEXUS';
  const brand = !/wms\s*360/i.test(rawBrand) ? rawBrand : 'NEXUS';

  const isSetupMissing = !issuedSnapshot && requireLegalProfile && !org.setupComplete;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-8 px-4">
      <style>{`@media print { .no-print{display:none!important} @page{margin:13mm} body{-webkit-print-color-adjust:exact;print-color-adjust:exact} }`}</style>

      {isSetupMissing && (
        <div
          data-testid="setup-required-banner"
          className="max-w-[820px] mx-auto mb-4 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 no-print"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm font-semibold">
            กรุณาตั้งค่าข้อมูลนิติบุคคล (ชื่อจดทะเบียน, เลขประจำตัวผู้เสียภาษี, ที่อยู่) ในหน้าตั้งค่าองค์กรก่อนพิมพ์เอกสารทางการ
          </div>
        </div>
      )}

      <div className="max-w-[820px] mx-auto mb-4 flex justify-end no-print">
        <button
          onClick={() => window.print()}
          disabled={isSetupMissing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: accent }}
        >
          <Printer className="w-5 h-5" /> {printLabel}
        </button>
      </div>

      <div className="max-w-[820px] mx-auto bg-white rounded-2xl print:rounded-none shadow-xl print:shadow-none overflow-hidden text-slate-800">
        {/* Accent bar */}
        <div className="h-2" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

        <div className="p-10">
          {/* Header */}
          <div className="flex justify-between items-start gap-6 pb-6 mb-7 border-b border-slate-200">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl grid place-items-center shrink-0 overflow-hidden text-white font-black text-xl" style={{ background: effectiveLogo ? '#fff' : accent }}>
                {effectiveLogo
                  ? <img src={effectiveLogo} alt={brand} className="w-full h-full object-contain" />
                  : (brand || 'W').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black tracking-tight truncate">{brand}</div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: accent }}>Warehouse Management</div>
                {effectiveAddress && (
                  <div className="text-xs text-slate-600 mt-1">{effectiveAddress}</div>
                )}
                {(effectiveTaxId || effectivePhone) && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {effectiveTaxId ? `เลขประจำตัวผู้เสียภาษี: ${effectiveTaxId}` : ''}
                    {effectiveBranchCode ? ` (สาขา ${effectiveBranchCode})` : ''}
                    {effectiveTaxId && effectivePhone ? ' · ' : ''}
                    {effectivePhone ? `โทร: ${effectivePhone}` : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-black tracking-tight leading-none">{docType}</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-0.5">{docTypeEn}</div>
              <div className="mt-2 inline-block rounded-lg px-3 py-1 font-mono font-bold text-sm text-white" style={{ background: accent }}>{docNo}</div>
              {docNo && (
                <div className="mt-2 flex justify-end">
                  <Barcode value={String(docNo)} format="CODE128" height={34} width={1.3} fontSize={10} margin={0} displayValue={false} />
                </div>
              )}
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
            เอกสารสร้างจากระบบ {brand} · {docNo} · {new Date().toLocaleDateString('th-TH')}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocLoading() {
  return <div className="min-h-screen grid place-items-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
}
