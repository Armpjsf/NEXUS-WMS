// Supplier data layer (vendors for purchase orders and inbound receipts).
// Scoped by organization for multi-tenancy.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export interface Supplier {
  id: string;
  orgId: string;
  code: string;
  name: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  contactPerson: string;
  notes: string;
  status: string;
  createdAt: string;
}

export function mapSupplier(r: any): Supplier {
  return {
    id: r.id,
    orgId: r.org_id || '',
    code: r.code || '',
    name: r.name || '',
    taxId: r.tax_id || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    contactPerson: r.contact_person || '',
    notes: r.notes || '',
    status: r.status || 'ACTIVE',
    createdAt: r.created_at || '',
  };
}

const FALLBACK_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', orgId: '', code: 'SUP-001', name: 'บริษัท เอสซีจี แพคเกจจิ้ง จำกัด (มหาชน)', taxId: '0107536000720', phone: '02-586-3333', email: 'sales@scgpackaging.com', address: '1 ถ.ปูนซิเมนต์ไทย บางซื่อ กรุงเทพฯ 10800', contactPerson: 'คุณวิชัย กุลธร', notes: 'ซัพพลายเออร์หลัก กล่องและบับเบิ้ล', status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'sup-2', orgId: '', code: 'SUP-002', name: 'บริษัท ซีพี ออลล์ ซัพพลาย จำกัด', taxId: '0107542000011', phone: '02-071-9000', email: 'procure@cpall.co.th', address: '313 อาคาร ซี.พี.ทาวเวอร์ ถ.สีลม บางรัก กรุงเทพฯ 10500', contactPerson: 'คุณกิตติศักดิ์ เจริญพร', notes: 'ซัพพลายเออร์สินค้าอุปโภคบริโภค', status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'sup-3', orgId: '', code: 'SUP-003', name: 'บริษัท สยามแม็คโคร ซัพพลายเชน จำกัด', taxId: '0107531000110', phone: '02-067-8999', email: 'vendor@makro.co.th', address: '1468 ถ.พัฒนาการ คลองตันเหนือ วัฒนา กรุงเทพฯ 10250', contactPerson: 'คุณนภาลัย สุขเกษม', notes: 'ซัพพลายเออร์เครื่องใช้สำนักงาน', status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'sup-4', orgId: '', code: 'SUP-004', name: 'บริษัท ดับเบิ้ล เอ (1991) จำกัด (มหาชน)', taxId: '0107537000782', phone: '037-208-888', email: 'paper@doublea.co.th', address: '1 หมู่ 2 ต.ท่าตูม อ.ศรีมหาโพธิ จ.ปราจีนบุรี 25140', contactPerson: 'คุณพิชัย นิติการ', notes: 'กระดาษถ่ายเอกสาร A4', status: 'ACTIVE', createdAt: new Date().toISOString() },
];

export async function getSuppliers(search?: string): Promise<Supplier[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase
    .from('suppliers')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`code.ilike.%${s}%,name.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) {
    return FALLBACK_SUPPLIERS;
  }
  return (data || []).map(mapSupplier);
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapSupplier(data);
}

export async function createSupplier(input: Partial<Supplier>): Promise<Supplier | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  let code = (input.code || '').trim().toUpperCase();
  if (!code) {
    const ts = Date.now().toString().slice(-4);
    code = `SUPP-${ts}`;
  }

  const row = {
    org_id: orgId,
    code,
    name: input.name || 'ผู้จำหน่ายใหม่',
    tax_id: input.taxId || '',
    phone: input.phone || '',
    email: input.email || '',
    address: input.address || '',
    contact_person: input.contactPerson || '',
    notes: input.notes || '',
    status: input.status || 'ACTIVE',
  };

  const { data, error } = await client
    .from('suppliers')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[suppliers] createSupplier error:', error);
    return null;
  }
  return mapSupplier(data);
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  const row: Record<string, any> = {};
  if (patch.code !== undefined) row.code = patch.code.trim().toUpperCase();
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.taxId !== undefined) row.tax_id = patch.taxId;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.contactPerson !== undefined) row.contact_person = patch.contactPerson;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await client
    .from('suppliers')
    .update(row)
    .eq('org_id', orgId)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[suppliers] updateSupplier error:', error);
    return null;
  }
  return mapSupplier(data);
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const { error } = await client
    .from('suppliers')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id);

  if (error) {
    console.error('[suppliers] deleteSupplier error:', error);
    return false;
  }
  return true;
}
