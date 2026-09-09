// Organization (tenant) settings + branding.

import { supabase, getServiceSupabase } from '@/lib/supabase';

export const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  brandingLogo: string;
  brandingColor: string;
  status: string;
}

function mapOrg(r: any): Organization {
  return {
    id: r.id,
    name: r.name || 'NEXUS WMS',
    slug: r.slug || '',
    plan: r.plan || 'FREE',
    brandingLogo: r.branding_logo || '',
    brandingColor: r.branding_color || '#0ea5e9',
    status: r.status || 'ACTIVE',
  };
}

export async function getOrg(id: string = DEFAULT_ORG): Promise<Organization | null> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapOrg(data);
}

export async function updateOrg(
  id: string,
  patch: Partial<{ name: string; plan: string; brandingLogo: string; brandingColor: string }>,
): Promise<Organization | null> {
  const row: Record<string, any> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.plan !== undefined) row.plan = patch.plan;
  if (patch.brandingLogo !== undefined) row.branding_logo = patch.brandingLogo;
  if (patch.brandingColor !== undefined) row.branding_color = patch.brandingColor;

  const { data, error } = await getServiceSupabase()
    .from('organizations').update(row).eq('id', id).select().single();
  if (error) { console.error('[org] update error:', error); return null; }
  return mapOrg(data);
}
