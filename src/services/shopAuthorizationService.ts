/**
 * Shop Authorization Service.
 * Manages OAuth 2.0 handoff, callback validation, token exchange outside DB transactions,
 * and atomic resolution of durable `PlatformConnection` records for Lazada and Shopify.
 */

import crypto from 'node:crypto';
import type {
  DbClient,
  SupportedShopPlatformCode,
  LazadaTokenResponse,
  ShopifyTokenResponse,
  OrganizationRoleCode,
} from '@/types';
import { prisma } from '@/lib/prisma';
import { canActorManageConnections } from './shopConnectionPermissionService';
import { appendShopConnectionAuditService } from './shopConnectionAuditService';
import type {
  LazadaIntegrationData,
  ShopifyIntegrationData,
} from './shopCredentialService';
import type { Prisma, PrismaClient } from '@prisma/client';

export type StartAuthorizationInput = {
  readonly platformCode: SupportedShopPlatformCode;
  readonly organizationId: number;
  readonly connectionId?: number;
  readonly shopDomain?: string;
  readonly idempotencyKey?: string;
};

export type StartAuthorizationResult = {
  readonly attemptId: number;
  readonly authorizationUrl: string;
  readonly expiresAt: string;
};

export type CompleteAuthorizationInput = {
  readonly platformCode: string;
  readonly code?: string;
  readonly state?: string;
  readonly error?: string;
  readonly errorDescription?: string;
  readonly shop?: string;
};

export type CompleteAuthorizationResult = {
  readonly success: boolean;
  readonly attemptId?: number;
  readonly connectionId?: number;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly error?: string;
};

function hashNonce(nonce: string): string {
  return crypto.createHash('sha256').update(nonce).digest('hex');
}

function resolveCallbackUrl(platform: string): string {
  const domain = process.env.NGROK_DOMAIN;
  if (domain) {
    return `https://${domain.replace(/^https?:\/\//, '')}/api/integrations/${platform}/callback`;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, '')}/api/integrations/${platform}/callback`;
  }
  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}/api/integrations/${platform}/callback`;
}

/**
 * Initiates an authorization attempt and builds the provider OAuth redirect URL.
 */
export async function startShopAuthorizationService(
  actor: { readonly id: number; readonly isAdmin: boolean },
  input: StartAuthorizationInput,
  tx: DbClient = prisma,
): Promise<StartAuthorizationResult> {
  // Resolve user organization role and check permissions
  let roleCode: OrganizationRoleCode | undefined = undefined;
  if (!actor.isAdmin) {
    const membership = await tx.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: actor.id,
        },
      },
      include: { role: true },
    });

    if (!membership || !membership.isActive) {
      throw new Error('Bạn không có quyền quản lý gian hàng trong tổ chức này.');
    }
    roleCode = membership.role.code as OrganizationRoleCode;
  }

  if (!canActorManageConnections(actor, roleCode)) {
    throw new Error('Bạn không có quyền thực hiện thao tác kết nối gian hàng.');
  }

  // Validate platform catalog
  const platform = await tx.platformCatalog.findUnique({
    where: { code: input.platformCode },
  });
  if (!platform || !platform.isActive) {
    throw new Error(`Nền tảng ${input.platformCode} không khả dụng.`);
  }

  // If reconnecting, validate existing connection
  if (input.connectionId) {
    const existing = await tx.platformConnection.findUnique({
      where: { id: input.connectionId },
    });
    if (!existing || existing.organizationId !== input.organizationId || existing.platformId !== platform.id) {
      throw new Error('Gian hàng cần kết nối lại không thuộc tổ chức hoặc nền tảng này.');
    }
  }

  // Idempotency check: reuse active attempt if existing
  if (input.idempotencyKey) {
    const existingAttempt = await tx.platformAuthorizationAttempt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingAttempt && existingAttempt.status === 'authorizing' && existingAttempt.expiresAt > new Date()) {
      return {
        attemptId: existingAttempt.id,
        authorizationUrl: existingAttempt.redirectUri || '',
        expiresAt: existingAttempt.expiresAt.toISOString(),
      };
    }
  }

  // Generate secure state nonce and expiry
  const nonce = crypto.randomBytes(24).toString('hex');
  const stateNonceHash = hashNonce(nonce);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL
  const callbackUrl = resolveCallbackUrl(input.platformCode);

  // Create attempt first to acquire its database ID
  const attempt = await tx.platformAuthorizationAttempt.create({
    data: {
      organizationId: input.organizationId,
      platformId: platform.id,
      connectionId: input.connectionId ?? null,
      actorUserId: actor.id,
      status: 'authorizing',
      idempotencyKey: input.idempotencyKey ?? null,
      stateNonceHash,
      expiresAt,
    },
  });

  const statePayload = `${attempt.id}:${nonce}`;
  let authorizationUrl = '';

  if (input.platformCode === 'lazada') {
    const appKey = process.env.LAZADA_APP_KEY;
    if (!appKey) {
      throw new Error('Hệ thống chưa được cấu hình LAZADA_APP_KEY.');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      force_auth: 'true',
      redirect_uri: callbackUrl,
      client_id: appKey,
      state: statePayload,
    });
    authorizationUrl = `https://auth.lazada.com/oauth/authorize?${params.toString()}`;
  } else if (input.platformCode === 'shopify') {
    const apiKey = process.env.SHOPIFY_API_KEY;
    if (!apiKey) {
      throw new Error('Hệ thống chưa được cấu hình SHOPIFY_API_KEY.');
    }
    const shopDomain = input.shopDomain || process.env.SHOPIFY_SHOP_NAME || 'omnicart-test-shop';
    const normalizedShop = shopDomain.includes('.') ? shopDomain : `${shopDomain}.myshopify.com`;
    const scopes = 'read_orders,write_orders,read_customers';
    const params = new URLSearchParams({
      client_id: apiKey,
      scope: scopes,
      redirect_uri: callbackUrl,
      state: statePayload,
      'grant_options[]': 'offline',
    });
    authorizationUrl = `https://${normalizedShop}/admin/oauth/authorize?${params.toString()}`;
  }

  // Persist the generated authorization URL on the attempt
  await tx.platformAuthorizationAttempt.update({
    where: { id: attempt.id },
    data: { redirectUri: authorizationUrl },
  });

  // Record initial authorization audit entry
  await appendShopConnectionAuditService(
    {
      authorizationAttemptId: attempt.id,
      connectionId: input.connectionId ?? null,
      actorUserId: actor.id,
      organizationIdAfter: input.organizationId,
      action: 'authorization.started',
      metadata: {
        platform: input.platformCode,
        isReconnect: Boolean(input.connectionId),
      },
    },
    tx,
  );

  return {
    attemptId: attempt.id,
    authorizationUrl,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Handles provider callback, exchanges authorization code for tokens outside DB transactions,
 * and atomically persists the connection state.
 */
export async function completeShopAuthorizationService(
  input: CompleteAuthorizationInput,
  tx: DbClient = prisma,
): Promise<CompleteAuthorizationResult> {
  if (!input.state) {
    return { success: false, status: 'failed', error: 'Missing state parameter from provider.' };
  }

  const [rawAttemptId, nonce] = input.state.split(':');
  const attemptId = parseInt(rawAttemptId || '', 10);
  if (!attemptId || !nonce) {
    return { success: false, status: 'failed', error: 'Invalid state parameter structure.' };
  }

  // Locate attempt
  const attempt = await tx.platformAuthorizationAttempt.findUnique({
    where: { id: attemptId },
    include: { platform: true },
  });

  if (!attempt) {
    return { success: false, status: 'failed', error: 'Authorization attempt not found.' };
  }

  // Idempotency: repeated callback returns existing completed outcome
  if (attempt.status === 'completed' && attempt.connectionId) {
    return {
      success: true,
      attemptId: attempt.id,
      connectionId: attempt.connectionId,
      status: 'completed',
    };
  }

  // Handle cancellation/error from provider
  if (input.error) {
    const failureReason = input.errorDescription || input.error;
    await tx.platformAuthorizationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: input.error === 'access_denied' ? 'cancelled' : 'failed',
        failureCode: input.error,
        failureReason,
        completedAt: new Date(),
      },
    });

    await appendShopConnectionAuditService(
      {
        authorizationAttemptId: attempt.id,
        connectionId: attempt.connectionId,
        actorUserId: attempt.actorUserId,
        action: 'authorization.failed',
        metadata: { failureCode: input.error, failureReason },
      },
      tx,
    );

    return {
      success: false,
      attemptId: attempt.id,
      status: input.error === 'access_denied' ? 'cancelled' : 'failed',
      error: failureReason,
    };
  }

  // Validate state nonce & expiration
  if (hashNonce(nonce) !== attempt.stateNonceHash) {
    return { success: false, attemptId: attempt.id, status: 'failed', error: 'State nonce mismatch.' };
  }

  if (attempt.expiresAt < new Date()) {
    await tx.platformAuthorizationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'failed',
        failureCode: 'EXPIRED',
        failureReason: 'Attempt has expired',
        completedAt: new Date(),
      },
    });
    return { success: false, attemptId: attempt.id, status: 'failed', error: 'Attempt has expired.' };
  }

  if (!input.code) {
    return { success: false, attemptId: attempt.id, status: 'failed', error: 'No authorization code provided.' };
  }

  // Update status to validating
  await tx.platformAuthorizationAttempt.update({
    where: { id: attempt.id },
    data: { status: 'validating' },
  });

  // Exchange code for tokens (EXTERNAL I/O - executed OUTSIDE database transaction)
  let externalShopId = '';
  let shopName = '';
  let tokenData: LazadaIntegrationData | ShopifyIntegrationData;

  try {
    if (attempt.platform.code === 'lazada') {
      const exchangeResult = await exchangeLazadaCode(input.code);
      externalShopId = exchangeResult.externalShopId;
      shopName = exchangeResult.shopName;
      tokenData = exchangeResult.tokenData;
    } else if (attempt.platform.code === 'shopify') {
      const exchangeResult = await exchangeShopifyCode(input.code, input.shop);
      externalShopId = exchangeResult.externalShopId;
      shopName = exchangeResult.shopName;
      tokenData = exchangeResult.tokenData;
    } else {
      throw new Error(`Unsupported platform: ${attempt.platform.code}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Token exchange failed';
    await tx.platformAuthorizationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'failed',
        failureCode: 'TOKEN_EXCHANGE_ERROR',
        failureReason: errorMsg,
        completedAt: new Date(),
      },
    });

    await appendShopConnectionAuditService(
      {
        authorizationAttemptId: attempt.id,
        connectionId: attempt.connectionId,
        actorUserId: attempt.actorUserId,
        action: 'authorization.failed',
        metadata: { failureCode: 'TOKEN_EXCHANGE_ERROR', errorMsg },
      },
      tx,
    );

    return { success: false, attemptId: attempt.id, status: 'failed', error: errorMsg };
  }

  // Atomically persist identity, state, and audit log
  let resolvedConnectionId = 0;

  const runTrx = async (fn: (trx: Prisma.TransactionClient) => Promise<void>) => {
    if ('$transaction' in tx && typeof (tx as { $transaction?: unknown }).$transaction === 'function') {
      return (tx as unknown as PrismaClient).$transaction(fn);
    }
    return fn(tx as Prisma.TransactionClient);
  };

  await runTrx(async (trx: Prisma.TransactionClient) => {
    // Check if globally unique record exists for this external shop identity
    const existing = await trx.platformConnection.findUnique({
      where: {
        platformId_externalShopId: {
          platformId: attempt.platformId,
          externalShopId,
        },
      },
    });

    const now = new Date();

    if (existing) {
      // Reactivate / update existing connection
      resolvedConnectionId = existing.id;
      await trx.platformConnection.update({
        where: { id: existing.id },
        data: {
          status: 'connected',
          integrations: tokenData as unknown as Prisma.InputJsonValue,
          shopName: shopName || existing.shopName,
          lastVerifiedAt: now,
          lastFailureCode: null,
          disconnectedAt: null,
          isActive: true,
          version: { increment: 1 },
        },
      });
    } else if (attempt.connectionId) {
      // Reconnecting an existing legacy connection that lacked externalShopId
      resolvedConnectionId = attempt.connectionId;
      await trx.platformConnection.update({
        where: { id: attempt.connectionId },
        data: {
          externalShopId,
          shopName: shopName || undefined,
          status: 'connected',
          integrations: tokenData as unknown as Prisma.InputJsonValue,
          lastVerifiedAt: now,
          lastFailureCode: null,
          disconnectedAt: null,
          isActive: true,
          version: { increment: 1 },
        },
      });
    } else {
      // New shop connection
      const created = await trx.platformConnection.create({
        data: {
          organizationId: attempt.organizationId,
          platformId: attempt.platformId,
          externalShopId,
          shopName,
          displayLabel: shopName,
          status: 'connected',
          integrations: tokenData as unknown as Prisma.InputJsonValue,
          lastVerifiedAt: now,
          isActive: true,
          version: 1,
        },
      });
      resolvedConnectionId = created.id;
    }

    // Mark attempt as completed
    await trx.platformAuthorizationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'completed',
        connectionId: resolvedConnectionId,
        completedAt: now,
      },
    });

    // Append connection audit
    await appendShopConnectionAuditService(
      {
        connectionId: resolvedConnectionId,
        authorizationAttemptId: attempt.id,
        actorUserId: attempt.actorUserId,
        organizationIdAfter: attempt.organizationId,
        action: 'connection.connected',
        fromStatus: existing?.status,
        toStatus: 'connected',
        metadata: {
          platform: attempt.platform.code,
          externalShopId,
        },
      },
      trx,
    );
  });

  return {
    success: true,
    attemptId: attempt.id,
    connectionId: resolvedConnectionId,
    status: 'completed',
  };
}

async function exchangeLazadaCode(code: string): Promise<{
  externalShopId: string;
  shopName: string;
  tokenData: LazadaIntegrationData;
}> {
  const appKey = process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_APP_SECRET;
  const baseUrl = process.env.LAZADA_API_BASE_URL ?? 'https://api.lazada.vn/rest';

  if (!appKey || !appSecret) {
    throw new Error('Thiếu cấu hình LAZADA_APP_KEY hoặc LAZADA_APP_SECRET.');
  }

  const { calculateLazadaSignature } = await import('./connectors/lazada/lazadaSigner');
  const params: Record<string, string> = {
    app_key: appKey,
    code,
    timestamp: Date.now().toString(),
    sign_method: 'sha256',
  };

  params.sign = calculateLazadaSignature('/auth/token/create', params, appSecret);
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth/token/create?${query}`, {
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error(`Lazada token exchange failed with status ${res.status}`);
  }

  const payload = (await res.json()) as LazadaTokenResponse;
  if (payload.code && payload.code !== '0') {
    throw new Error(`Lazada token exchange error: [${payload.code}] ${payload.message}`);
  }

  const countryInfo = payload.country_user_info?.[0];
  const sellerId = String(countryInfo?.seller_id || payload.account_id || '');
  const userId = String(countryInfo?.user_id || payload.account_platform_user_id || '');
  const country = countryInfo?.country || 'VN';

  if (!sellerId) {
    throw new Error('Không trích xuất được sellerId từ phản hồi Lazada.');
  }

  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('Không nhận được access_token hoặc refresh_token từ phản hồi Lazada.');
  }

  const now = Date.now();
  const expiresInMs = (payload.expires_in ?? 2592000) * 1000;
  const refreshExpiresInMs = (payload.refresh_expires_in ?? 15552000) * 1000;

  const tokenData: LazadaIntegrationData = {
    sellerId,
    userId,
    country,
    account: payload.account,
    shortCode: countryInfo?.short_code,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenExpiresAt: new Date(now + expiresInMs).toISOString(),
    refreshTokenExpiresAt: new Date(now + refreshExpiresInMs).toISOString(),
  };

  return {
    externalShopId: sellerId,
    shopName: payload.account || `Lazada Store (${sellerId})`,
    tokenData,
  };
}

async function exchangeShopifyCode(
  code: string,
  rawShop?: string,
): Promise<{
  externalShopId: string;
  shopName: string;
  tokenData: ShopifyIntegrationData;
}> {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const defaultShop = process.env.SHOPIFY_SHOP_NAME || 'omnicart-test-shop';
  const shop = rawShop || defaultShop;
  const shopDomain = shop.includes('.') ? shop : `${shop}.myshopify.com`;

  if (!apiKey || !apiSecret) {
    throw new Error('Thiếu cấu hình SHOPIFY_API_KEY hoặc SHOPIFY_API_SECRET.');
  }

  const url = `https://${shopDomain}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token exchange failed with status ${res.status}`);
  }

  const payload = (await res.json()) as ShopifyTokenResponse;
  if (!payload.access_token) {
    throw new Error('Phản hồi Shopify không chứa access_token.');
  }

  const tokenData: ShopifyIntegrationData = {
    shopDomain,
    accessToken: payload.access_token,
    scopes: payload.scope ? payload.scope.split(',') : ['read_orders', 'write_orders'],
  };

  return {
    externalShopId: shopDomain,
    shopName: shopDomain.replace('.myshopify.com', ''),
    tokenData,
  };
}
