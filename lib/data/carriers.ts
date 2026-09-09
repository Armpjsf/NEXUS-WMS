// Carrier data layer (logistics providers).
// Scoped by organization for multi-tenancy.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export interface Carrier {
  id: string;
  orgId: string;
  code: string;
  name: string;
  trackingUrlTemplate: string;
  phone: string;
  contactName: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

export function mapCarrier(r: any): Carrier {
  return {
    id: r.id,
    orgId: r.org_id || '',
    code: r.code || '',
    name: r.name || '',
    trackingUrlTemplate: r.tracking_url_template || '',
    phone: r.phone || '',
    contactName: r.contact_name || '',
    isDefault: Boolean(r.is_default),
    status: r.status || 'ACTIVE',
    createdAt: r.created_at || '',
  };
}

export function buildTrackingUrl(carrier: Carrier | null | undefined, trackingNo: string): string {
  if (!carrier || !carrier.trackingUrlTemplate || !trackingNo) return '';
  return carrier.trackingUrlTemplate.replace('{trackingNo}', encodeURIComponent(trackingNo.trim()));
}

const FALLBACK_CARRIERS: Carrier[] = [
  { id: 'c-flash', orgId: '', code: 'FLASH', name: 'Flash Express', trackingUrlTemplate: 'https://www.flashexpress.co.th/tracking/?se={trackingNo}', phone: '1436', contactName: 'ศูนย์ประสานงาน Flash', isDefault: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'c-kex', orgId: '', code: 'KEX', name: 'Kerry Express (KEX)', trackingUrlTemplate: 'https://th.kerryexpress.com/th/track/?track={trackingNo}', phone: '1217', contactName: 'ศูนย์บริการ Kerry', isDefault: false, status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'c-jnt', orgId: '', code: 'JNT', name: 'J&T Express', trackingUrlTemplate: 'https://www.jtexpress.co.th/index/query/gzquery.html?bills={trackingNo}', phone: '1470', contactName: 'Call Center J&T', isDefault: false, status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'c-ems', orgId: '', code: 'EMS', name: 'ไปรษณีย์ไทย (EMS)', trackingUrlTemplate: 'https://track.thailandpost.co.th/?trackNumber={trackingNo}', phone: '1545', contactName: 'ไปรษณีย์ไทย', isDefault: false, status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'c-spx', orgId: '', code: 'SPX', name: 'Shopee Xpress', trackingUrlTemplate: 'https://spx.co.th/m/track?tracking_number={trackingNo}', phone: '02-017-8399', contactName: 'SPX Support', isDefault: false, status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'c-lala', orgId: '', code: 'LALA', name: 'Lalamove (ส่งด่วนภายในวัน)', trackingUrlTemplate: 'https://www.lalamove.com/th-th/', phone: '02-034-5252', contactName: 'Lalamove Dispatch', isDefault: false, status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'c-fleet', orgId: '', code: 'FLEET', name: 'รถคลังจัดส่งเอง (Company Fleet)', trackingUrlTemplate: '', phone: '02-999-8888', contactName: 'แผนกขับรถส่งสินค้าคลัง', isDefault: false, status: 'ACTIVE', createdAt: new Date().toISOString() },
];

export async function getCarriers(): Promise<Carrier[]> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('carriers')
    .select('*')
    .eq('org_id', orgId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    // Graceful fallback to default carriers if table not yet migrated
    return FALLBACK_CARRIERS;
  }
  return (data || []).map(mapCarrier);
}

export async function getCarrierById(id: string): Promise<Carrier | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('carriers')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapCarrier(data);
}

export async function createCarrier(input: Partial<Carrier>): Promise<Carrier | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  let code = (input.code || '').trim().toUpperCase();
  if (!code) {
    const ts = Date.now().toString().slice(-4);
    code = `CARRIER-${ts}`;
  }

  // If this carrier is set to default, unset other defaults
  if (input.isDefault) {
    await client
      .from('carriers')
      .update({ is_default: false })
      .eq('org_id', orgId);
  }

  const row = {
    org_id: orgId,
    code,
    name: input.name || 'ขนส่งใหม่',
    tracking_url_template: input.trackingUrlTemplate || '',
    phone: input.phone || '',
    contact_name: input.contactName || '',
    is_default: Boolean(input.isDefault),
    status: input.status || 'ACTIVE',
  };

  const { data, error } = await client
    .from('carriers')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[carriers] createCarrier error:', error);
    return null;
  }
  return mapCarrier(data);
}

export async function updateCarrier(id: string, patch: Partial<Carrier>): Promise<Carrier | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  if (patch.isDefault) {
    await client
      .from('carriers')
      .update({ is_default: false })
      .eq('org_id', orgId);
  }

  const row: Record<string, any> = {};
  if (patch.code !== undefined) row.code = patch.code.trim().toUpperCase();
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.trackingUrlTemplate !== undefined) row.tracking_url_template = patch.trackingUrlTemplate;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.contactName !== undefined) row.contact_name = patch.contactName;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await client
    .from('carriers')
    .update(row)
    .eq('org_id', orgId)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[carriers] updateCarrier error:', error);
    return null;
  }
  return mapCarrier(data);
}

export async function deleteCarrier(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const { error } = await client
    .from('carriers')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id);

  if (error) {
    console.error('[carriers] deleteCarrier error:', error);
    return false;
  }
  return true;
}
