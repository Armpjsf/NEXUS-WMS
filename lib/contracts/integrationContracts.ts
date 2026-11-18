export const CONTRACT_VERSION = '2.0.0' as const;

export type ProductName = 'hr' | 'wms' | 'tms';
export type EmploymentClassification = 'employee' | 'subcontractor';
export type PaymentOwner = 'hr_payroll' | 'tms_paid';

export interface IntegrationEnvelopeV2<TPayload = Record<string, unknown>> {
  event_id: string;
  connection_id: string;
  source_product: ProductName;
  target_product: ProductName;
  event_type: string;
  schema_version: string;
  aggregate_id: string;
  aggregate_version: number;
  occurred_at: string;
  correlation_id: string;
  tenant_claim: string;
  payload: TPayload;
}

export interface ExternalOrderJobLink {
  wms_order_id: string;
  wms_order_no: string;
  drop_index: number;
  tms_job_id: string;
}

export interface DriverEarningLineV2 {
  earning_line_id: string;
  revision: number;
  job_id: string;
  driver_id: string;
  driver_name: string;
  employment_type: EmploymentClassification;
  sub_id: string | null;
  plan_date: string | null;
  delivery_date: string | null;
  verified_at: string | null;
  payment_owner: PaymentOwner;
  amount_minor: number;
  currency: 'THB';
  amount_decimal: number;
}

export interface ExternalEntityLinkRecord {
  tenantId: string;
  connectionId: string;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  targetSystem: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DriverEmployeeLinkRecord {
  id: string;
  tenantId: string;
  connectionId: string;
  hrEmployeeId: string;
  tmsDriverId: string;
  employmentClassification: EmploymentClassification;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  verifiedBy: string;
  verifiedAt: string;
}

export class ContractValidationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'CONTRACT_VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'ContractValidationError';
    this.code = code;
    this.status = status;
  }
}

export class CrossTenantLinkError extends Error {
  readonly code = 'CROSS_TENANT_LINK_FORBIDDEN';
  readonly status = 403;

  constructor(message = 'Cross-tenant external entity link access forbidden') {
    super(message);
    this.name = 'CrossTenantLinkError';
  }
}

const VALID_PRODUCTS = new Set<string>(['hr', 'wms', 'tms']);
const VALID_CLASSIFICATIONS = new Set<string>(['employee', 'subcontractor']);

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function validateEnvelope(envelope: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { valid: false, errors: ['Envelope must be a JSON object'] };
  }

  const env = envelope as Record<string, unknown>;
  const requiredStrings = [
    'event_id',
    'connection_id',
    'event_type',
    'aggregate_id',
    'correlation_id',
    'tenant_claim',
  ];

  for (const field of requiredStrings) {
    if (!isNonEmptyString(env[field])) {
      errors.push(`Missing or empty string field: ${field}`);
    }
  }

  if (!isNonEmptyString(env.source_product) || !VALID_PRODUCTS.has(env.source_product)) {
    errors.push('Invalid source_product (must be hr | wms | tms)');
  }
  if (!isNonEmptyString(env.target_product) || !VALID_PRODUCTS.has(env.target_product)) {
    errors.push('Invalid target_product (must be hr | wms | tms)');
  }

  if (!isNonEmptyString(env.schema_version) || !/^2\.\d+\.\d+$/.test(env.schema_version)) {
    errors.push('Invalid schema_version (must match 2.x.y)');
  }

  if (typeof env.aggregate_version !== 'number' || !Number.isInteger(env.aggregate_version) || env.aggregate_version < 1) {
    errors.push('Invalid aggregate_version (must be integer >= 1)');
  }

  if (!isNonEmptyString(env.occurred_at) || Number.isNaN(Date.parse(env.occurred_at))) {
    errors.push('Invalid occurred_at (must be ISO-8601 timestamp)');
  }

  if (!env.payload || typeof env.payload !== 'object' || Array.isArray(env.payload)) {
    errors.push('Invalid payload (must be a non-null object)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Read-only legacy Notes parser kept strictly for historical backfill tooling.
 * @deprecated
 */
export function parseLegacyWmsNotesForBackfillOnly(notes?: string | null) {
  const text = String(notes || '');
  const orderMatches = [...text.matchAll(/\[WMS:\s*([^\]]+)\]/gi)]
    .map((m) => String(m[1] || '').trim())
    .filter(Boolean);
  const tripMatch = text.match(/\[Trip:\s*([^\]]+)\]/i);
  const jobMatch = text.match(/\[TMS Job:\s*([^\]]+)\]/i);
  const dropMatch = text.match(/\[Drop:\s*(\d+)\s*\/\s*(\d+)\]/i);

  return {
    backfillOnly: true as const,
    wmsOrderNos: [...new Set(orderMatches)],
    tripId: tripMatch ? tripMatch[1].trim() : null,
    tmsJobId: jobMatch ? jobMatch[1].trim() : null,
    dropIndex: dropMatch ? Number(dropMatch[1]) : null,
    totalDrops: dropMatch ? Number(dropMatch[2]) : null,
  };
}

export class ExternalEntityLinkStore {
  private readonly links = new Map<string, ExternalEntityLinkRecord>();
  private readonly connectionTenants = new Map<string, string>();

  private buildKey(
    tenantId: string,
    connectionId: string,
    sourceSystem: string,
    sourceType: string,
    sourceId: string,
  ): string {
    return `${tenantId}::${connectionId}::${sourceSystem}::${sourceType}::${sourceId}`;
  }

  private assertTenantConnectionBinding(tenantId: string, connectionId: string): void {
    const existingTenant = this.connectionTenants.get(connectionId);
    if (existingTenant && existingTenant !== tenantId) {
      throw new CrossTenantLinkError(
        `Connection '${connectionId}' belongs to another tenant; cross-tenant link access denied`,
      );
    }
  }

  linkExternalEntity(input: {
    tenantId: string;
    connectionId: string;
    sourceSystem: string;
    sourceType: string;
    sourceId: string;
    targetSystem: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): ExternalEntityLinkRecord {
    const tenantId = String(input.tenantId || '').trim();
    const connectionId = String(input.connectionId || '').trim();
    const sourceSystem = String(input.sourceSystem || '').trim().toLowerCase();
    const sourceType = String(input.sourceType || '').trim();
    const sourceId = String(input.sourceId || '').trim();
    const targetSystem = String(input.targetSystem || '').trim().toLowerCase();
    const targetType = String(input.targetType || '').trim();
    const targetId = String(input.targetId || '').trim();

    if (!tenantId || !connectionId || !sourceSystem || !sourceType || !sourceId || !targetSystem || !targetType || !targetId) {
      throw new ContractValidationError('All external entity link fields are required');
    }

    this.assertTenantConnectionBinding(tenantId, connectionId);
    this.connectionTenants.set(connectionId, tenantId);

    const key = this.buildKey(tenantId, connectionId, sourceSystem, sourceType, sourceId);
    const existing = this.links.get(key);
    if (existing) {
      if (existing.targetId !== targetId || existing.targetSystem !== targetSystem || existing.targetType !== targetType) {
        throw new ContractValidationError(
          `External entity link conflict for ${key}: already mapped to ${existing.targetSystem}:${existing.targetType}:${existing.targetId}`,
          'EXTERNAL_LINK_CONFLICT',
          409,
        );
      }
      return { ...existing };
    }

    const record: ExternalEntityLinkRecord = {
      tenantId,
      connectionId,
      sourceSystem,
      sourceType,
      sourceId,
      targetSystem,
      targetType,
      targetId,
      metadata: input.metadata ? { ...input.metadata } : {},
      createdAt: new Date().toISOString(),
    };
    this.links.set(key, record);
    return { ...record };
  }

  resolveExternalEntity(query: {
    tenantId: string;
    connectionId: string;
    sourceSystem: string;
    sourceType: string;
    sourceId: string;
  }): ExternalEntityLinkRecord | null {
    const tenantId = String(query.tenantId || '').trim();
    const connectionId = String(query.connectionId || '').trim();
    const sourceSystem = String(query.sourceSystem || '').trim().toLowerCase();
    const sourceType = String(query.sourceType || '').trim();
    const sourceId = String(query.sourceId || '').trim();

    if (!tenantId || !connectionId || !sourceSystem || !sourceType || !sourceId) {
      throw new ContractValidationError('tenantId, connectionId, sourceSystem, sourceType, and sourceId are required');
    }

    this.assertTenantConnectionBinding(tenantId, connectionId);

    const key = this.buildKey(tenantId, connectionId, sourceSystem, sourceType, sourceId);
    const found = this.links.get(key);
    if (!found) return null;
    if (found.tenantId !== tenantId) {
      throw new CrossTenantLinkError();
    }
    return { ...found };
  }

  listLinksForTenant(tenantId: string, connectionId?: string): ExternalEntityLinkRecord[] {
    const tid = String(tenantId || '').trim();
    if (!tid) throw new ContractValidationError('tenantId is required');
    if (connectionId) {
      this.assertTenantConnectionBinding(tid, connectionId.trim());
    }
    const out: ExternalEntityLinkRecord[] = [];
    for (const rec of this.links.values()) {
      if (rec.tenantId !== tid) continue;
      if (connectionId && rec.connectionId !== connectionId) continue;
      out.push({ ...rec });
    }
    return out;
  }

  clear(): void {
    this.links.clear();
    this.connectionTenants.clear();
  }
}

export class DriverEmployeeLinkStore {
  private readonly records = new Map<string, DriverEmployeeLinkRecord>();
  private readonly connectionTenants = new Map<string, string>();

  private key(tenantId: string, connectionId: string, tmsDriverId: string): string {
    return `${tenantId}::${connectionId || 'default'}::${tmsDriverId}`;
  }

  upsertVerifiedDriverEmployeeLink(input: {
    id?: string;
    tenantId: string;
    connectionId?: string;
    hrEmployeeId: string;
    tmsDriverId: string;
    employmentClassification: EmploymentClassification;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    active?: boolean;
    verifiedBy: string;
    verifiedAt?: string;
  }): DriverEmployeeLinkRecord {
    const tenantId = String(input.tenantId || '').trim();
    const connectionId = String(input.connectionId || 'default').trim();
    const hrEmployeeId = String(input.hrEmployeeId || '').trim();
    const tmsDriverId = String(input.tmsDriverId || '').trim();
    const employmentClassification = String(input.employmentClassification || '').trim() as EmploymentClassification;
    const verifiedBy = String(input.verifiedBy || '').trim();

    if (!tenantId || !hrEmployeeId || !tmsDriverId) {
      throw new ContractValidationError('tenantId, hrEmployeeId, and tmsDriverId are required');
    }
    if (!VALID_CLASSIFICATIONS.has(employmentClassification)) {
      throw new ContractValidationError("employmentClassification must be 'employee' or 'subcontractor'");
    }
    if (!verifiedBy) {
      throw new ContractValidationError(
        'UNVERIFIED_LINK_REJECTED: verifiedBy actor is required; fuzzy/unverified auto-linking is prohibited',
        'UNVERIFIED_LINK_REJECTED',
        400,
      );
    }

    if (connectionId !== 'default') {
      const bound = this.connectionTenants.get(connectionId);
      if (bound && bound !== tenantId) {
        throw new CrossTenantLinkError();
      }
      this.connectionTenants.set(connectionId, tenantId);
    }

    const k = this.key(tenantId, connectionId, tmsDriverId);
    const existing = this.records.get(k);
    if (existing && existing.tenantId !== tenantId) {
      throw new CrossTenantLinkError();
    }

    const record: DriverEmployeeLinkRecord = {
      id: existing?.id || input.id || `drv-link-${tenantId}-${tmsDriverId}`,
      tenantId,
      connectionId,
      hrEmployeeId,
      tmsDriverId,
      employmentClassification,
      effectiveFrom: input.effectiveFrom || null,
      effectiveTo: input.effectiveTo || null,
      active: input.active !== false,
      verifiedBy,
      verifiedAt: input.verifiedAt || new Date().toISOString(),
    };
    this.records.set(k, record);
    return { ...record };
  }

  getVerifiedDriverEmployeeLink(query: {
    tenantId: string;
    connectionId?: string;
    tmsDriverId: string;
    asOfDate?: string;
  }): DriverEmployeeLinkRecord | null {
    const tid = String(query.tenantId || '').trim();
    const cid = String(query.connectionId || 'default').trim();
    const did = String(query.tmsDriverId || '').trim();
    if (!tid || !did) {
      throw new ContractValidationError('tenantId and tmsDriverId are required');
    }
    if (cid !== 'default') {
      const bound = this.connectionTenants.get(cid);
      if (bound && bound !== tid) {
        throw new CrossTenantLinkError();
      }
    }

    const rec = this.records.get(this.key(tid, cid, did));
    if (!rec) return null;
    if (rec.tenantId !== tid) throw new CrossTenantLinkError();
    if (!rec.active) return null;

    if (query.asOfDate) {
      const target = String(query.asOfDate).slice(0, 10);
      if (rec.effectiveFrom && target < String(rec.effectiveFrom).slice(0, 10)) return null;
      if (rec.effectiveTo && target > String(rec.effectiveTo).slice(0, 10)) return null;
    }

    return { ...rec };
  }

  listDriverEmployeeLinks(query: {
    tenantId: string;
    connectionId?: string;
    activeOnly?: boolean;
  }): DriverEmployeeLinkRecord[] {
    const tid = String(query.tenantId || '').trim();
    if (!tid) throw new ContractValidationError('tenantId is required');
    if (query.connectionId && query.connectionId !== 'default') {
      const bound = this.connectionTenants.get(query.connectionId);
      if (bound && bound !== tid) {
        throw new CrossTenantLinkError();
      }
    }

    const out: DriverEmployeeLinkRecord[] = [];
    for (const rec of this.records.values()) {
      if (rec.tenantId !== tid) continue;
      if (query.connectionId && rec.connectionId !== query.connectionId) continue;
      if (query.activeOnly && !rec.active) continue;
      out.push({ ...rec });
    }
    return out;
  }

  clear(): void {
    this.records.clear();
    this.connectionTenants.clear();
  }
}
