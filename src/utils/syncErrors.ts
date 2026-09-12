import type { SyncErrorCategory } from '@/types';

const RATE_LIMIT_PATTERNS = ['429', 'rate limit', 'too many request', 'throttl'];
const AUTH_PATTERNS = ['401', '403', 'token', 'oauth', 'access denied', 'signature', 'unauthorized', 'forbidden'];
const NETWORK_PATTERNS = ['timeout', 'timed out', 'network', 'econn', 'fetch failed', 'socket', 'abort'];
const VALIDATION_PATTERNS = ['validation', 'invalid', 'missing', 'thiếu', 'không hợp lệ', 'sku'];

export function classifySyncError(
  errorCode: string | null | undefined,
  errorMessage: string,
): SyncErrorCategory {
  const value = `${errorCode ?? ''} ${errorMessage}`.toLowerCase();

  if (RATE_LIMIT_PATTERNS.some((pattern) => value.includes(pattern))) return 'rate_limited';
  if (AUTH_PATTERNS.some((pattern) => value.includes(pattern))) return 'auth_expired';
  if (NETWORK_PATTERNS.some((pattern) => value.includes(pattern))) return 'transient_network';
  if (VALIDATION_PATTERNS.some((pattern) => value.includes(pattern))) return 'validation_error';
  return 'unknown';
}

export function isSyncErrorRetryEligible(category: SyncErrorCategory): boolean {
  return category === 'transient_network' || category === 'rate_limited';
}
