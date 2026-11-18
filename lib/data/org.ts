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
  legalName?: string;
  legalNameEn?: string;
  taxId?: string;
  taxBranchCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  documentLogo?: string;
  signatoryName?: string;
  profileVersion?: number;
  setupComplete?: boolean;
}

export interface PublicOrgBranding {
  id: string;
  name: string;
  slug: string;
  brandingLogo: string;
  brandingColor: string;
  documentLogo?: string;
  status: string;
  setupComplete: boolean;
}

export interface TenantSetupReadiness {
  ready: boolean;
  missingFields: string[];
}

export function checkTenantSetupReadiness(org: Organization | null): TenantSetupReadiness {
  if (!org) {
    return { ready: false, missingFields: ['legalName', 'taxId', 'address'] };
  }
  const missingFields: string[] = [];
  if (!org.legalName?.trim()) missingFields.push('legalName');
  if (!org.taxId?.trim()) missingFields.push('taxId');
  if (!org.address?.trim()) missingFields.push('address');
  return {
    ready: missingFields.length === 0,
    missingFields,
  };
}

export function toPublicOrgBranding(org: Organization): PublicOrgBranding {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    brandingLogo: org.brandingLogo,
    brandingColor: org.brandingColor,
    ...(org.documentLogo ? { documentLogo: org.documentLogo } : {}),
    status: org.status,
    setupComplete: Boolean(org.legalName?.trim() && org.taxId?.trim() && org.address?.trim()),
  };
}

function mapOrg(r: any): Organization {
  const legalName = r.legal_name || '';
  const taxId = r.tax_id || '';
  const address = r.address || '';
  return {
    id: r.id,
    name: r.name || 'NEXUS WMS',
    slug: r.slug || '',
    plan: r.plan || 'FREE',
    brandingLogo: r.branding_logo || '',
    brandingColor: r.branding_color || '#0ea5e9',
    status: r.status || 'ACTIVE',
    legalName,
    legalNameEn: r.legal_name_en || '',
    taxId,
    taxBranchCode: r.tax_branch_code || '',
    address,
    phone: r.phone || '',
    email: r.email || '',
    website: r.website || '',
    bankName: r.bank_name || '',
    bankAccountNo: r.bank_account_no || '',
    bankAccountName: r.bank_account_name || '',
    documentLogo: r.document_logo || '',
    signatoryName: r.signatory_name || '',
    profileVersion: Number(r.profile_version) || 1,
    setupComplete: Boolean(legalName && taxId && address),
  };
}

export async function getOrg(id: string = DEFAULT_ORG): Promise<Organization | null> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapOrg(data);
}

export type UpdateOrgPatch = Partial<{
  name: string;
  plan: string;
  brandingLogo: string;
  brandingColor: string;
  legalName: string;
  legalNameEn: string;
  taxId: string;
  taxBranchCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  documentLogo: string;
  signatoryName: string;
  profileVersion: number;
}>;

export async function updateOrg(
  id: string,
  patch: UpdateOrgPatch,
): Promise<Organization | null> {
  const row: Record<string, any> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.plan !== undefined) row.plan = patch.plan;
  if (patch.brandingLogo !== undefined) row.branding_logo = patch.brandingLogo;
  if (patch.brandingColor !== undefined) row.branding_color = patch.brandingColor;
  if (patch.legalName !== undefined) row.legal_name = patch.legalName;
  if (patch.legalNameEn !== undefined) row.legal_name_en = patch.legalNameEn;
  if (patch.taxId !== undefined) row.tax_id = patch.taxId;
  if (patch.taxBranchCode !== undefined) row.tax_branch_code = patch.taxBranchCode;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.website !== undefined) row.website = patch.website;
  if (patch.bankName !== undefined) row.bank_name = patch.bankName;
  if (patch.bankAccountNo !== undefined) row.bank_account_no = patch.bankAccountNo;
  if (patch.bankAccountName !== undefined) row.bank_account_name = patch.bankAccountName;
  if (patch.documentLogo !== undefined) row.document_logo = patch.documentLogo;
  if (patch.signatoryName !== undefined) row.signatory_name = patch.signatoryName;
  if (patch.profileVersion !== undefined) row.profile_version = patch.profileVersion;

  const { data, error } = await getServiceSupabase()
    .from('organizations').update(row).eq('id', id).select().single();
  if (error) { console.error('[org] update error:', error); return null; }
  return mapOrg(data);
}
