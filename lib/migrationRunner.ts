import { createHash } from 'node:crypto';

export interface AvailableMigrationFile {
  version: string;
  name?: string;
  content?: string;
  sql?: string;
  checksum?: string;
}

export interface AppliedMigrationRow {
  version: string;
  checksum: string;
  status?: 'applied' | 'failed' | 'rolled_back' | string;
}

export interface LedgerVerificationResult {
  ok: boolean;
  hasDrift: boolean;
  canProceed: boolean;
  pending: Array<{ version: string; name: string; expectedChecksum: string; reason: string }>;
  checksumDrift: Array<{ version: string; name: string; appliedChecksum: string; expectedChecksum: string }>;
  missingFiles: Array<{ version: string; appliedChecksum: string }>;
}

export interface ProvenanceRowInput {
  id?: string | number;
  rowId?: string;
  tenant_id?: string | null;
  org_id?: string | null;
  provenanceTenantId?: string | null;
  provenance_tenant_id?: string | null;
  connectionTenantId?: string | null;
  connection_tenant_id?: string | null;
  connection_id?: string | null;
  branch_tenant_id?: string | null;
  branchTenantId?: string | null;
  branch_id?: string | null;
  branch_code?: string | null;
  user_tenant_id?: string | null;
  userTenantId?: string | null;
  user_id?: string | null;
  candidateTenantIds?: string[];
}

export interface ProvenanceBackfillOptions {
  validTenantIds: string[];
  branchTenantMap?: Record<string, string>;
  userTenantMap?: Record<string, string>;
  connectionTenantMap?: Record<string, string>;
}

export function computeMigrationChecksum(sqlContent: string): string {
  const normalized = String(sqlContent ?? '').replace(/\r\n/g, '\n').trim();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function verifyMigrationLedger(
  appliedList: AppliedMigrationRow[] = [],
  availableFiles: AvailableMigrationFile[] = [],
): LedgerVerificationResult {
  const availableByVersion = new Map<string, { version: string; name: string; checksum: string }>();
  for (const file of availableFiles) {
    const version = String(file.version || '').trim();
    if (!version) continue;
    const checksum = file.checksum
      ? String(file.checksum).trim()
      : computeMigrationChecksum(file.content ?? file.sql ?? '');
    availableByVersion.set(version, {
      version,
      name: file.name || version,
      checksum,
    });
  }

  const appliedByVersion = new Map<string, { version: string; checksum: string; status: string }>();
  for (const row of appliedList) {
    const version = String(row.version || '').trim();
    if (!version) continue;
    appliedByVersion.set(version, {
      version,
      checksum: String(row.checksum || '').trim(),
      status: row.status || 'applied',
    });
  }

  const pending: LedgerVerificationResult['pending'] = [];
  const checksumDrift: LedgerVerificationResult['checksumDrift'] = [];
  const missingFiles: LedgerVerificationResult['missingFiles'] = [];

  for (const [version, avail] of availableByVersion.entries()) {
    const applied = appliedByVersion.get(version);
    if (!applied || applied.status !== 'applied') {
      pending.push({
        version,
        name: avail.name,
        expectedChecksum: avail.checksum,
        reason: applied ? `status:${applied.status}` : 'not_applied',
      });
      continue;
    }
    if (applied.checksum !== avail.checksum) {
      checksumDrift.push({
        version,
        name: avail.name,
        appliedChecksum: applied.checksum,
        expectedChecksum: avail.checksum,
      });
    }
  }

  for (const [version, applied] of appliedByVersion.entries()) {
    if (applied.status === 'applied' && !availableByVersion.has(version)) {
      missingFiles.push({
        version,
        appliedChecksum: applied.checksum,
      });
    }
  }

  return {
    ok: pending.length === 0 && checksumDrift.length === 0 && missingFiles.length === 0,
    hasDrift: checksumDrift.length > 0,
    canProceed: checksumDrift.length === 0 && missingFiles.length === 0,
    pending,
    checksumDrift,
    missingFiles,
  };
}

export function planProvenanceBackfill(
  rows: ProvenanceRowInput[] = [],
  options: ProvenanceBackfillOptions,
) {
  const validSet = new Set(
    (options.validTenantIds || [])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  );
  const branchTenantMap = options.branchTenantMap || {};
  const userTenantMap = options.userTenantMap || {};
  const connectionTenantMap = options.connectionTenantMap || {};

  const alreadyScoped: Array<{ rowId: string; tenantId: string }> = [];
  const mapped: Array<{ rowId: string; resolvedTenantId: string; provenanceSource: string }> = [];
  const quarantine: Array<{
    rowId: string;
    reason: 'MISSING_PROVENANCE' | 'AMBIGUOUS_PROVENANCE';
    candidateTenantIds: string[];
    quarantined: true;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const rowId = String(row.id ?? row.rowId ?? `row-${i}`);
    const existingScope = String(row.tenant_id || row.org_id || '').trim();

    if (existingScope && validSet.has(existingScope)) {
      alreadyScoped.push({ rowId, tenantId: existingScope });
      continue;
    }

    const candidates: string[] = [];
    const sources: string[] = [];
    const addCandidate = (value: unknown, source: string) => {
      const normalized = String(value || '').trim();
      if (normalized && validSet.has(normalized)) {
        candidates.push(normalized);
        sources.push(source);
      }
    };

    if (row.provenanceTenantId || row.provenance_tenant_id) {
      addCandidate(row.provenanceTenantId || row.provenance_tenant_id, 'explicit_provenance');
    }
    if (row.connectionTenantId || row.connection_tenant_id) {
      addCandidate(row.connectionTenantId || row.connection_tenant_id, 'connection');
    }
    if (row.connection_id && connectionTenantMap[row.connection_id]) {
      addCandidate(connectionTenantMap[row.connection_id], 'connection_map');
    }
    if (row.branch_tenant_id || row.branchTenantId) {
      addCandidate(row.branch_tenant_id || row.branchTenantId, 'branch');
    }
    const branchKey = row.branch_id || row.branch_code;
    if (branchKey && branchTenantMap[branchKey]) {
      addCandidate(branchTenantMap[branchKey], 'branch_map');
    }
    if (row.user_tenant_id || row.userTenantId) {
      addCandidate(row.user_tenant_id || row.userTenantId, 'user');
    }
    if (row.user_id && userTenantMap[row.user_id]) {
      addCandidate(userTenantMap[row.user_id], 'user_map');
    }
    if (Array.isArray(row.candidateTenantIds)) {
      for (const c of row.candidateTenantIds) {
        addCandidate(c, 'candidate_list');
      }
    }

    const uniqueCandidates = [...new Set(candidates)];
    if (uniqueCandidates.length === 1) {
      mapped.push({
        rowId,
        resolvedTenantId: uniqueCandidates[0],
        provenanceSource: [...new Set(sources)].join('+'),
      });
    } else {
      quarantine.push({
        rowId,
        reason: uniqueCandidates.length === 0 ? 'MISSING_PROVENANCE' : 'AMBIGUOUS_PROVENANCE',
        candidateTenantIds: uniqueCandidates,
        quarantined: true,
      });
    }
  }

  return {
    alreadyScoped,
    mapped,
    quarantine,
    summary: {
      total: rows.length,
      alreadyScopedCount: alreadyScoped.length,
      mappedCount: mapped.length,
      quarantinedCount: quarantine.length,
    },
  };
}
