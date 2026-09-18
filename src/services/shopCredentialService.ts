/**
 * Shop Credential Segregation Service.
 * Encapsulates read, write, and token refresh lifecycle for dynamic per-shop credentials.
 * Stores tokens exclusively in `PlatformConnection.integrations` (JSON column).
 * NEVER returns raw credentials to client DTOs, API responses, or audit logs.
 */

import type { DbClient } from '@/types';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type LazadaIntegrationData = {
  readonly sellerId: string;
  readonly userId: string;
  readonly country: string;
  readonly shortCode?: string;
  readonly account?: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenExpiresAt: string; // ISO 8601
  readonly refreshTokenExpiresAt: string; // ISO 8601
  readonly customAppKey?: string;
  readonly customAppSecret?: string;
};

export type ShopifyIntegrationData = {
  readonly shopDomain: string; // "{shop}.myshopify.com"
  readonly accessToken: string;
  readonly scopes: readonly string[];
  readonly tokenExpiresAt?: string;
  readonly refreshToken?: string;
  readonly customAppKey?: string;
  readonly customAppSecret?: string;
};

export type PlatformIntegrationData = LazadaIntegrationData | ShopifyIntegrationData;

// In-memory mutex locks to prevent race conditions during refresh token rotation per connection
const connectionRefreshLocks = new Map<number, Promise<PlatformIntegrationData>>();

/**
 * Retrieves per-shop integration credentials for internal connector execution.
 * Internal use only. Never expose to client.
 */
export async function getShopCredentialsService(
  connectionId: number,
  tx: DbClient = prisma,
): Promise<PlatformIntegrationData | null> {
  const connection = await tx.platformConnection.findUnique({
    where: { id: connectionId },
    select: { integrations: true },
  });

  if (!connection?.integrations) {
    return null;
  }

  return connection.integrations as unknown as PlatformIntegrationData;
}

/**
 * Persists updated dynamic tokens to `PlatformConnection.integrations`.
 */
export async function setShopCredentialsService(
  connectionId: number,
  data: PlatformIntegrationData,
  tx: DbClient = prisma,
): Promise<void> {
  await tx.platformConnection.update({
    where: { id: connectionId },
    data: {
      integrations: data as unknown as Prisma.InputJsonValue,
      lastVerifiedAt: new Date(),
      lastFailureCode: null,
    },
  });
}

/**
 * Evaluates whether an access token is expired or within the safety buffer window.
 * Default safety buffer is 300 seconds (5 minutes).
 */
export function isTokenExpired(
  data: PlatformIntegrationData,
  bufferSeconds = 300,
): boolean {
  if (!('tokenExpiresAt' in data) || !data.tokenExpiresAt) {
    return false; // Offline token with no explicit expiration
  }

  const expiresAt = new Date(data.tokenExpiresAt).getTime();
  const now = Date.now();
  return expiresAt - now <= bufferSeconds * 1000;
}

/**
 * Refreshes credentials for a connection if needed, protected by a per-connection mutex lock.
 */
export async function refreshShopTokenIfNeededService(
  connectionId: number,
  tx: DbClient = prisma,
): Promise<PlatformIntegrationData> {
  // Check if a refresh is already in flight for this connection
  const activeRefresh = connectionRefreshLocks.get(connectionId);
  if (activeRefresh) {
    return activeRefresh;
  }

  const credentials = await getShopCredentialsService(connectionId, tx);
  if (!credentials) {
    throw new Error(`Không tìm thấy chứng thực của kết nối gian hàng (ID: ${connectionId}).`);
  }

  if (!isTokenExpired(credentials)) {
    return credentials;
  }

  // Acquire lock
  const refreshPromise = (async () => {
    try {
      const refreshed = await executeTokenRefresh(credentials);
      await setShopCredentialsService(connectionId, refreshed, tx);
      return refreshed;
    } finally {
      connectionRefreshLocks.delete(connectionId);
    }
  })();

  connectionRefreshLocks.set(connectionId, refreshPromise);
  return refreshPromise;
}

/**
 * Dispatches provider-specific token refresh.
 */
async function executeTokenRefresh(
  data: PlatformIntegrationData,
): Promise<PlatformIntegrationData> {
  if ('sellerId' in data) {
    // Lazada token refresh
    return refreshLazadaToken(data);
  }

  if ('shopDomain' in data) {
    // Shopify token refresh
    return refreshShopifyToken(data);
  }

  throw new Error('Nền tảng chứng thực không xác định');
}

async function refreshLazadaToken(
  data: LazadaIntegrationData,
): Promise<LazadaIntegrationData> {
  const appKey = data.customAppKey ?? process.env.LAZADA_APP_KEY;
  const appSecret = data.customAppSecret ?? process.env.LAZADA_APP_SECRET;
  const baseUrl = process.env.LAZADA_API_BASE_URL ?? 'https://api.lazada.vn/rest';

  if (!appKey || !appSecret) {
    throw new Error('Thiếu cấu hình LAZADA_APP_KEY hoặc LAZADA_APP_SECRET trên server.');
  }

  // Dynamically sign and call Lazada refresh endpoint
  const { calculateLazadaSignature } = await import('./connectors/lazada/lazadaSigner');
  const params: Record<string, string> = {
    app_key: appKey,
    refresh_token: data.refreshToken,
    timestamp: Date.now().toString(),
    sign_method: 'sha256',
  };

  params.sign = calculateLazadaSignature('/auth/token/refresh', params, appSecret);

  const query = new URLSearchParams(params).toString();
  const url = `${baseUrl.replace(/\/+$/, '')}/auth/token/refresh?${query}`;

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Lazada token refresh failed with status ${res.status}`);
  }

  const payload = (await res.json()) as {
    code?: string;
    message?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_expires_in?: number;
  };

  if (payload.code && payload.code !== '0') {
    throw new Error(`Lazada token refresh error: [${payload.code}] ${payload.message}`);
  }

  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('Lazada refresh response missing tokens');
  }

  const now = Date.now();
  const expiresInMs = (payload.expires_in ?? 2592000) * 1000;
  const refreshExpiresInMs = (payload.refresh_expires_in ?? 15552000) * 1000;

  return {
    ...data,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenExpiresAt: new Date(now + expiresInMs).toISOString(),
    refreshTokenExpiresAt: new Date(now + refreshExpiresInMs).toISOString(),
  };
}

async function refreshShopifyToken(
  data: ShopifyIntegrationData,
): Promise<ShopifyIntegrationData> {
  if (!data.refreshToken) {
    // Permanent offline token, does not need refresh
    return data;
  }

  const clientId = data.customAppKey ?? process.env.SHOPIFY_API_KEY;
  const clientSecret = data.customAppSecret ?? process.env.SHOPIFY_API_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Thiếu cấu hình SHOPIFY_API_KEY hoặc SHOPIFY_API_SECRET trên server.');
  }

  const url = `https://${data.shopDomain}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: data.refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token refresh failed with status ${res.status}`);
  }

  const payload = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!payload.access_token) {
    throw new Error('Shopify refresh response missing access token');
  }

  const now = Date.now();
  const expiresInMs = (payload.expires_in ?? 3600) * 1000;

  return {
    ...data,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? data.refreshToken,
    tokenExpiresAt: new Date(now + expiresInMs).toISOString(),
    scopes: payload.scope ? payload.scope.split(',') : data.scopes,
  };
}
