const PRIVATE_IPV4_RANGES = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
];

function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '::' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
    return true;
  }
  return PRIVATE_IPV4_RANGES.some((re) => re.test(host));
}

export interface UrlValidationResult {
  valid: boolean;
  url?: string;
  error?: string;
}

export function validateIntegrationUrl(
  rawUrl: string | undefined | null
): UrlValidationResult {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Integration URL is not configured' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Integration URL is malformed' };
  }

  const isLocalHost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1' ||
    parsed.hostname === '[::1]';

  const allowLocalTestUrl =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_LOCAL_INTEGRATION_URL === 'true';

  if (parsed.protocol !== 'https:') {
    if (allowLocalTestUrl && parsed.protocol === 'http:' && isLocalHost) {
      return { valid: true, url: parsed.toString() };
    }
    return { valid: false, error: 'Integration URL must use HTTPS' };
  }

  if (isPrivateOrBlockedHost(parsed.hostname)) {
    if (allowLocalTestUrl && isLocalHost) {
      return { valid: true, url: parsed.toString() };
    }
    return { valid: false, error: 'Integration URL targets a blocked or private host' };
  }

  return { valid: true, url: parsed.toString() };
}
