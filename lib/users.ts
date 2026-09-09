// User management (Supabase app_users). Passwords hashed with bcrypt.

import bcrypt from 'bcryptjs';
import { getServiceSupabase } from './supabase';
import { getCurrentOrgId, DEFAULT_ORG } from './orgContext';
import { checkPlanLimit } from './planLimits';

export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Manager'
  | 'Staff - Inbound'
  | 'Staff - Picker'
  | 'Staff - QC & Pack'
  | 'Staff - Dispatch'
  | 'Staff - Inventory'
  | 'Staff'
  | 'User'
  | 'Viewer';

export interface RoleMeta {
  role: string;
  category: 'management' | 'section' | 'audit';
  title: string;
  description: string;
  allowedSections: string[];
}

export const ROLE_DEFINITIONS: Record<string, RoleMeta> = {
  'Super Admin': {
    role: 'Super Admin',
    category: 'management',
    title: '👑 ผู้ดูแลระบบสูงสุด (Super Admin)',
    description: 'เข้าถึงข้อมูลทั้งหมด ทุกเมนู ทุกการตั้งค่า และเห็นข้อมูลทุกสาขา',
    allowedSections: ['*'],
  },
  'Admin': {
    role: 'Admin',
    category: 'management',
    title: '💻 ผู้ดูแลระบบสาขา (Admin)',
    description: 'จัดการคลังสินค้า สต็อก ออเดอร์ และทีมงานในสาขาที่ได้รับมอบหมาย',
    allowedSections: ['*'],
  },
  'Manager': {
    role: 'Manager',
    category: 'management',
    title: '👔 หัวหน้าคลัง (Manager)',
    description: 'จัดการออเดอร์ วิเคราะห์รายงาน และดูภาพรวมคลังสินค้า',
    allowedSections: ['*'],
  },
  'Staff - Inbound': {
    role: 'Staff - Inbound',
    category: 'section',
    title: '📥 ฝ่ายรับสินค้าเข้า (Inbound)',
    description: 'รับสินค้าเข้า ตรวจนับ PO และจัดเก็บขึ้นชั้นวาง (Putaway)',
    allowedSections: ['inbound', 'inventory', 'home'],
  },
  'Staff - Picker': {
    role: 'Staff - Picker',
    category: 'section',
    title: '🛒 ฝ่ายหยิบสินค้า (Picker)',
    description: 'เดินหยิบสินค้าตาม Wave และเส้นทาง S-Shape',
    allowedSections: ['picking', 'inventory', 'home'],
  },
  'Staff - QC & Pack': {
    role: 'Staff - QC & Pack',
    category: 'section',
    title: '🔍 ฝ่ายตรวจ QC & แพ็ก (QC & Pack)',
    description: 'สแกนตรวจสอบความถูกต้อง QC และบรรจุกล่องพิมพ์ใบปะหน้า',
    allowedSections: ['orders', 'qc', 'pack', 'inventory', 'home'],
  },
  'Staff - Dispatch': {
    role: 'Staff - Dispatch',
    category: 'section',
    title: '🚚 ฝ่ายจัดส่ง & ขนส่ง (Dispatch)',
    description: 'ส่งมอบพัสดุให้ขนส่ง Kerry/Flash/SPX และงานคนขับ POD',
    allowedSections: ['orders', 'dispatch', 'jobs', 'inventory', 'home'],
  },
  'Staff - Inventory': {
    role: 'Staff - Inventory',
    category: 'section',
    title: '📋 ฝ่ายตรวจนับสต็อก (Inventory)',
    description: 'ตรวจนับ Cycle Count ค้นหาและตรวจสอบยอดสต็อกในเชลฟ์',
    allowedSections: ['cycle-count', 'inventory', 'home'],
  },
  'Staff': {
    role: 'Staff',
    category: 'section',
    title: '📱 พนักงานคลังทั่วไป (Staff)',
    description: 'เข้าถึงและใช้งานเครื่องมือในแอพมือถือได้ทุกแผนก',
    allowedSections: ['*'],
  },
  'User': {
    role: 'User',
    category: 'section',
    title: 'พนักงานคลังทั่วไป (User)',
    description: 'เข้าถึงและใช้งานเครื่องมือในแอพมือถือได้ทุกแผนก',
    allowedSections: ['*'],
  },
  'Viewer': {
    role: 'Viewer',
    category: 'audit',
    title: '👁️ ผู้ตรวจสอบ (Viewer)',
    description: 'ดูรายงานและสต็อกอย่างเดียว (Read-only)',
    allowedSections: ['inventory', 'home'],
  },
};

export function isStaffRole(role?: string): boolean {
  if (!role) return false;
  return role.startsWith('Staff') || role === 'User';
}

export function isManagementRole(role?: string): boolean {
  return role === 'Super Admin' || role === 'Admin' || role === 'Manager';
}

export function getRoleMeta(role?: string): RoleMeta {
  if (!role || !ROLE_DEFINITIONS[role]) {
    return ROLE_DEFINITIONS['Staff'];
  }
  return ROLE_DEFINITIONS[role];
}

export interface User {
  id: string;
  username: string;
  role: string;
  status: string;
  lastLogin: string;
  orgId?: string;
  password?: string;
  allowedBranches?: string[];
  allowedOwners?: string[];
}

function mapUser(r: any): User {
  return {
    id: r.id,
    username: r.username,
    role: r.role || 'User',
    status: r.status || 'Active',
    lastLogin: r.last_login || '-',
    orgId: r.org_id || DEFAULT_ORG,
    allowedBranches: Array.isArray(r.allowed_branches) && r.allowed_branches.length ? r.allowed_branches : ['*'],
    allowedOwners: Array.isArray(r.allowed_owners) && r.allowed_owners.length ? r.allowed_owners : ['*'],
  };
}

export async function getUsers(): Promise<User[]> {
  try {
    const orgId = await getCurrentOrgId();
    const { data, error } = await getServiceSupabase()
      .from('app_users').select('*').eq('org_id', orgId).order('created_at', { ascending: true });
    if (error) { console.error('Fetch Users Error:', error.message); return []; }
    return (data || []).map(mapUser);
  } catch (e) {
    console.error('Fetch Users Error:', e);
    return [];
  }
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  try {
    const admin = getServiceSupabase();
    const { data, error } = await admin
      .from('app_users').select('*').ilike('username', username);
    if (error) { console.error('Verify User Error:', error.message); return null; }

    const rows = data || [];
    const allowDevAdmin =
      process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_ADMIN_BACKDOOR === 'true';

    if (rows.length === 0) {
      if (allowDevAdmin && username === 'admin' && password === 'admin') {
        return { id: 'admin', username: 'admin', role: 'Super Admin', status: 'Active', lastLogin: new Date().toISOString(), allowedBranches: ['*'], allowedOwners: ['*'] };
      }
      return null;
    }

    for (const row of rows) {
      if (row.status !== 'Active' || !row.password_hash) continue;
      const ok = await bcrypt.compare(password, row.password_hash);
      if (ok) {
        // Best-effort last-login stamp
        admin.from('app_users').update({ last_login: new Date().toISOString() }).eq('id', row.id).then(() => {}, () => {});
        return { ...mapUser(row), lastLogin: new Date().toISOString() };
      }
    }
    return null;
  } catch (error) {
    console.error('Verify User Error:', error);
    return null;
  }
}

export async function addUser(user: any) {
  const orgId = await getCurrentOrgId();
  const limitErr = await checkPlanLimit(orgId, 'users', 'app_users');
  if (limitErr) return { error: limitErr };

  const hashedPassword = await bcrypt.hash(user.password || '123456', 10);
  const { error } = await getServiceSupabase().from('app_users').insert({
    id: `U-${Date.now()}`,
    org_id: orgId,
    username: user.username,
    email: user.email || '',
    role: user.role || 'Staff',
    status: 'Active',
    password_hash: hashedPassword,
    allowed_branches: user.allowedBranches && user.allowedBranches.length ? user.allowedBranches : ['*'],
    allowed_owners: user.allowedOwners && user.allowedOwners.length ? user.allowedOwners : ['*'],
    last_login: new Date().toISOString().split('T')[0],
  });
  if (error) { console.error('Add User Error:', error.message); return false; }
  return true;
}

export async function updateUser(userId: string, data: any) {
  const patch: Record<string, any> = {};
  if (data.username) patch.username = data.username;
  if (data.role) patch.role = data.role;
  if (data.status) patch.status = data.status;
  if (data.email !== undefined) patch.email = data.email;
  if (data.allowedBranches) patch.allowed_branches = data.allowedBranches;
  if (data.allowedOwners) patch.allowed_owners = data.allowedOwners;
  if (data.password) patch.password_hash = await bcrypt.hash(data.password, 10);

  if (Object.keys(patch).length === 0) return true;
  const { error } = await getServiceSupabase().from('app_users').update(patch).eq('id', userId);
  if (error) { console.error('Update User Error:', error.message); return false; }
  return true;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const { error } = await getServiceSupabase().from('app_users').delete().eq('id', userId);
  if (error) { console.error('Delete User Error:', error.message); return false; }
  return true;
}
