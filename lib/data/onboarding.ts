// Self-service onboarding: create an organization + its first admin user +
// seed a small sample warehouse, all scoped to the new org.

import bcrypt from 'bcryptjs';
import { getServiceSupabase } from '@/lib/supabase';

export interface OnboardInput {
  orgName: string;
  slug?: string;
  plan?: string;
  adminUsername: string;
  adminPassword: string;
}

export interface OnboardResult {
  ok: boolean;
  error?: string;
  orgId?: string;
  username?: string;
}

export async function onboardOrganization(input: OnboardInput): Promise<OnboardResult> {
  const admin = getServiceSupabase();
  const orgName = (input.orgName || '').trim();
  const username = (input.adminUsername || '').trim().toLowerCase();

  if (!orgName) return { ok: false, error: 'กรุณาระบุชื่อองค์กร' };
  if (!username || !input.adminPassword) return { ok: false, error: 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน' };
  if (input.adminPassword.length < 6) return { ok: false, error: 'รหัสผ่านอย่างน้อย 6 ตัวอักษร' };

  const slug = (input.slug || orgName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `org-${Date.now()}`;

  // Uniqueness checks
  const { data: slugTaken } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle();
  if (slugTaken) return { ok: false, error: `slug "${slug}" ถูกใช้แล้ว` };
  const { data: userTaken } = await admin.from('app_users').select('id').ilike('username', username).maybeSingle();
  if (userTaken) return { ok: false, error: `ชื่อผู้ใช้ "${username}" ถูกใช้แล้ว` };

  // 1) Organization
  const { data: org, error: orgErr } = await admin.from('organizations').insert({
    name: orgName, slug, plan: input.plan || 'FREE', status: 'ACTIVE',
  }).select().single();
  if (orgErr || !org) return { ok: false, error: orgErr?.message || 'สร้างองค์กรไม่สำเร็จ' };
  const orgId = org.id;

  // 2) HQ branch
  await admin.from('branches').insert({ org_id: orgId, code: 'HQ', name: 'สำนักงานใหญ่ (HQ)', color: 'indigo' });

  // 3) Admin user
  const hash = await bcrypt.hash(input.adminPassword, 10);
  await admin.from('app_users').insert({
    id: `U-${Date.now()}`, org_id: orgId, username, role: 'Super Admin', status: 'Active',
    password_hash: hash, allowed_branches: ['*'], allowed_owners: ['*'],
    last_login: new Date().toISOString().split('T')[0],
  });

  // 4) Seed a small sample warehouse (bins + products) so the tenant lands on a working system
  const bins = ['A-01-01', 'A-01-02', 'A-02-01', 'B-01-01'].map((code, i) => ({
    org_id: orgId, bin_code: code, zone: code[0], aisle: 1, rack: i + 1, shelf: 1,
  }));
  await admin.from('warehouse_locations').insert(bins);

  const products = [
    { sku: 'SKU-0001', name: 'สินค้าตัวอย่าง A', category: 'General', stock: 100, min_stock: 10, unit: 'pcs', price: 50, location: 'A-01-01' },
    { sku: 'SKU-0002', name: 'สินค้าตัวอย่าง B', category: 'General', stock: 40, min_stock: 5, unit: 'pcs', price: 120, location: 'A-01-02' },
    { sku: 'SKU-0003', name: 'สินค้าตัวอย่าง C', category: 'General', stock: 8, min_stock: 10, unit: 'box', price: 300, location: 'B-01-01' },
  ].map((p) => ({ ...p, org_id: orgId }));
  await admin.from('products').insert(products);

  return { ok: true, orgId, username };
}
