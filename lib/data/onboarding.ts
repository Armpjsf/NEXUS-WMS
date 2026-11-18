// Self-service onboarding: idempotent & transactional-compensated creation of
// an organization + HQ branch + first Super Admin user + optional opt-in demo seed.

import bcrypt from 'bcryptjs';
import { getServiceSupabase } from '@/lib/supabase';
import { resetBinsBulk } from '@/lib/stockLocations';

export interface OnboardInput {
  orgName: string;
  slug?: string;
  plan?: string;
  adminUsername: string;
  adminPassword: string;
  seedDemo?: boolean;
  idempotencyKey?: string;
  resumeIfIncomplete?: boolean;
  legalName?: string;
  taxId?: string;
  address?: string;
}

export interface OnboardResult {
  ok: boolean;
  error?: string;
  stepFailed?: 'validation' | 'organization' | 'branch' | 'admin_user' | 'demo_seed';
  orgId?: string;
  username?: string;
  resumed?: boolean;
  seededDemo?: boolean;
  rolledBack?: boolean;
}

const completedOnboardingByKey = new Map<string, OnboardResult>();

export function clearOnboardingIdempotencyCacheForTests(): void {
  completedOnboardingByKey.clear();
}

async function rollbackPartialOrganization(
  admin: ReturnType<typeof getServiceSupabase>,
  orgId: string,
): Promise<boolean> {
  try {
    await admin.from('app_users').delete().eq('org_id', orgId);
    await admin.from('branches').delete().eq('org_id', orgId);
    await admin.from('organizations').delete().eq('id', orgId);
    return true;
  } catch {
    return false;
  }
}

export async function onboardOrganization(input: OnboardInput): Promise<OnboardResult> {
  const admin = getServiceSupabase();
  const orgName = (input.orgName || '').trim();
  const username = (input.adminUsername || '').trim().toLowerCase();
  const idempotencyKey = input.idempotencyKey?.trim() || '';
  const shouldSeedDemo = input.seedDemo === true;

  if (!orgName) {
    return { ok: false, stepFailed: 'validation', error: 'กรุณาระบุชื่อองค์กร' };
  }
  if (!username || !input.adminPassword) {
    return { ok: false, stepFailed: 'validation', error: 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน' };
  }
  if (input.adminPassword.length < 6) {
    return { ok: false, stepFailed: 'validation', error: 'รหัสผ่านอย่างน้อย 6 ตัวอักษร' };
  }

  if (idempotencyKey && completedOnboardingByKey.has(idempotencyKey)) {
    const cached = completedOnboardingByKey.get(idempotencyKey)!;
    if (cached.ok) {
      return { ...cached, resumed: true };
    }
  }

  const slug =
    (input.slug || orgName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `org-${Date.now()}`;

  const { data: slugTaken, error: slugLookupErr } = await admin
    .from('organizations')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();

  if (slugLookupErr) {
    return { ok: false, stepFailed: 'organization', error: slugLookupErr.message };
  }

  let orgId = '';
  let resumed = false;

  if (slugTaken) {
    const canResume = Boolean(input.resumeIfIncomplete) || Boolean(idempotencyKey);
    if (!canResume) {
      return { ok: false, stepFailed: 'organization', error: `slug "${slug}" ถูกใช้แล้ว` };
    }
    orgId = String(slugTaken.id);
    resumed = true;
  } else {
    // org-scope-ok: usernames are unique across the platform (login has no org)
    const { data: userTaken } = await admin
      .from('app_users')
      .select('id, org_id')
      .ilike('username', username)
      .maybeSingle();
    if (userTaken) {
      return { ok: false, stepFailed: 'validation', error: `ชื่อผู้ใช้ "${username}" ถูกใช้แล้ว` };
    }

    // 1) Organization — public onboarding always starts on FREE
    const orgPayload: Record<string, unknown> = {
      name: orgName,
      slug,
      plan: 'FREE',
      status: 'ACTIVE',
    };
    if (input.legalName) orgPayload.legal_name = input.legalName.trim();
    if (input.taxId) orgPayload.tax_id = input.taxId.trim();
    if (input.address) orgPayload.address = input.address.trim();
    if (idempotencyKey) orgPayload.idempotency_key = idempotencyKey;

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert(orgPayload)
      .select()
      .single();

    if (orgErr || !org) {
      return {
        ok: false,
        stepFailed: 'organization',
        error: orgErr?.message || 'สร้างองค์กรไม่สำเร็จ',
      };
    }
    orgId = String(org.id);
  }

  // 2) HQ branch (idempotent check if resuming)
  let hqExists = false;
  if (resumed) {
    const { data: existingHq, error: hqCheckErr } = await admin
      .from('branches')
      .select('id')
      .eq('org_id', orgId)
      .eq('code', 'HQ')
      .maybeSingle();
    if (hqCheckErr) {
      return { ok: false, stepFailed: 'branch', error: hqCheckErr.message, orgId };
    }
    hqExists = Boolean(existingHq);
  }

  if (!hqExists) {
    const { error: branchErr } = await admin.from('branches').insert({
      org_id: orgId,
      code: 'HQ',
      name: 'สำนักงานใหญ่ (HQ)',
      color: 'indigo',
    });
    if (branchErr) {
      const rolledBack = !resumed ? await rollbackPartialOrganization(admin, orgId) : false;
      return {
        ok: false,
        stepFailed: 'branch',
        error: branchErr.message || 'สร้างสาขา HQ ไม่สำเร็จ',
        rolledBack,
      };
    }
  }

  // 3) Admin user (idempotent check if resuming)
  let adminExists = false;
  if (resumed) {
    const { data: existingAdmin, error: adminCheckErr } = await admin
      .from('app_users')
      .select('id, username')
      .eq('org_id', orgId)
      .ilike('username', username)
      .maybeSingle();
    if (adminCheckErr) {
      return { ok: false, stepFailed: 'admin_user', error: adminCheckErr.message, orgId };
    }
    adminExists = Boolean(existingAdmin);
  }

  if (!adminExists) {
    // org-scope-ok: ensure username is not taken by another org when resuming
    const { data: globalUser } = await admin
      .from('app_users')
      .select('id, org_id')
      .ilike('username', username)
      .maybeSingle();
    if (globalUser && String(globalUser.org_id || '') !== orgId) {
      return {
        ok: false,
        stepFailed: 'admin_user',
        error: `ชื่อผู้ใช้ "${username}" ถูกใช้แล้วในองค์กรอื่น`,
      };
    }

    const hash = await bcrypt.hash(input.adminPassword, 10);
    const { error: userErr } = await admin.from('app_users').insert({
      id: `U-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      org_id: orgId,
      username,
      role: 'Super Admin',
      status: 'Active',
      password_hash: hash,
      allowed_branches: ['*'],
      allowed_owners: ['*'],
      last_login: new Date().toISOString().split('T')[0],
    });
    if (userErr) {
      const rolledBack = !resumed ? await rollbackPartialOrganization(admin, orgId) : false;
      return {
        ok: false,
        stepFailed: 'admin_user',
        error: userErr.message || 'สร้างผู้ดูแลระบบเริ่มต้นไม่สำเร็จ',
        rolledBack,
      };
    }
  }

  // 4) Optional opt-in demo seed ONLY when seedDemo === true
  let seededDemo = false;
  if (shouldSeedDemo) {
    const { data: existingProducts } = await admin
      .from('products')
      .select('sku')
      .eq('org_id', orgId)
      .limit(1);

    if (!existingProducts || existingProducts.length === 0) {
      const bins = ['A-01-01', 'A-01-02', 'A-02-01', 'B-01-01'].map((code, i) => ({
        org_id: orgId,
        bin_code: code,
        zone: code[0],
        aisle: 1,
        rack: i + 1,
        shelf: 1,
      }));
      const { error: binsErr } = await admin.from('warehouse_locations').insert(bins);
      if (binsErr) {
        return {
          ok: false,
          stepFailed: 'demo_seed',
          error: binsErr.message || 'สร้างคลังตัวอย่างไม่สำเร็จ',
          orgId,
        };
      }

      const products = [
        { sku: 'SKU-0001', name: 'สินค้าตัวอย่าง A', category: 'General', stock: 100, min_stock: 10, unit: 'pcs', price: 50, location: 'A-01-01' },
        { sku: 'SKU-0002', name: 'สินค้าตัวอย่าง B', category: 'General', stock: 40, min_stock: 5, unit: 'pcs', price: 120, location: 'A-01-02' },
        { sku: 'SKU-0003', name: 'สินค้าตัวอย่าง C', category: 'General', stock: 8, min_stock: 10, unit: 'box', price: 300, location: 'B-01-01' },
      ].map((p) => ({ ...p, org_id: orgId }));
      const { error: prodErr } = await admin.from('products').insert(products);
      if (prodErr) {
        return {
          ok: false,
          stepFailed: 'demo_seed',
          error: prodErr.message || 'สร้างสินค้าตัวอย่างไม่สำเร็จ',
          orgId,
        };
      }

      try {
        await resetBinsBulk(
          orgId,
          products.map((p) => ({ sku: p.sku, binCode: p.location, quantity: p.stock })),
        );
      } catch (e) {
        console.warn('Onboarding bin seed warning:', e);
      }
      seededDemo = true;
    }
  }

  const result: OnboardResult = {
    ok: true,
    orgId,
    username,
    resumed,
    seededDemo,
  };
  if (idempotencyKey) {
    completedOnboardingByKey.set(idempotencyKey, result);
  }
  return result;
}
