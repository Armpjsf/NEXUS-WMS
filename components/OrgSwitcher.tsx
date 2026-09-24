'use client';

import { useEffect,useState } from 'react';
import { useSession } from 'next-auth/react';
import { Building2,Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';

interface OrgOption { orgId: string; orgName: string; role: string; home: boolean; }

// Switch the active organization for users who belong to more than one
// (org_memberships). The server re-validates the membership in the JWT
// callback (lib/auth.ts) — this only asks. Hidden for single-org users.
export default function OrgSwitcher() {
  const { data: session, update } = useSession();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [switching, setSwitching] = useState(false);
  const current = session?.user?.orgId;

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch('/api/me/orgs', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setOrgs(Array.isArray(d?.orgs) ? d.orgs : []))
      .catch(() => {});
  }, [session?.user?.id]);

  if (orgs.length <= 1) return null;

  const onChange = async (orgId: string) => {
    if (!orgId || orgId === current) return;
    setSwitching(true);
    try {
      const next = await update({ switchOrgId: orgId });
      if (next?.user?.orgId !== orgId) throw new Error('ไม่มีสิทธิ์ในองค์กรนี้แล้ว');
      // Full reload so every screen refetches with the new org.
      window.location.assign('/dashboard');
    } catch (e) {
      toast.error(errorMessage(e) || 'สลับองค์กรไม่สำเร็จ');
      setSwitching(false);
    }
  };

  return (
    <label className="flex items-center gap-2 bg-surface-panel p-2 rounded border border-edge/80 text-xs">
      {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-gold" /> : <Building2 className="h-3.5 w-3.5 text-accent-gold" />}
      <span className="sr-only">องค์กร</span>
      <select
        value={current || ''}
        disabled={switching}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent font-bold text-foreground outline-none"
        title="สลับองค์กร"
      >
        {orgs.map(o => (
          <option key={o.orgId} value={o.orgId} className="bg-[#171c23]">
            {o.orgName}{o.home ? '' : ` · ${o.role}`}
          </option>
        ))}
      </select>
    </label>
  );
}
