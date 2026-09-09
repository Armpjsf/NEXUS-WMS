
import { NextResponse } from 'next/server';
import { getRules, saveRule, type AutomationRule, ensureRulesSheet } from '@/lib/data/wms';
import { requireManagement } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const guard = await requireManagement();
    if (guard.error) return guard.error;
    try {
        await ensureRulesSheet();
        const rules = await getRules();
        return NextResponse.json(rules);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const guard = await requireManagement();
    if (guard.error) return guard.error;
    try {
        const body = await req.json();
        
        const rule: AutomationRule = {
            id: body.id || `RULE-${Date.now()}`,
            name: body.name,
            triggerType: body.triggerType,
            condition: JSON.stringify(body.conditionRaw), // Expect object, store as string
            action: JSON.stringify(body.actionRaw),       // Expect object, store as string
            isActive: body.isActive ?? true,
            lastTriggered: ""
        };

        await saveRule(rule);
        return NextResponse.json({ success: true, rule });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
