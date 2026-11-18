import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export class CommercialControlError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'COMMERCIAL_CONTROL_ERROR', status = 403) {
    super(message);
    this.name = 'CommercialControlError';
    this.code = code;
    this.status = status;
  }
}

export interface PlatformOperatorActor {
  id?: string;
  operatorId?: string;
  role?: string;
  isPlatformOperator?: boolean;
  isTenantScoped?: boolean;
}

export interface LegalEntityInfo {
  entityId: string;
  tenantId?: string;
  legalName: string;
  taxId: string;
  address?: string;
}

export interface SubscriptionContract {
  contractId: string;
  tenantId: string;
  packageCode?: string;
  currency?: string;
  paymentStatus?: string;
  lastPaymentEventId?: string;
  lastPaidAmountMinor?: number;
  updatedAt?: string;
}

export interface BillingItemInput {
  code?: string;
  description?: string;
  category?: 'software_rent' | 'implementation' | 'import' | 'support' | 'add_on' | 'usage';
  quantity?: number;
  unitAmountMinor: number;
}

const processedPaymentWebhooks = new Map<string, { payloadHash: string; processedAt: string }>();

export function clearCommercialControlForTests(): void {
  processedPaymentWebhooks.clear();
}

export function requirePlatformOperator(actor?: PlatformOperatorActor | null) {
  if (!actor || typeof actor !== 'object') {
    throw new CommercialControlError('Platform operator authentication required', 'PLATFORM_OPERATOR_REQUIRED', 401);
  }
  if (actor.isTenantScoped === true) {
    throw new CommercialControlError(
      'Tenant-scoped admins cannot modify platform contracts or invoices',
      'PLATFORM_OPERATOR_REQUIRED',
      403,
    );
  }
  const isPlatformRole = actor.isPlatformOperator === true || actor.role === 'platform_admin';
  if (!isPlatformRole) {
    throw new CommercialControlError('Forbidden: Platform operator role required', 'PLATFORM_OPERATOR_REQUIRED', 403);
  }
  return Object.freeze({
    operatorId: String(actor.id || actor.operatorId || 'platform-operator'),
    role: 'platform_admin' as const,
  });
}

export function createPlatformSubscriptionInvoice(params: {
  actor?: PlatformOperatorActor | null;
  contract: SubscriptionContract;
  platformVendorEntity: LegalEntityInfo;
  tenantLegalEntity: LegalEntityInfo;
  period?: string;
  billingItems: BillingItemInput[];
  vatRatePercent?: number;
  invoiceNumber?: string;
}) {
  const op = requirePlatformOperator(params.actor);
  const { contract, platformVendorEntity, tenantLegalEntity, billingItems } = params;
  const vatRatePercent = params.vatRatePercent ?? 7;

  if (!contract?.contractId || !contract?.tenantId) {
    throw new CommercialControlError('Valid contractId and tenantId are required', 'INVALID_CONTRACT', 400);
  }
  if (!platformVendorEntity?.entityId || !platformVendorEntity?.taxId || !platformVendorEntity?.legalName) {
    throw new CommercialControlError('Valid platformVendorEntity is required', 'INVALID_PLATFORM_VENDOR', 400);
  }
  if (!tenantLegalEntity?.entityId || !tenantLegalEntity?.taxId || !tenantLegalEntity?.legalName) {
    throw new CommercialControlError('Valid tenantLegalEntity is required', 'INVALID_TENANT_ENTITY', 400);
  }
  if (
    platformVendorEntity.entityId === tenantLegalEntity.entityId ||
    platformVendorEntity.taxId === tenantLegalEntity.taxId
  ) {
    throw new CommercialControlError(
      'Platform vendor issuer must be strictly separate from tenant legal entity',
      'ISSUER_DOMAIN_COLLISION',
      400,
    );
  }
  if (tenantLegalEntity.tenantId && tenantLegalEntity.tenantId !== contract.tenantId) {
    throw new CommercialControlError('Tenant legal entity does not match contract tenantId', 'TENANT_MISMATCH', 403);
  }
  if (!Array.isArray(billingItems) || billingItems.length === 0) {
    throw new CommercialControlError('At least one billingItem is required', 'EMPTY_BILLING_ITEMS', 400);
  }

  let subtotalMinor = 0;
  const normalizedItems = billingItems.map((item, idx) => {
    const qty = Number(item.quantity ?? 1);
    const unitMinor = Number(item.unitAmountMinor);
    if (!Number.isInteger(unitMinor) || unitMinor < 0 || !Number.isFinite(qty) || qty <= 0) {
      throw new CommercialControlError(`Invalid billing item at index ${idx}`, 'INVALID_BILLING_ITEM', 400);
    }
    const lineMinor = Math.round(qty * unitMinor);
    subtotalMinor += lineMinor;
    return {
      code: String(item.code || `LINE-${idx + 1}`),
      description: String(item.description || 'Software subscription rental'),
      category: item.category || 'software_rent',
      quantity: qty,
      unitAmountMinor: unitMinor,
      lineAmountMinor: lineMinor,
    };
  });

  const vatMinor = Math.round((subtotalMinor * Number(vatRatePercent)) / 100);
  const totalMinor = subtotalMinor + vatMinor;
  const period = params.period || new Date().toISOString().slice(0, 7);

  const invoiceCore = {
    invoiceDomain: 'PLATFORM_SAAS_RENT' as const,
    issuerRole: 'PLATFORM_VENDOR' as const,
    invoiceNumber: params.invoiceNumber || `PLT-${period}-${contract.contractId}`,
    contractId: contract.contractId,
    tenantId: contract.tenantId,
    packageCode: contract.packageCode || 'CUSTOM',
    period,
    issuerEntity: {
      entityId: platformVendorEntity.entityId,
      legalName: platformVendorEntity.legalName,
      taxId: platformVendorEntity.taxId,
      address: platformVendorEntity.address || '',
    },
    customerEntity: {
      entityId: tenantLegalEntity.entityId,
      tenantId: contract.tenantId,
      legalName: tenantLegalEntity.legalName,
      taxId: tenantLegalEntity.taxId,
      address: tenantLegalEntity.address || '',
    },
    items: normalizedItems,
    subtotalMinor,
    vatRatePercent,
    vatMinor,
    totalMinor,
    currency: contract.currency || 'THB',
    status: 'issued' as const,
    issuedBy: op.operatorId,
    issuedAt: new Date().toISOString(),
  };

  const checksum = createHash('sha256').update(JSON.stringify(invoiceCore)).digest('hex');
  return Object.freeze({ ...invoiceCore, checksum });
}

export function applyPlatformPaymentWebhook(params: {
  rawBody: string;
  signatureHeaders: Record<string, string | undefined>;
  secretsByKeyId: Record<string, string>;
  event?: { tenantId?: string; eventId?: string; contractId?: string; paymentStatus?: string; amountMinor?: number };
  contractStore: Map<string, SubscriptionContract> | Record<string, SubscriptionContract>;
  maxSkewSeconds?: number;
  nowSec?: number;
}) {
  const sig = String(params.signatureHeaders?.['x-nexus-signature'] || '');
  const ts = Number(params.signatureHeaders?.['x-nexus-timestamp'] || 0);
  const keyId = String(params.signatureHeaders?.['x-nexus-key-id'] || '');
  const secret = params.secretsByKeyId?.[keyId];
  const maxSkewSeconds = params.maxSkewSeconds ?? 300;
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);

  if (!sig || !ts || !keyId || !secret) {
    throw new CommercialControlError('Missing or unknown webhook signing credentials', 'WEBHOOK_UNAUTHORIZED', 401);
  }
  if (Math.abs(nowSec - ts) > maxSkewSeconds) {
    throw new CommercialControlError('Webhook timestamp outside replay window', 'WEBHOOK_REPLAY_EXPIRED', 401);
  }

  const expected = `v1=${createHmac('sha256', secret).update(`${ts}.${params.rawBody}`).digest('hex')}`;
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new CommercialControlError('Invalid payment webhook signature', 'WEBHOOK_SIGNATURE_INVALID', 401);
  }

  const parsed = params.event || JSON.parse(params.rawBody);
  const tenantId = String(parsed?.tenantId || '').trim();
  const eventId = String(parsed?.eventId || '').trim();
  const contractId = String(parsed?.contractId || '').trim();
  if (!tenantId || !eventId || !contractId) {
    throw new CommercialControlError('tenantId, eventId, and contractId are required', 'INVALID_PAYMENT_EVENT', 400);
  }

  const payloadHash = createHash('sha256').update(params.rawBody).digest('hex');
  const dedupKey = `${tenantId}:${eventId}`;
  const existing = processedPaymentWebhooks.get(dedupKey);
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new CommercialControlError('Duplicate payment eventId with conflicting payload', 'PAYMENT_PAYLOAD_MISMATCH', 409);
    }
    return { ok: true, status: 'duplicate_ignored' as const, eventId, tenantId };
  }

  const contract =
    params.contractStore instanceof Map
      ? params.contractStore.get(contractId)
      : params.contractStore?.[contractId];
  if (!contract) {
    throw new CommercialControlError(`Contract ${contractId} not found`, 'CONTRACT_NOT_FOUND', 404);
  }
  if (contract.tenantId !== tenantId) {
    throw new CommercialControlError('Cross-tenant payment webhook rejected', 'CROSS_TENANT_PAYMENT_REJECTED', 403);
  }

  contract.paymentStatus = parsed.paymentStatus || 'paid';
  contract.lastPaymentEventId = eventId;
  contract.lastPaidAmountMinor = Number(parsed.amountMinor || 0);
  contract.updatedAt = new Date().toISOString();

  processedPaymentWebhooks.set(dedupKey, { payloadHash, processedAt: contract.updatedAt });
  return {
    ok: true,
    status: 'applied' as const,
    eventId,
    tenantId,
    contractId,
    paymentStatus: contract.paymentStatus,
  };
}
