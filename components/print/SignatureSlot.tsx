'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { PenLine } from 'lucide-react';

const SignatureModal = dynamic(() => import('@/components/SignatureModal'), { ssr: false });

interface Props {
  docType: string;
  docId: string;
  role: string;            // receiver | sender | qc | picker | approver | supplier ...
  label: string;           // caption under the line, e.g. "ผู้รับสินค้า"
  signerName?: string;     // pre-known name (e.g. customer) saved with the signature
  initialDataUrl?: string; // an already-captured signature (e.g. order.podSignature)
}

// A document signature block that works for paper AND phone:
//  - printed: shows the pen line (or the e-signature image if already signed)
//  - on screen: adds a no-print "เซ็นในมือถือ" button so a customer/operator can
//    sign right on the phone; signing is OPTIONAL — printing to sign on paper
//    still works exactly as before.
export default function SignatureSlot({ docType, docId, role, label, signerName, initialDataUrl }: Props) {
  const [dataUrl, setDataUrl] = useState<string>(initialDataUrl || '');
  const [signedAt, setSignedAt] = useState<string>('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/documents/signatures?docType=${encodeURIComponent(docType)}&docId=${encodeURIComponent(docId)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const mine = (d.signatures || []).find((s: any) => s.role === role);
        if (mine?.data_url) { setDataUrl(mine.data_url); setSignedAt(mine.signed_at || ''); }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [docType, docId, role]);

  const save = async (url: string) => {
    setDataUrl(url);
    setSignedAt(new Date().toISOString());
    await fetch('/api/documents/signatures', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType, docId, role, signerName: signerName || '', dataUrl: url }),
    }).catch(() => {});
  };

  return (
    <div className="text-center">
      <div className="h-20 border-b border-slate-300 flex items-end justify-center pb-1">
        {dataUrl ? <img src={dataUrl} alt={label} className="h-16 object-contain" /> : null}
      </div>
      <div className="mt-2 text-slate-500">{label}{signerName ? ` · ${signerName}` : ''}</div>

      {dataUrl ? (
        <div className="no-print mt-1 text-[10px] text-emerald-600 font-semibold">
          ✓ เซ็นอิเล็กทรอนิกส์{signedAt ? ` · ${new Date(signedAt).toLocaleDateString('th-TH')}` : ''}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="no-print mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold active:scale-95"
        >
          <PenLine className="w-3.5 h-3.5" /> เซ็นในมือถือ
        </button>
      )}

      {open && (
        <SignatureModal
          isOpen={open}
          docNum={`${label} · ${docId}`}
          onClose={() => setOpen(false)}
          onSave={save}
        />
      )}
    </div>
  );
}
