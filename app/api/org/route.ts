import { NextResponse } from 'next/server';
import { getOrg, updateOrg } from '@/lib/data/org';
import { getCurrentOrgId, DEFAULT_ORG } from '@/lib/orgContext';
import { requireManagement, getSessionUser } from '@/lib/apiAuth';
import { canEditPlan } from '@/lib/planAdmin';
import { PLAN_LIMITS, getPlanUsage } from '@/lib/planLimits';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const orgId = await getCurrentOrgId();
    const org = await getOrg(orgId);
    const user = await getSessionUser().catch(() => null);
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      ...(org || { name: 'NEXUS WMS', brandingColor: '#2563eb', brandingLogo: '/nexus-icon.png', plan: 'FREE' }),
      canEditPlan: canEditPlan(user),
      // ?usage=1 (settings page): current counts vs plan limits
      ...(searchParams.get('usage') ? { planUsage: await getPlanUsage(orgId) } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireManagement();
    if (guard.error) return guard.error;

    const orgId = guard.user.orgId || DEFAULT_ORG;
    const body = await request.json();
    const patch: { name?: string; plan?: string; brandingLogo?: string; brandingColor?: string } = {
      name: body.name, brandingLogo: body.brandingLogo, brandingColor: body.brandingColor,
    };

    if (body.plan !== undefined) {
      const current = await getOrg(orgId);
      if (body.plan !== current?.plan) {
        if (!canEditPlan(guard.user)) {
          return NextResponse.json({ error: 'เปลี่ยนแพ็กเกจได้เฉพาะผู้ดูแลแพลตฟอร์ม' }, { status: 403 });
        }
        if (!(body.plan in PLAN_LIMITS)) {
          return NextResponse.json({ error: `แพ็กเกจไม่ถูกต้อง: ${body.plan}` }, { status: 400 });
        }
        patch.plan = body.plan;
      }
    }

    const org = await updateOrg(orgId, patch);
    if (!org) return NextResponse.json({ error: 'อัปเดตองค์กรไม่สำเร็จ' }, { status: 500 });
    return NextResponse.json({ success: true, org });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
