/**
 * Order Sync Service — Ingests authoritative orders from Channel Connectors into the internal database.
 * Supports idempotency, status transition history logging, and atomic transaction execution.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import type {
  DbClient,
  FetchOrdersParams,
  SyncResult,
  SyncRecordError,
  SyncRunLog,
  IntegrationSummary,
  ExternalOrder,
} from '@/types';
import * as connectorFactory from './connectorFactory';

const syncLogsHistory: SyncRunLog[] = [];
let lastSyncTimestamp: string | null = null;
let lastKnownHealth: {
  status: 'connected' | 'expired' | 'error' | 'disconnected';
  latencyMs: number;
  lastCheckedAt: string;
} | null = null;

/**
 * Normalizes external status code from marketplace to internal OrderStatus code.
 */
function normalizeLazadaStatus(externalStatus: string): string {
  const s = externalStatus.toLowerCase().trim();
  switch (s) {
    case 'unpaid':
    case 'pending':
      return 'unpaid';
    case 'ready_to_ship':
    case 'paid':
      return 'paid';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'canceled':
    case 'cancelled':
    case 'failed':
      return 'cancelled';
    case 'returned':
      return 'returned';
    case 'refunded':
      return 'refunded';
    default:
      return 'unpaid';
  }
}

/**
 * Ensures platform, statuses, and default VIP tier exist in database.
 */
async function ensureMasterCatalogs(tx: DbClient) {
  // Platform
  let platform = await tx.platformCatalog.findUnique({
    where: { code: 'lazada' },
  });
  if (!platform) {
    platform = await tx.platformCatalog.create({
      data: {
        code: 'lazada',
        name: 'Lazada',
        isActive: true,
      },
    });
  }

  // Default VIP Tier
  let defaultTier = await tx.vipTierCatalog.findUnique({
    where: { code: 'standard' },
  });
  if (!defaultTier) {
    defaultTier = await tx.vipTierCatalog.create({
      data: {
        code: 'standard',
        name: 'Standard',
        minScore: 0,
        maxScore: 40,
        priority: 0,
        isActive: true,
      },
    });
  }

  // Ensure default order statuses
  const statusCodes = ['unpaid', 'paid', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
  const statusRecords = await tx.orderStatus.findMany();
  const statusMap = new Map<string, number>();

  for (const record of statusRecords) {
    statusMap.set(record.code, record.id);
  }

  for (const code of statusCodes) {
    if (!statusMap.has(code)) {
      const created = await tx.orderStatus.create({
        data: {
          code,
          name: code.charAt(0).toUpperCase() + code.slice(1),
          isActive: true,
        },
      });
      if (created?.id) {
        statusMap.set(code, created.id);
      }
    }
  }

  return {
    platformId: platform.id,
    defaultTierId: defaultTier.id,
    statusMap,
  };
}

/**
 * Upserts a single external order and its buyer/items atomically.
 */
async function upsertSingleExternalOrder(
  externalOrder: ExternalOrder,
  platformId: number,
  defaultTierId: number,
  statusMap: Map<string, number>,
  tx: DbClient,
): Promise<'created' | 'updated' | 'unchanged'> {
  const buyerIdStr = externalOrder.buyer.externalBuyerId;

  // Find or create customer
  let customer = await tx.customer.findUnique({
    where: {
      platformId_platformBuyerId: {
        platformId,
        platformBuyerId: buyerIdStr,
      },
    },
  });

  if (!customer) {
    customer = await tx.customer.create({
      data: {
        platformId,
        platformBuyerId: buyerIdStr,
        vipTierId: defaultTierId,
        vipScore: 20,
        consentStatus: 'granted',
      },
    });
  }

  const targetStatusCode = normalizeLazadaStatus(externalOrder.status);
  const targetStatusId = statusMap.get(targetStatusCode) ?? statusMap.get('unpaid') ?? 1;

  // Check existing order
  const existingOrder = await tx.order.findUnique({
    where: {
      platformId_platformOrderId: {
        platformId,
        platformOrderId: externalOrder.externalOrderId,
      },
    },
    include: {
      items: { where: { isActive: true } },
    },
  });

  if (!existingOrder) {
    // Create new order
    await tx.order.create({
      data: {
        platformId,
        platformOrderId: externalOrder.externalOrderId,
        customerId: customer.id,
        currentStatusId: targetStatusId,
        totalValue: externalOrder.totalAmount,
        shippingFee: externalOrder.shippingFee,
        discountAmount: externalOrder.voucherDiscount,
        currency: 'VND',
        createdAt: externalOrder.createdAt,
        updatedAt: externalOrder.updatedAt,
        items: {
          create: externalOrder.items.map((item) => ({
            productId: item.externalItemId ?? item.sku ?? 'UNKNOWN',
            sku: item.sku ?? null,
            productName: item.name ?? 'Sản phẩm Lazada',
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            discount: (item.unitPrice ?? 0) - (item.paidPrice ?? 0),
          })),
        },
        statusHistory: {
          create: {
            statusId: targetStatusId,
            changedBy: 'lazada_sync',
            note: `Đồng bộ đơn hàng từ Lazada (Trạng thái gốc: ${externalOrder.status})`,
          },
        },
      },
    });

    return 'created';
  }

  // Order exists: Check if status or details changed
  const isStatusChanged = existingOrder.currentStatusId !== targetStatusId;
  const isValueDifferent = Math.abs(existingOrder.totalValue - externalOrder.totalAmount) > 0.01;

  if (isStatusChanged || isValueDifferent) {
    // Update existing order
    await tx.order.update({
      where: { id: existingOrder.id },
      data: {
        currentStatusId: targetStatusId,
        totalValue: externalOrder.totalAmount,
        shippingFee: externalOrder.shippingFee,
        discountAmount: externalOrder.voucherDiscount,
        updatedAt: new Date(),
        ...(isStatusChanged
          ? {
            statusHistory: {
              create: {
                statusId: targetStatusId,
                changedBy: 'lazada_sync',
                note: `Cập nhật trạng thái từ Lazada: ${externalOrder.status}`,
              },
            },
          }
          : {}),
      },
    });

    return 'updated';
  }

  return 'unchanged';
}

/**
 * Executes a callback inside an atomic transaction when a full Prisma client is provided,
 * or runs directly on the scoped transaction client.
 */
async function runWithTx<T>(
  client: DbClient,
  fn: (txClient: DbClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in client && typeof client.$transaction === 'function') {
    return await (client as typeof prisma).$transaction(fn);
  }
  return await fn(client);
}

/**
 * Synchronize batch of orders from Lazada into database.
 */
export async function syncOrdersFromLazadaService(
  params: FetchOrdersParams = {},
  tx: DbClient = prisma,
): Promise<SyncResult> {
  const syncId = `sync_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  const connector = connectorFactory.getChannelConnector('lazada');
  const errors: SyncRecordError[] = [];

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  try {
    // External network call (executed outside database transaction)
    const pageResult = await connector.fetchOrders({
      ...params,
      pageSize: params.pageSize ?? 50,
    });

    const catalogs = await ensureMasterCatalogs(tx);

    for (const order of pageResult.orders) {
      try {
        const outcome = await runWithTx(tx, async (scopedTx) => {
          return upsertSingleExternalOrder(
            order,
            catalogs.platformId,
            catalogs.defaultTierId,
            catalogs.statusMap,
            scopedTx,
          );
        });

        if (outcome === 'created') createdCount++;
        else if (outcome === 'updated') updatedCount++;
        else unchangedCount++;
      } catch (err: unknown) {
        failedCount++;
        const message = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu đơn';
        errors.push({
          externalOrderId: order.externalOrderId,
          message,
        });
      }
    }

    const completedAt = new Date().toISOString();
    lastSyncTimestamp = completedAt;

    const finalStatus: 'completed' | 'partial' | 'failed' =
      failedCount === 0 ? 'completed' : createdCount + updatedCount + unchangedCount > 0 ? 'partial' : 'failed';

    const syncResult: SyncResult = {
      syncId,
      status: finalStatus,
      created: createdCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
      startedAt,
      completedAt,
    };

    // Keep log in memory history
    syncLogsHistory.unshift({
      syncId,
      platform: 'lazada',
      status: finalStatus,
      created: createdCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      failed: failedCount,
      errors,
      startedAt,
      completedAt,
      durationMs: Date.now() - startTime,
    });

    if (syncLogsHistory.length > 50) {
      syncLogsHistory.pop();
    }

    return syncResult;
  } catch (err: unknown) {
    const completedAt = new Date().toISOString();
    const message = err instanceof Error ? err.message : 'Đồng bộ đơn hàng thất bại';

    errors.push({
      externalOrderId: 'GLOBAL',
      message,
    });

    const syncResult: SyncResult = {
      syncId,
      status: 'failed',
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 1,
      errors,
      startedAt,
      completedAt,
    };

    syncLogsHistory.unshift({
      syncId,
      platform: 'lazada',
      status: 'failed',
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 1,
      errors,
      startedAt,
      completedAt,
      durationMs: Date.now() - startTime,
    });

    return syncResult;
  }
}

/**
 * Fetch and refresh a single order from Lazada by external ID.
 */
export async function refreshOrderFromLazadaService(
  externalOrderId: string,
  tx: DbClient = prisma,
): Promise<{ readonly outcome: 'created' | 'updated' | 'unchanged'; readonly order: ExternalOrder }> {
  const connector = connectorFactory.getChannelConnector('lazada');
  // Network call executed outside database transaction
  const externalOrder = await connector.fetchOrderDetail(externalOrderId);

  // Database operations executed inside isolated database transaction
  const outcome = await runWithTx(tx, async (scopedTx) => {
    const catalogs = await ensureMasterCatalogs(scopedTx);
    return upsertSingleExternalOrder(
      externalOrder,
      catalogs.platformId,
      catalogs.defaultTierId,
      catalogs.statusMap,
      scopedTx,
    );
  });

  return { outcome, order: externalOrder };
}

/**
 * Retrieve summary data for platform integration cards and status overview.
 */
export async function getIntegrationSummaryService(
  platform: string = 'lazada',
  tx: DbClient = prisma,
): Promise<IntegrationSummary> {
  const connector = connectorFactory.getChannelConnector(platform);

  // Probe health
  const health = await connector.getConnectionHealth();
  lastKnownHealth = {
    status: health.status,
    latencyMs: health.latencyMs,
    lastCheckedAt: health.lastCheckedAt.toISOString(),
  };

  // Compute total orders stored for platform
  const platformRecord = await tx.platformCatalog.findUnique({
    where: { code: platform },
  });

  let totalOrders = 0;
  if (platformRecord) {
    totalOrders = await tx.order.count({
      where: { platformId: platformRecord.id, isActive: true },
    });
  }

  const isMock = !process.env.LAZADA_APP_SECRET || Boolean(process.env.LAZADA_API_BASE_URL?.includes('localhost'));
  const environment: 'mock' | 'sandbox' | 'production' = isMock ? 'mock' : 'production';

  return {
    platform: platform as 'lazada' | 'shopify' | 'tiktok_shop',
    environment,
    status: health.status,
    shopName: 'Lazada Mall Official Store',
    latencyMs: health.latencyMs,
    lastCheckedAt: health.lastCheckedAt.toISOString(),
    lastSyncedAt: lastSyncTimestamp ?? undefined,
    totalOrders,
    failedRecords: syncLogsHistory.find((s) => s.platform === platform && s.status !== 'completed')?.failed ?? 0,
    errorMessage: health.message,
  };
}

/**
 * Retrieve recent sync logs for history table.
 */
export function getSyncLogsHistoryService(): readonly SyncRunLog[] {
  return syncLogsHistory;
}
