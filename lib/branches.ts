import { getServiceSupabase } from '@/lib/supabase';
import { countResource } from '@/lib/planLimits';
import { checkAndReserveQuota, releaseQuotaReservation, commitQuotaReservation } from '@/lib/entitlements';

export interface Branch {
    id: string;
    name: string;
    spreadsheetId: string;
    inventorySpreadsheetId: string;
    color: string;
}

// Mocking Branch 2 with the same sheet ID for testing purposes
// In production, these would be different IDs.
const MAIN_SHEET_ID = process.env.SPREADSHEET_ID || '1Jp9sM6b...'; // Fallback will be handled in googleSheets.ts

export const BRANCHES: Branch[] = [
    {
        id: 'hq',
        name: 'สำนักงานใหญ่ (HQ)',
        spreadsheetId: process.env.SPREADSHEET_ID || '', 
        inventorySpreadsheetId: process.env.PRODUCT_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '',
        color: 'indigo'
    },
    {
        id: 'branch-2',
        name: 'สาขา 2 (Rangsit)',
        spreadsheetId: process.env.SPREADSHEET_ID || '',
        inventorySpreadsheetId: process.env.PRODUCT_SPREADSHEET_ID || process.env.SPREADSHEET_ID || '',
        color: 'rose'
    }
];

export const getBranch = (id: string) => BRANCHES.find(b => b.id === id) || BRANCHES[0];

export async function addBranch(
    orgId: string,
    input: { code: string; name: string; color?: string; warehouseName?: string; pickupAddress?: string; eventId?: string },
): Promise<{ success: boolean; error?: string }> {
    const db = getServiceSupabase();
    const { data: existing } = await db
        .from('branches').select('id').eq('org_id', orgId).eq('code', input.code).maybeSingle();

    const eventId = input.eventId || `wms:branch:${orgId}:${input.code}`;
    let reserved = false;

    if (!existing) {
        const qRes = await checkAndReserveQuota(
            orgId,
            'branches',
            () => countResource(orgId, 'branches', 'branches'),
            { module: 'wms', eventId },
        );
        reserved = qRes.limit >= 0;
    }

    let committed = false;
    try {
        const upsertPayload: Record<string, any> = {
            org_id: orgId,
            code: input.code,
            name: input.name,
            color: input.color || 'slate',
            status: 'ACTIVE',
            warehouse_name: input.warehouseName || input.name,
            pickup_address: input.pickupAddress || '',
        };

        let { error } = await db.from('branches').upsert(
            upsertPayload,
            { onConflict: 'org_id,code' },
        );

        if (error && error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
            delete upsertPayload.warehouse_name;
            delete upsertPayload.pickup_address;
            const retry = await db.from('branches').upsert(
                upsertPayload,
                { onConflict: 'org_id,code' },
            );
            error = retry.error;
        }

        if (error) {
            return { success: false, error: error.message };
        }
        if (reserved) {
            await commitQuotaReservation(orgId, 'branches', { module: 'wms', eventId });
            committed = true;
        }
        return { success: true };
    } finally {
        if (reserved && !committed) {
            await releaseQuotaReservation(orgId, 'branches', 1, { module: 'wms', eventId }).catch(() => {});
        }
    }
}
