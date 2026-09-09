
import { NextResponse } from 'next/server';
import { getRules, saveRule, type AutomationRule, ensureRulesSheet } from '@/lib/data/wms';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await ensureRulesSheet();
        const rules = await getRules();
        return NextResponse.json(rules);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(req: Request) {
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
