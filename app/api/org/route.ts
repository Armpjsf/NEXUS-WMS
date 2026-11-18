import { NextResponse } from 'next/server';
import {
  getOrg,
  updateOrg,
  toPublicOrgBranding,
  checkTenantSetupReadiness,
  type Organization,
  type UpdateOrgPatch,
} from '@/lib/data/org';
import { getCurrentOrgId } from '@/lib/orgContext';
import { requireManagement, getSessionUser } from '@/lib/apiAuth';
import { canEditPlan } from '@/lib/planAdmin';
import { PLAN_LIMITS, getPlanUsage } from '@/lib/planLimits';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const DEFAULT_PUBLIC_ORG: Organization = {
  id: 'default',
  name: 'NEXUS WMS',
  slug: '',
  plan: 'FREE',
  brandingLogo: '/nexus-icon.png',
  brandingColor: '#2563eb',
  status: 'ACTIVE',
  setupComplete: false,
};

export async function GET(request: Request) {
  try {
    const user = await getSessionUser().catch(() => null);
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const orgId = user?.orgId || await getCurrentOrgId();
    const org = await getOrg(orgId);

    if (!user || mode === 'public') {
      return NextResponse.json(toPublicOrgBranding(org || { ...DEFAULT_PUBLIC_ORG, id: orgId }));
    }

    const effectiveOrg = org || { ...DEFAULT_PUBLIC_ORG, id: orgId };
    const readiness = checkTenantSetupReadiness(org);

    return NextResponse.json({
      ...effectiveOrg,
      setupComplete: readiness.ready,
      readiness,
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

    const orgId = guard.user.orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization context missing' }, { status: 403 });
    }

    const body = await request.json();

    if (body.taxId !== undefined && body.taxId !== '' && !/^\d{13}$/.test(String(body.taxId).trim())) {
      return NextResponse.json({ error: 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก' }, { status: 400 });
    }

    const current = await getOrg(orgId);
    const patch: UpdateOrgPatch = {};

    const allowedKeys: Array<keyof UpdateOrgPatch> = [
      'name',
      'brandingLogo',
      'brandingColor',
      'legalName',
      'legalNameEn',
      'taxId',
      'taxBranchCode',
      'address',
      'phone',
      'email',
      'website',
      'bankName',
      'bankAccountNo',
      'bankAccountName',
      'documentLogo',
      'signatoryName',
    ];
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        (patch as Record<string, unknown>)[key] = body[key];
      }
    }
    patch.profileVersion = (current?.profileVersion || 1) + 1;

    if (body.plan !== undefined) {
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
    return NextResponse.json({
      success: true,
      org,
      readiness: checkTenantSetupReadiness(org),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
