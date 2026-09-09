// Customer data layer (buyers, delivery destinations).
// Scoped by organization for multi-tenancy.

import { supabase, getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgId } from '@/lib/orgContext';

export interface Customer {
  id: string;
  orgId: string;
  code: string;
  name: string;
  taxId: string;
  branchNumber: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  defaultCarrier: string;
  contactPerson: string;
  paymentTerm: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function mapCustomer(r: any): Customer {
  return {
    id: r.id,
    orgId: r.org_id || '',
    code: r.code || '',
    name: r.name || '',
    taxId: r.tax_id || '',
    branchNumber: r.branch_number || '00000',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    postalCode: r.postal_code || '',
    defaultCarrier: r.default_carrier || '',
    contactPerson: r.contact_person || '',
    paymentTerm: r.payment_term || 'CASH',
    notes: r.notes || '',
    status: r.status || 'ACTIVE',
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || '',
  };
}

const FALLBACK_CUSTOMERS: Customer[] = [
  { id: 'cus-1', orgId: '', code: 'CUS-001', name: 'บริษัท สรรพสินค้าเซ็นทรัล จำกัด (สาขาลาดพร้าว)', taxId: '0105523004456', branchNumber: '00001', phone: '02-793-7000', email: 'po@central.co.th', address: '1693 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900', postalCode: '10900', defaultCarrier: 'Flash Express', contactPerson: 'คุณธนากร พัฒนกิจ', paymentTerm: 'CREDIT_30', notes: 'ส่งที่ช่องรับสินค้า ชั้น B1', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cus-2', orgId: '', code: 'CUS-002', name: 'บริษัท บิ๊กซี ซูเปอร์เซ็นเตอร์ จำกัด (มหาชน) สาขารัชดา', taxId: '0107536000220', branchNumber: '00002', phone: '02-250-4888', email: 'dc@bigc.co.th', address: '125 ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400', postalCode: '10400', defaultCarrier: 'Kerry Express (KEX)', contactPerson: 'คุณเมธี เจริญรัตน์', paymentTerm: 'CREDIT_45', notes: 'ส่งพร้อมเอกสารตรวจรับ 3 ชุด', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cus-3', orgId: '', code: 'CUS-003', name: 'คุณสมชาย ใจดี (ลูกค้าขายส่งออนไลน์)', taxId: '', branchNumber: '00000', phone: '081-234-5678', email: 'somchai.shop@gmail.com', address: '123/45 หมู่บ้านสุขสันต์ ซอย 9 แขวงบางเขน เขตสายไหม กรุงเทพมหานคร 10220', postalCode: '10220', defaultCarrier: 'ไปรษณีย์ไทย (EMS)', contactPerson: 'คุณสมชาย ใจดี', paymentTerm: 'CASH', notes: 'ระวังแตก / กรุณาโทรแจ้งก่อนส่ง', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export async function getCustomers(search?: string): Promise<Customer[]> {
  const orgId = await getCurrentOrgId();
  let q = supabase
    .from('customers')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (search && search.trim()) {
    const s = search.trim();
    q = q.or(`code.ilike.%${s}%,name.ilike.%${s}%,phone.ilike.%${s}%,contact_person.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) {
    return FALLBACK_CUSTOMERS;
  }
  return (data || []).map(mapCustomer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapCustomer(data);
}

export async function createCustomer(input: Partial<Customer>): Promise<Customer | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  let code = (input.code || '').trim().toUpperCase();
  if (!code) {
    const ts = Date.now().toString().slice(-4);
    code = `CUST-${ts}`;
  }

  const row = {
    org_id: orgId,
    code,
    name: input.name || 'ลูกค้าใหม่',
    tax_id: input.taxId || '',
    branch_number: input.branchNumber || '00000',
    phone: input.phone || '',
    email: input.email || '',
    address: input.address || '',
    postal_code: input.postalCode || '',
    default_carrier: input.defaultCarrier || '',
    contact_person: input.contactPerson || '',
    payment_term: input.paymentTerm || 'CASH',
    notes: input.notes || '',
    status: input.status || 'ACTIVE',
  };

  const { data, error } = await client
    .from('customers')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[customers] createCustomer error:', error);
    return null;
  }
  return mapCustomer(data);
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer | null> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();

  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.code !== undefined) row.code = patch.code.trim().toUpperCase();
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.taxId !== undefined) row.tax_id = patch.taxId;
  if (patch.branchNumber !== undefined) row.branch_number = patch.branchNumber;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.postalCode !== undefined) row.postal_code = patch.postalCode;
  if (patch.defaultCarrier !== undefined) row.default_carrier = patch.defaultCarrier;
  if (patch.contactPerson !== undefined) row.contact_person = patch.contactPerson;
  if (patch.paymentTerm !== undefined) row.payment_term = patch.paymentTerm;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await client
    .from('customers')
    .update(row)
    .eq('org_id', orgId)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[customers] updateCustomer error:', error);
    return null;
  }
  return mapCustomer(data);
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const orgId = await getCurrentOrgId();
  const client = getServiceSupabase();
  const { error } = await client
    .from('customers')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id);

  if (error) {
    console.error('[customers] deleteCustomer error:', error);
    return false;
  }
  return true;
}
