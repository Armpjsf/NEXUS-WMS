import { createHash } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase';

export const WMS_BACKUP_TABLES = [
  'branches',
  'app_users',
  'warehouse_locations',
  'products',
  'stock_locations',
  'inventory_ledger',
  'outbound_orders',
  'delivery_trips',
  'document_snapshots',
  'push_subscriptions',
  'device_tokens',
] as const;

export const DEFAULT_WMS_BACKUP_PAGE_SIZE = 500;

const SENSITIVE_FIELD_RE =
  /^(password|password_hash|passwordHash|api_key|apiKey|webhook_secret|webhookSecret|secret|access_token|refresh_token)$/i;

export interface WmsStorageObjectManifest {
  path: string;
  bytes: number;
  sha256: string;
}

export interface WmsLogicalBackupPayload {
  format: 'wms-logical-export-v2';
  recoveryScope: 'logical_table_and_manifest_only';
  schemaVersion: string;
  orgId: string;
  exportedAt: string;
  excludes: string[];
  tables: Record<string, Array<Record<string, unknown>>>;
  tableManifest: Record<string, { rowCount: number; sha256: string }>;
  storageManifest: WmsStorageObjectManifest[];
  manifestChecksum: string;
}

export interface WmsIsolatedStore {
  tables: Record<string, Array<Record<string, unknown>>>;
  quarantinedEndpoints: Array<{ table: string; orgId: string; id: unknown; reason: string }>;
}

export interface WmsBackupQueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        range: (
          from: number,
          to: number,
        ) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message?: string } | null }>;
      };
    };
  };
}

export function redactWmsBackupRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE_FIELD_RE.test(k) && v !== null && v !== undefined && String(v) !== '') {
      const refHash = createHash('sha256').update(String(v)).digest('hex').slice(0, 12);
      out[k] = `[REDACTED_SECRET_REF:${refHash}]`;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactWmsBackupRow(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function createWmsOrgLogicalBackup(
  orgId: string,
  options: {
    supabase?: WmsBackupQueryClient;
    tables?: readonly string[];
    storageObjects?: WmsStorageObjectManifest[];
    schemaVersion?: string;
    pageSize?: number;
  } = {},
): Promise<WmsLogicalBackupPayload> {
  const scopedOrgId = String(orgId || '').trim();
  if (!scopedOrgId) {
    throw new Error('orgId is required for WMS logical backup');
  }

  const client = options.supabase || (getServiceSupabase() as unknown as WmsBackupQueryClient);
  const pageSize = Math.max(1, Number(options.pageSize || DEFAULT_WMS_BACKUP_PAGE_SIZE));
  const tablesList = options.tables && options.tables.length > 0 ? options.tables : WMS_BACKUP_TABLES;

  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const tableManifest: Record<string, { rowCount: number; sha256: string }> = {};

  for (const table of tablesList) {
    const collected: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('org_id', scopedOrgId)
        .range(offset, offset + pageSize - 1);

      if (error || !Array.isArray(data)) {
        throw new Error(`Failed paginated WMS backup read for ${table}: ${error?.message || 'invalid data'}`);
      }
      collected.push(...data);
      if (data.length < pageSize) break;
    }

    const sanitized = collected
      .filter((r) => !r.org_id || String(r.org_id) === scopedOrgId)
      .map((r) => redactWmsBackupRow(r));

    tables[table] = sanitized;
    tableManifest[table] = {
      rowCount: sanitized.length,
      sha256: sha256Json(sanitized),
    };
  }

  const storageManifest = (options.storageObjects || []).map((obj) => ({
    path: obj.path,
    bytes: Number(obj.bytes),
    sha256: String(obj.sha256),
  }));

  const schemaVersion = options.schemaVersion || '2026-11-phase-g';
  const manifestChecksum = sha256Json({
    orgId: scopedOrgId,
    schemaVersion,
    tableManifest,
    storageManifest,
  });

  return {
    format: 'wms-logical-export-v2',
    recoveryScope: 'logical_table_and_manifest_only',
    schemaVersion,
    orgId: scopedOrgId,
    exportedAt: new Date().toISOString(),
    excludes: ['full_pitr_wal', 'raw_database_schema_ddl', 'environment_secrets'],
    tables,
    tableManifest,
    storageManifest,
    manifestChecksum,
  };
}

const WMS_OUTBOUND_TABLES = new Set(['push_subscriptions', 'device_tokens']);

export function restoreWmsOrgBackupIsolated(
  backupPayload: WmsLogicalBackupPayload,
  targetStore: WmsIsolatedStore,
  options: { targetOrgId?: string } = {},
): {
  ok: boolean;
  restoredTables: Record<string, number>;
  quarantinedOutboundCount: number;
  reconciledSkus: number;
  stockMismatches: Array<{ sku: string; productStock: number; binSum: number }>;
} {
  const targetOrgId = String(options.targetOrgId || backupPayload.orgId || '').trim();
  if (!targetOrgId) {
    throw new Error('targetOrgId is required for WMS restore');
  }
  if (backupPayload.orgId !== targetOrgId) {
    throw new Error(`Backup orgId mismatch: expected ${targetOrgId}, got ${backupPayload.orgId}`);
  }

  const expectedChecksum = sha256Json({
    orgId: backupPayload.orgId,
    schemaVersion: backupPayload.schemaVersion,
    tableManifest: backupPayload.tableManifest,
    storageManifest: backupPayload.storageManifest,
  });
  if (expectedChecksum !== backupPayload.manifestChecksum) {
    throw new Error('WMS backup integrity check failed: manifestChecksum mismatch');
  }

  const restoredTables: Record<string, number> = {};
  let quarantinedOutboundCount = 0;

  for (const [table, rows] of Object.entries(backupPayload.tables)) {
    const entry = backupPayload.tableManifest[table];
    if (!entry || entry.rowCount !== rows.length || sha256Json(rows) !== entry.sha256) {
      throw new Error(`WMS backup manifest verification failed for table ${table}`);
    }

    const existing = targetStore.tables[table] || [];
    const foreignRows = existing.filter((r) => String(r.org_id || '') !== targetOrgId);

    const restoredRows = rows.map((row) => {
      if (row.org_id && String(row.org_id) !== targetOrgId) {
        throw new Error(`Cross-org row detected in ${table}`);
      }
      const cloned: Record<string, unknown> = { ...row, org_id: targetOrgId };
      if (WMS_OUTBOUND_TABLES.has(table) || cloned.endpoint !== undefined || cloned.token !== undefined) {
        cloned.quarantined = true;
        cloned.active = false;
        quarantinedOutboundCount++;
        targetStore.quarantinedEndpoints.push({
          table,
          orgId: targetOrgId,
          id: cloned.id ?? null,
          reason: 'ISOLATED_RESTORE_QUARANTINE',
        });
      }
      return cloned;
    });

    targetStore.tables[table] = [...foreignRows, ...restoredRows];
    restoredTables[table] = restoredRows.length;
  }

  // Reconcile stock === sum(bins) for restored org
  const orgProducts = (targetStore.tables.products || []).filter((p) => String(p.org_id) === targetOrgId);
  const orgBins = (targetStore.tables.stock_locations || []).filter((b) => String(b.org_id) === targetOrgId);
  const binSumBySku = new Map<string, number>();
  for (const bin of orgBins) {
    const sku = String(bin.sku || '');
    binSumBySku.set(sku, (binSumBySku.get(sku) || 0) + Number(bin.quantity || 0));
  }

  const stockMismatches: Array<{ sku: string; productStock: number; binSum: number }> = [];
  for (const product of orgProducts) {
    const sku = String(product.sku || '');
    const productStock = Number(product.stock || 0);
    const binSum = binSumBySku.get(sku) || 0;
    if (productStock !== binSum) {
      stockMismatches.push({ sku, productStock, binSum });
    }
  }

  if (stockMismatches.length > 0) {
    throw new Error(`Stock reconciliation mismatch after WMS restore: ${JSON.stringify(stockMismatches)}`);
  }

  return {
    ok: true,
    restoredTables,
    quarantinedOutboundCount,
    reconciledSkus: orgProducts.length,
    stockMismatches,
  };
}
