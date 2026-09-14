// Pickup-location library (cross-dock origin points with coordinates).
// A checker picks a pickup point per job; coordinates are stored per customer/
// point so they can be reused and pushed to the TMS as Pickup_Lat/Lng.
// Scoped by organization for multi-tenancy.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export interface PickupLocation {
  id: string;
  orgId: string;
  customerId: string | null;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function mapPickupLocation(r: any): PickupLocation {
  return {
    id: r.id,
    orgId: r.org_id || '',
    customerId: r.customer_id || null,
    name: r.name || '',
    address: r.address || '',
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    isDefault: !!r.is_default,
    status: r.status || 'ACTIVE',
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || '',
  };
}

// List pickup points. When customerId is given, return that customer's points
// plus the shared (customer_id = null) points, so a checker always sees the
// generic company pickups too.
export async function getPickupLocations(customerId?: string | null): Promise<PickupLocation[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase.from('pickup_locations').select('*').eq('org_id', orgId);
  if (customerId) {
    q = q.or(`customer_id.eq.${customerId},customer_id.is.null`);
  }
  const { data, error } = await q.order('is_default', { ascending: false }).order('name', { ascending: true });
  if (error) return [];
  return (data || []).map(mapPickupLocation);
}

export async function createPickupLocation(input: Partial<PickupLocation>): Promise<PickupLocation | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const row = {
    org_id: orgId,
    customer_id: input.customerId || null,
    name: input.name || 'จุดรับใหม่',
    address: input.address || '',
    lat: input.lat != null ? Number(input.lat) : null,
    lng: input.lng != null ? Number(input.lng) : null,
    is_default: !!input.isDefault,
    status: input.status || 'ACTIVE',
  };
  const { data, error } = await client.from('pickup_locations').insert(row).select().single();
  if (error) {
    console.error('[pickupLocations] create error:', error);
    return null;
  }
  return mapPickupLocation(data);
}

export async function updatePickupLocation(id: string, patch: Partial<PickupLocation>): Promise<PickupLocation | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.customerId !== undefined) row.customer_id = patch.customerId || null;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.lat !== undefined) row.lat = patch.lat != null ? Number(patch.lat) : null;
  if (patch.lng !== undefined) row.lng = patch.lng != null ? Number(patch.lng) : null;
  if (patch.isDefault !== undefined) row.is_default = !!patch.isDefault;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await client
    .from('pickup_locations').update(row).eq('org_id', orgId).eq('id', id).select().single();
  if (error) {
    console.error('[pickupLocations] update error:', error);
    return null;
  }
  return mapPickupLocation(data);
}

export async function deletePickupLocation(id: string): Promise<{ ok: boolean; error?: string }> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const { data, error } = await client
    .from('pickup_locations').delete().eq('org_id', orgId).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'ไม่พบจุดรับรายการนี้' };
  return { ok: true };
}
