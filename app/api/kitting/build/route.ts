import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initialBOMs, validateKitAssembly } from '@/lib/kittingEngine';
import { recordEnterpriseAudit } from '@/lib/auditTrailEnterprise';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { bomId, quantity, action } = body; // action: 'ASSEMBLE' | 'DISASSEMBLE'

    const bom = initialBOMs.find(b => b.id === bomId);
    if (!bom) {
      return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
    }

    const buildQty = Number(quantity) || 1;

    // Simulate inventory check
    const stockMap: Record<string, number> = {
      'SKU-SOLAR-5K': 50,
      'SKU-ELEC-006': 100,
      'SKU-BEV-002': 200,
      'SKU-PROD-001': 500
    };

    if (action === 'ASSEMBLE') {
      const validation = validateKitAssembly(bom, buildQty, stockMap);
      if (!validation.canBuild) {
        return NextResponse.json({
          error: 'ชิ้นส่วนในสต็อกไม่เพียงพอสำหรับการรวมชุด',
          missingComponents: validation.missingComponents
        }, { status: 400 });
      }

      await recordEnterpriseAudit({
        orgId: '00000000-0000-0000-0000-000000000001',
        entityName: 'bill_of_materials',
        entityId: bom.id,
        action: 'UPDATE',
        beforeState: { kitSku: bom.kitSku, action: 'BEFORE_ASSEMBLE' },
        afterState: { kitSku: bom.kitSku, assembledQty: buildQty, componentsDeducted: bom.components },
        performedBy: (session.user as any)?.id || 'admin',
        userEmail: session.user?.email || 'admin@nexus.com',
        reason: `รวมชุดสินค้า (Kitting Assembly): ${bom.kitName} x ${buildQty} ชุด`
      });

      return NextResponse.json({
        success: true,
        message: `รวมชุดสินค้า ${bom.kitName} สำเร็จจำนวน ${buildQty} ชุด ตัดสต็อกชิ้นส่วนย่อยเรียบร้อยแล้ว`,
        assembledKit: {
          kitSku: bom.kitSku,
          kitName: bom.kitName,
          quantity: buildQty,
          lotNumber: `LOT-KIT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
        }
      });
    } else {
      // Disassemble
      await recordEnterpriseAudit({
        orgId: '00000000-0000-0000-0000-000000000001',
        entityName: 'bill_of_materials',
        entityId: bom.id,
        action: 'UPDATE',
        beforeState: { kitSku: bom.kitSku, action: 'BEFORE_DISASSEMBLE' },
        afterState: { kitSku: bom.kitSku, disassembledQty: buildQty },
        performedBy: (session.user as any)?.id || 'admin',
        userEmail: session.user?.email || 'admin@nexus.com',
        reason: `แยกชุดสินค้า (De-kitting): ${bom.kitName} x ${buildQty} ชุด คืนชิ้นส่วนเข้าสต็อก`
      });

      return NextResponse.json({
        success: true,
        message: `แยกชุดสินค้า ${bom.kitName} จำนวน ${buildQty} ชุด คืนชิ้นส่วนย่อยเข้าสต็อกเรียบร้อยแล้ว`
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
