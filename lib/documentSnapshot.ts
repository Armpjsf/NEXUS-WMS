import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ISSUED_STATUSES = new Set([
  'issued',
  'approved',
  'Billed',
  'Paid',
  'DELIVERED',
  'COMPLETED',
]);

export interface SnapshotIssuer {
  legalName: string;
  nameEn?: string;
  taxId: string;
  taxBranchCode?: string;
  address: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  logoUrl?: string;
  signatoryName?: string;
}

export interface DocumentSnapshot {
  snapshotVersion: number;
  tenantId: string;
  legalEntityId: string;
  documentType: string;
  documentNo: string;
  issuedAt: string;
  templateVersion: number;
  issuer: SnapshotIssuer;
  payload: Record<string, unknown>;
  contentHash: string;
}

function sortKeysCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysCanonical);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) {
        out[key] = sortKeysCanonical(v);
      }
    }
    return out;
  }
  return value;
}

function getTokenSecret(): string {
  const secret = process.env.DOCUMENT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('FATAL: DOCUMENT_TOKEN_SECRET or NEXTAUTH_SECRET must be set in production.');
  }
  return secret || 'wms-document-token-dev-only';
}

export function createDocumentSnapshot(input: {
  tenantId: string;
  legalEntityId?: string;
  documentType: string;
  documentNo: string;
  issuerProfile: Record<string, any> | null | undefined;
  templateVersion?: number;
  payload?: Record<string, unknown>;
  issuedAt?: string;
}): DocumentSnapshot {
  const p = input.issuerProfile;
  const legalName = String(p?.legalName || p?.legal_name || p?.company_name || '').trim();
  const taxId = String(p?.taxId || p?.tax_id || '').trim();
  const address = String(p?.address || '').trim();

  if (!legalName || !taxId || !address) {
    const err = new Error('SETUP_REQUIRED: กรุณาตั้งค่าข้อมูลนิติบุคคล (ชื่อบริษัท, เลขผู้เสียภาษี, ที่อยู่) ก่อนออกเอกสารทางการ') as Error & { code?: string; status?: number };
    err.code = 'SETUP_REQUIRED';
    err.status = 400;
    throw err;
  }

  const issuer: SnapshotIssuer = {
    legalName,
    nameEn: String(p?.legalNameEn || p?.nameEn || p?.company_name_en || '').trim(),
    taxId,
    taxBranchCode: String(p?.taxBranchCode || p?.tax_branch_code || '00000').trim(),
    address,
    phone: String(p?.phone || '').trim(),
    email: String(p?.email || '').trim(),
    bankName: String(p?.bankName || p?.bank_name || '').trim(),
    bankAccountNo: String(p?.bankAccountNo || p?.bank_account_no || '').trim(),
    bankAccountName: String(p?.bankAccountName || p?.bank_account_name || '').trim(),
    logoUrl: String(p?.documentLogo || p?.brandingLogo || p?.logoUrl || p?.logo_url || '').trim(),
    signatoryName: String(p?.signatoryName || p?.signatory_name || '').trim(),
  };

  const base = {
    snapshotVersion: 1,
    tenantId: String(input.tenantId),
    legalEntityId: String(input.legalEntityId || p?.legalEntityId || `le-${input.tenantId}`),
    documentType: String(input.documentType),
    documentNo: String(input.documentNo),
    issuedAt: input.issuedAt || new Date().toISOString(),
    templateVersion: Number(input.templateVersion) || 1,
    issuer,
    payload: sortKeysCanonical(input.payload || {}) as Record<string, unknown>,
  };

  const contentHash = createHash('sha256')
    .update(JSON.stringify(sortKeysCanonical(base)))
    .digest('hex');

  return {
    ...base,
    contentHash,
  };
}

export function resolveDocumentIssuer<T extends Record<string, any>>(
  documentRow: Record<string, any> | null | undefined,
  liveCompanyProfile: T,
): SnapshotIssuer | T {
  const status = documentRow?.status || documentRow?.Status;
  const snapshot = documentRow?.issued_snapshot || documentRow?.Issued_Snapshot;
  if (documentRow && ISSUED_STATUSES.has(status) && snapshot) {
    return (snapshot.issuer || snapshot.company || liveCompanyProfile) as SnapshotIssuer | T;
  }
  return liveCompanyProfile;
}

export function issuePublicDocumentToken(params: {
  tenantId: string;
  documentType: string;
  documentId: string;
  ttlSeconds?: number;
  now?: number;
}): string {
  const iat = Math.floor((params.now ?? Date.now()) / 1000);
  const exp = iat + Math.max(1, Number(params.ttlSeconds) || 3600);
  const claims = {
    t: String(params.tenantId),
    dt: String(params.documentType),
    id: String(params.documentId),
    iat,
    exp,
    jti: randomBytes(8).toString('hex'),
  };
  const bodyB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sigB64 = createHmac('sha256', getTokenSecret()).update(bodyB64).digest('base64url');
  return `${bodyB64}.${sigB64}`;
}

export function verifyPublicDocumentToken(
  token: string,
  opts: {
    expectedTenantId?: string;
    expectedDocumentType?: string;
    expectedDocumentId?: string;
    now?: number;
  } = {},
): { valid: boolean; error?: string; payload?: { tenantId: string; documentType: string; documentId: string; iat: number; exp: number; jti: string } } {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, error: 'MALFORMED_TOKEN' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, error: 'MALFORMED_TOKEN' };
  const [bodyB64, sigB64] = parts;

  const expectedSig = createHmac('sha256', getTokenSecret()).update(bodyB64).digest('base64url');
  const actualBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  let claims: any;
  try {
    claims = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'INVALID_PAYLOAD' };
  }

  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!claims.exp || nowSec > Number(claims.exp)) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }
  if (opts.expectedTenantId && claims.t !== String(opts.expectedTenantId)) {
    return { valid: false, error: 'TENANT_MISMATCH' };
  }
  if (opts.expectedDocumentType && claims.dt !== String(opts.expectedDocumentType)) {
    return { valid: false, error: 'DOCUMENT_TYPE_MISMATCH' };
  }
  if (opts.expectedDocumentId && claims.id !== String(opts.expectedDocumentId)) {
    return { valid: false, error: 'DOCUMENT_ID_MISMATCH' };
  }

  return {
    valid: true,
    payload: {
      tenantId: claims.t,
      documentType: claims.dt,
      documentId: claims.id,
      iat: claims.iat,
      exp: claims.exp,
      jti: claims.jti,
    },
  };
}
