import type { ShopConnectionHealthStatusCode } from '@/types';

export const SHOP_TOKEN_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type TokenExpiryMetadata = {
  readonly tokenExpiresAt: Date | string | null;
  readonly refreshTokenExpiresAt: Date | string | null;
};

function toValidTimestamp(value: Date | string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function computeShopTokenHealthStatus(
  status: Exclude<ShopConnectionHealthStatusCode, 'expiring_soon'>,
  metadata: TokenExpiryMetadata,
  now = new Date(),
): ShopConnectionHealthStatusCode {
  if (status !== 'connected') {
    return status;
  }

  const nowTimestamp = now.getTime();
  const expiryTimestamps = [
    toValidTimestamp(metadata.tokenExpiresAt),
    toValidTimestamp(metadata.refreshTokenExpiresAt),
  ].filter((timestamp): timestamp is number => timestamp !== null);

  const isExpiringSoon = expiryTimestamps.some(
    (timestamp) => timestamp >= nowTimestamp && timestamp <= nowTimestamp + SHOP_TOKEN_EXPIRING_SOON_WINDOW_MS,
  );

  return isExpiringSoon ? 'expiring_soon' : 'connected';
}
