// Company fleet vehicles (fixed ~5 trucks with assigned drivers). The dock
// checker picks a plate on the dispatch screen so each batch is tied to a truck.
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export interface Vehicle {
  id: string;
  plate: string;
  driverName: string;
  vehicleType: string;
  active: boolean;
}

function mapVehicle(r: any): Vehicle {
  return {
    id: r.id,
    plate: r.plate || '',
    driverName: r.driver_name || '',
    vehicleType: r.vehicle_type || '4-Wheel',
    active: r.active !== false,
  };
}

export async function getVehicles(activeOnly = false): Promise<Vehicle[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase.from('fleet_vehicles').select('*').eq('org_id', orgId).order('plate', { ascending: true });
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) { console.error('[fleet] list error:', error.message); return []; }
  return (data || []).map(mapVehicle);
}

export async function createVehicle(input: Partial<Vehicle>): Promise<Vehicle | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await getServiceSupabase().from('fleet_vehicles').insert({
    org_id: orgId,
    plate: (input.plate || '').trim(),
    driver_name: (input.driverName || '').trim(),
    vehicle_type: input.vehicleType || '4-Wheel',
    active: input.active !== false,
  }).select().single();
  if (error) { console.error('[fleet] create error:', error.message); return null; }
  return mapVehicle(data);
}

export async function updateVehicle(id: string, patch: Partial<Vehicle>): Promise<Vehicle | null> {
  const orgId = await getCurrentOrgId();
  const row: Record<string, any> = {};
  if (patch.plate !== undefined) row.plate = patch.plate.trim();
  if (patch.driverName !== undefined) row.driver_name = patch.driverName.trim();
  if (patch.vehicleType !== undefined) row.vehicle_type = patch.vehicleType;
  if (patch.active !== undefined) row.active = patch.active;
  const { data, error } = await getServiceSupabase().from('fleet_vehicles')
    .update(row).eq('id', id).eq('org_id', orgId).select().single();
  if (error) { console.error('[fleet] update error:', error.message); return null; }
  return mapVehicle(data);
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const { error } = await getServiceSupabase().from('fleet_vehicles').delete().eq('id', id).eq('org_id', orgId);
  if (error) { console.error('[fleet] delete error:', error.message); return false; }
  return true;
}
