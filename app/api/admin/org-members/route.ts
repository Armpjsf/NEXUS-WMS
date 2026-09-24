import { NextResponse } from 'next/server';
import { requireManagement } from '@/lib/apiAuth';
import { getServiceSupabase } from '@/lib/supabase';
import { DEFAULT_ORG } from '@/lib/orgContext';
import { checkPlanLimit } from '@/lib/planLimits';
import { logAction } from '@/lib/auditTrail';
import { ROLE_DEFINITIONS } from '@/lib/users';

export const dynamic = 'force-dynamic';

// Members of the CURRENT org whose home org is elsewhere (lib/memberships).
// GET → list, POST { username, role } → add, DELETE { userId } → remove.
// Same rule as /api/admin/users: only Admin / Super Admin manage access, and
// only a Super Admin may grant Super Admin.

function forbidden(callerRole?: string, targetRole?: string): NextResponse | null {
  if (callerRole !== 'Super Admin' && callerRole !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden: เฉพาะ Admin จัดการสมาชิกได้' }, { status: 403 });
  }
  if (targetRole === 'Super Admin' && callerRole !== 'Super Admin') {
    return NextResponse.json({ error: 'Forbidden: เฉพาะ Super Admin ตั้งสิทธิ์ Super Admin ได้' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  const orgId = guard.user.orgId || DEFAULT_ORG;
  const admin = getServiceSupabase();
  const { data: rows, error } = await admin.from('org_memberships')
    .select('user_id, role, created_at, added_by').eq('org_id', orgId).order('created_at');
  if (error) return NextResponse.json({ members: [], migrated: false });
  const ids = (rows || []).map(r => r.user_id);
  // org-scope-ok: members' home-org rows, looked up by the ids this org lists
  const { data: users } = ids.length
    ? await admin.from('app_users').select('id, username, org_id, status').in('id', ids)
    : { data: [] as any[] };
  const byId = new Map((users || []).map((u: any) => [u.id, u]));
  return NextResponse.json({
    migrated: true,
    members: (rows || []).map(r => ({
      userId: r.user_id, role: r.role, addedBy: r.added_by, createdAt: r.created_at,
      username: byId.get(r.user_id)?.username || r.user_id,
      status: byId.get(r.user_id)?.status || 'Unknown',
    })),
  });
}

export async function POST(req: Request) {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  const { username, role = 'Staff' } = await req.json();
  const deny = forbidden(guard.user.role, role);
  if (deny) return deny;
  if (!username) return NextResponse.json({ error: 'ระบุชื่อผู้ใช้' }, { status: 400 });
  if (!ROLE_DEFINITIONS[role]) return NextResponse.json({ error: `ไม่รู้จักสิทธิ์ "${role}"` }, { status: 400 });

  const orgId = guard.user.orgId || DEFAULT_ORG;
  const admin = getServiceSupabase();
  // org-scope-ok: usernames are platform-unique; we're looking up a user from another org to invite
  const { data: user } = await admin.from('app_users').select('id, username, org_id, status')
    .ilike('username', String(username).trim()).maybeSingle();
  if (!user) return NextResponse.json({ error: `ไม่พบผู้ใช้ "${username}"` }, { status: 404 });
  if ((user.org_id || DEFAULT_ORG) === orgId) {
    return NextResponse.json({ error: 'ผู้ใช้นี้อยู่ในองค์กรนี้อยู่แล้ว (จัดการที่หน้าผู้ใช้)' }, { status: 409 });
  }

  const limitErr = await checkPlanLimit(orgId, 'users', 'app_users');
  if (limitErr) return NextResponse.json({ error: limitErr }, { status: 403 });

  const { error } = await admin.from('org_memberships').upsert(
    { user_id: user.id, org_id: orgId, role, added_by: guard.user.username || guard.user.name || '' },
    { onConflict: 'user_id,org_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    userId: guard.user.id || 'admin', userName: guard.user.username || 'admin', action: 'CREATE',
    module: 'org_memberships', description: `Added member ${user.username} (${role})`,
  }).catch(() => {});
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const guard = await requireManagement();
  if (guard.error) return guard.error;
  const deny = forbidden(guard.user.role);
  if (deny) return deny;
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'ระบุ userId' }, { status: 400 });
  const orgId = guard.user.orgId || DEFAULT_ORG;
  const { data, error } = await getServiceSupabase().from('org_memberships').delete()
    .eq('org_id', orgId).eq('user_id', userId).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
  await logAction({
    userId: guard.user.id || 'admin', userName: guard.user.username || 'admin', action: 'DELETE',
    module: 'org_memberships', description: `Removed member ${userId}`,
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
