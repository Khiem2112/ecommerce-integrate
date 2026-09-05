/**
 * Order Sync Service — Ingests authoritative orders from Channel Connectors into the internal database.
 * Supports idempotency, status transition history logging, persistent MySQL job state, and safe item reconciliation.
 */

import { prisma } from '@/lib/prisma';
import { Prisma, type OrderItem } from '@prisma/client';
import crypto from 'node:crypto';
import type {
  DbClient,
  FetchOrdersParams,
  SyncResult,
  SyncRecordError,
  SyncRunLog,
  IntegrationSummary,
  ExternalOrder,
  ExternalOrderItem,
  PreflightSyncResult,
} from '@/types';
import * as connectorFactory from './connectorFactory';

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
async function ensureMasterCatalogs(tx: DbClient): Promise<{
  readonly platformId: number;
  readonly defaultTierId: number;
  readonly statusMap: Map<string, number>;
}> {
  // Find or create platform catalog
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
 * Reconciles a single order item against the local database snapshot.
 * Creates a new item or updates changed authoritative fields.
 * Returns true if the database was modified (created or updated).
 */
async function reconcileSingleOrderItem(
  orderId: number,
  incoming: ExternalOrderItem,
  existing: OrderItem | undefined,
  tx: DbClient,
): Promise<boolean> {
  const targetQuantity = incoming.quantity ?? 1;
  const targetSku = incoming.sku ? incoming.sku.trim() : null;
  const calculatedDiscount = Math.max(0, (incoming.unitPrice ?? 0) - (incoming.paidPrice ?? 0));

  if (!existing) {
    // New line item added to existing order
    await tx.orderItem.create({
      data: {
        orderId,
        externalItemId: incoming.externalItemId,
        productId: incoming.externalItemId || 'UNKNOWN',
        sku: targetSku,
        productName: incoming.name ?? 'Sản phẩm Lazada',
        quantity: targetQuantity,
        unitPrice: incoming.unitPrice ?? 0,
        discount: calculatedDiscount,
        isActive: true,
      },
    });
    return true;
  }

  // Check for authoritative changes on existing item
  const isQuantityDiff = existing.quantity !== targetQuantity;
  const isPriceDiff = Math.abs(existing.unitPrice - incoming.unitPrice) > 0.01;
  const isDiscountDiff = Math.abs(existing.discount - calculatedDiscount) > 0.01;
  const isNameDiff = existing.productName !== incoming.name;
  const isSkuDiff = (existing.sku ?? '') !== (targetSku ?? '');
  const isReactivated = !existing.isActive;

  if (isQuantityDiff || isPriceDiff || isDiscountDiff || isNameDiff || isSkuDiff || isReactivated) {
    await tx.orderItem.update({
      where: { id: existing.id },
      data: {
        quantity: targetQuantity,
        unitPrice: incoming.unitPrice,
        discount: calculatedDiscount,
        productName: incoming.name,
        sku: targetSku,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    return true;
  }

  return false;
}

/**
 * Reconciles all items of an order, including additions, updates, and safe inactivation of disappeared items.
 * Returns true if any item was added, updated, or inactivated.
 */
async function reconcileOrderItems(
  orderId: number,
  incomingItems: readonly ExternalOrderItem[],
  existingItems: OrderItem[],
  isResponseComplete: boolean,
  itemsError: string | undefined,
  externalOrderId: string,
  tx: DbClient,
): Promise<boolean> {
  let itemsChanged = false;
  const existingItemMap = new Map<string, OrderItem>();

  for (const existing of existingItems) {
    if (existing.externalItemId) {
      existingItemMap.set(existing.externalItemId, existing);
    }
  }

  const incomingExternalItemIds = new Set<string>();

  for (const incoming of incomingItems) {
    incomingExternalItemIds.add(incoming.externalItemId);
    const existing = existingItemMap.get(incoming.externalItemId);
    const hasModified = await reconcileSingleOrderItem(orderId, incoming, existing, tx);
    if (hasModified) {
      itemsChanged = true;
    }
  }

  // Inactivate disappeared items only when response is confirmed complete and uncorrupted
  if (isResponseComplete) {
    for (const existing of existingItems) {
      if (existing.isActive && existing.externalItemId && !incomingExternalItemIds.has(existing.externalItemId)) {
        await tx.orderItem.update({
          where: { id: existing.id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });
        itemsChanged = true;
      }
    }
  } else if (itemsError) {
    throw new Error(`Dữ liệu sản phẩm của đơn hàng [${externalOrderId}] bị lỗi từ API: ${itemsError}`);
  }

  return itemsChanged;
}

/**
 * Reconciles a single external order and its items idempotently inside a short database transaction.
 * Uses (platformId, platformOrderId) for Order identity and (orderId, externalItemId) for OrderItem identity.
 */
async function reconcileSingleExternalOrder(
  externalOrder: ExternalOrder,
  platformId: number,
  defaultTierId: number,
  statusMap: Map<string, number>,
  tx: DbClient,
): Promise<{
  readonly outcome: 'created' | 'updated' | 'unchanged';
  readonly itemsProcessed: number;
}> {
  // Validate item external identity strictly without SKU fallback
  for (const item of externalOrder.items) {
    if (!item.externalItemId || item.externalItemId.trim() === '') {
      throw new Error(
        `Đơn hàng [${externalOrder.externalOrderId}] chứa dòng sản phẩm (${item.name || 'N/A'}) thiếu externalItemId hợp lệ.`,
      );
    }
  }

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
      items: true,
    },
  });

  if (!existingOrder) {
    // Create new order with authoritative fields and initial items
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
            externalItemId: item.externalItemId,
            productId: item.externalItemId || 'UNKNOWN',
            sku: item.sku ? item.sku.trim() : null,
            productName: item.name ?? 'Sản phẩm Lazada',
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            discount: Math.max(0, (item.unitPrice ?? 0) - (item.paidPrice ?? 0)),
            isActive: true,
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

    return { outcome: 'created', itemsProcessed: externalOrder.items.length };
  }

  // Reconcile existing order header
  const isStatusChanged = existingOrder.currentStatusId !== targetStatusId;
  const isValueDifferent =
    Math.abs(existingOrder.totalValue - externalOrder.totalAmount) > 0.01 ||
    Math.abs(existingOrder.shippingFee - externalOrder.shippingFee) > 0.01 ||
    Math.abs(existingOrder.discountAmount - externalOrder.voucherDiscount) > 0.01;

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
  }

  // Reconcile order items
  const isResponseComplete = externalOrder.itemsComplete !== false && !externalOrder.itemsError;
  const itemsChanged = await reconcileOrderItems(
    existingOrder.id,
    externalOrder.items,
    existingOrder.items,
    isResponseComplete,
    externalOrder.itemsError,
    externalOrder.externalOrderId,
    tx,
  );

  const outcome = isStatusChanged || isValueDifferent || itemsChanged ? 'updated' : 'unchanged';
  return { outcome, itemsProcessed: externalOrder.items.length };
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
 * Synchronizes a batch of orders from Lazada into the database with persistent job tracking.
 */
export async function syncOrdersFromLazadaService(
  params: FetchOrdersParams = {},
  tx: DbClient = prisma,
): Promise<SyncResult> {
  const syncId = `sync_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = new Date();
  const startTime = Date.now();

  const catalogs = await ensureMasterCatalogs(tx);

  // Initialize persistent SyncBatch record in MySQL
  const syncBatch = await tx.syncBatch.create({
    data: {
      batchCode: syncId,
      platformId: catalogs.platformId,
      operationType: 'apply',
      status: 'running',
      scope: (params as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      totalOrders: 0,
      startedAt,
    },
  });

  // Initialize persistent SyncOperation records
  const orderOperation = await tx.syncOperation.create({
    data: {
      batchId: syncBatch.id,
      entityType: 'order',
      status: 'running',
      startedAt,
    },
  });

  const orderItemOperation = await tx.syncOperation.create({
    data: {
      batchId: syncBatch.id,
      entityType: 'order_item',
      status: 'running',
      startedAt,
    },
  });

  const errors: SyncRecordError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;
  let itemsSuccessCount = 0;
  let itemsFailedCount = 0;

  try {
    // External network call executed strictly outside database transaction
    const connector = connectorFactory.getChannelConnector('lazada');
    
    // Fetch orders across pages in the requested date range (up to 200 orders per sync batch)
    let page = params.page ?? 1;
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
    const allOrders: ExternalOrder[] = [];
    const MAX_ORDERS_TO_SYNC = 200;

    while (allOrders.length < MAX_ORDERS_TO_SYNC) {
      const pageResult = await connector.fetchOrders({
        ...params,
        page,
        pageSize,
      });

      if (!pageResult.orders || pageResult.orders.length === 0) {
        break;
      }

      allOrders.push(...pageResult.orders);

      if (!pageResult.hasMore || allOrders.length >= pageResult.totalCount || pageResult.orders.length < pageSize) {
        break;
      }
      page++;
    }

    const totalOrders = allOrders.length;
    const totalItems = allOrders.reduce((acc, o) => acc + (o.items?.length ?? 0), 0);

    // Update batch and operation total expectations
    await tx.syncBatch.update({
      where: { id: syncBatch.id },
      data: { totalOrders },
    });

    await tx.syncOperation.update({
      where: { id: orderOperation.id },
      data: { totalCount: totalOrders },
    });

    await tx.syncOperation.update({
      where: { id: orderItemOperation.id },
      data: { totalCount: totalItems },
    });

    // Reconcile each external order within its own short transaction
    for (const order of allOrders) {
      try {
        const { outcome, itemsProcessed } = await runWithTx(tx, async (scopedTx) => {
          return reconcileSingleExternalOrder(
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

        itemsSuccessCount += itemsProcessed;
      } catch (err: unknown) {
        failedCount++;
        const itemCount = order.items?.length ?? 0;
        itemsFailedCount += itemCount;

        const message = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu đơn hàng';
        errors.push({
          externalOrderId: order.externalOrderId,
          message,
          entityType: 'order',
        });

        // Persist error audit record in MySQL
        await tx.syncRunError.create({
          data: {
            batchId: syncBatch.id,
            operationId: orderOperation.id,
            entityType: 'order',
            externalId: order.externalOrderId,
            errorMessage: message,
          },
        });
      }
    }

    const completedAt = new Date();
    const durationMs = Date.now() - startTime;

    const finalStatus: 'completed' | 'partial' | 'failed' =
      failedCount === 0
        ? 'completed'
        : createdCount + updatedCount + unchangedCount > 0
          ? 'partial'
          : 'failed';

    // Finalize SyncBatch in MySQL
    await tx.syncBatch.update({
      where: { id: syncBatch.id },
      data: {
        status: finalStatus,
        createdCount,
        updatedCount,
        unchangedCount,
        failedCount,
        completedAt,
        durationMs,
        errorMessage: failedCount > 0 ? errors.map((e) => `[${e.externalOrderId}] ${e.message}`).join('; ').slice(0, 1000) : null,
      },
    });

    // Finalize order SyncOperation in MySQL
    await tx.syncOperation.update({
      where: { id: orderOperation.id },
      data: {
        status: finalStatus,
        processedCount: totalOrders,
        successCount: createdCount + updatedCount + unchangedCount,
        failedCount,
        completedAt,
      },
    });

    // Finalize order_item SyncOperation in MySQL
    const itemOpStatus = itemsFailedCount === 0 ? 'completed' : itemsSuccessCount > 0 ? 'partial' : 'failed';
    await tx.syncOperation.update({
      where: { id: orderItemOperation.id },
      data: {
        status: itemOpStatus,
        processedCount: itemsSuccessCount + itemsFailedCount,
        successCount: itemsSuccessCount,
        failedCount: itemsFailedCount,
        completedAt,
      },
    });

    return {
      syncId,
      status: finalStatus,
      created: createdCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  } catch (err: unknown) {
    const completedAt = new Date();
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : 'Đồng bộ đơn hàng thất bại hoàn toàn.';

    errors.push({
      externalOrderId: 'GLOBAL',
      message,
      entityType: 'global',
    });

    // Record global error in MySQL
    await tx.syncRunError.create({
      data: {
        batchId: syncBatch.id,
        operationId: orderOperation.id,
        entityType: 'global',
        externalId: 'GLOBAL',
        errorMessage: message,
      },
    });

    await tx.syncBatch.update({
      where: { id: syncBatch.id },
      data: {
        status: 'failed',
        failedCount: 1,
        completedAt,
        durationMs,
        errorMessage: message,
      },
    });

    await tx.syncOperation.update({
      where: { id: orderOperation.id },
      data: {
        status: 'failed',
        failedCount: 1,
        completedAt,
        errorMessage: message,
      },
    });

    await tx.syncOperation.update({
      where: { id: orderItemOperation.id },
      data: {
        status: 'failed',
        failedCount: 1,
        completedAt,
        errorMessage: message,
      },
    });

    return {
      syncId,
      status: 'failed',
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 1,
      errors,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
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
    const result = await reconcileSingleExternalOrder(
      externalOrder,
      catalogs.platformId,
      catalogs.defaultTierId,
      catalogs.statusMap,
      scopedTx,
    );
    return result.outcome;
  });

  return { outcome, order: externalOrder };
}

/**
 * Phase 1.25 Preflight: Quick non-mutating probe by date range and filters.
 * Calls /orders/get with limit=1 to discover estimated total orders count without persisting DB records.
 */
export async function preflightLazadaSyncService(
  params: FetchOrdersParams = {},
): Promise<PreflightSyncResult> {
  const connector = connectorFactory.getChannelConnector('lazada');
  const result = await connector.fetchOrders({
    ...params,
    page: 1,
    pageSize: 1,
  });

  return {
    totalCount: result.totalCount,
    dateRange: {
      from: params.createdAfter ? new Date(params.createdAfter).toISOString() : undefined,
      to: params.createdBefore ? new Date(params.createdBefore).toISOString() : undefined,
    },
    status: params.status,
  };
}

/**
 * Retrieve summary data for platform integration cards and status overview directly from MySQL.
 */
export async function getIntegrationSummaryService(
  platform: string = 'lazada',
  tx: DbClient = prisma,
): Promise<IntegrationSummary> {
  const connector = connectorFactory.getChannelConnector(platform);

  // Probe health
  const health = await connector.getConnectionHealth();

  // Find platform catalog record in MySQL
  const platformRecord = await tx.platformCatalog.findUnique({
    where: { code: platform },
  });

  let totalOrders = 0;
  let lastSyncedAt: string | undefined = undefined;
  let failedRecords = 0;

  if (platformRecord) {
    totalOrders = await tx.order.count({
      where: { platformId: platformRecord.id, isActive: true },
    });

    try {
      // Query most recent completed or partial sync batch from MySQL
      const latestBatch = await tx.syncBatch.findFirst({
        where: {
          platformId: platformRecord.id,
          status: { in: ['completed', 'partial'] },
        },
        orderBy: { completedAt: 'desc' },
      });

      if (latestBatch?.completedAt) {
        lastSyncedAt = latestBatch.completedAt.toISOString();
      }

      // Query most recent sync batch to get failed records count
      const recentBatch = await tx.syncBatch.findFirst({
        where: { platformId: platformRecord.id },
        orderBy: { createdAt: 'desc' },
      });

      if (recentBatch && recentBatch.status !== 'completed') {
        failedRecords = recentBatch.failedCount;
      }
    } catch {
      // Fallback cleanly if syncBatch table has no records or during migration
      lastSyncedAt = undefined;
      failedRecords = 0;
    }
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
    lastSyncedAt,
    totalOrders,
    failedRecords,
    errorMessage: health.message,
  };
}

/**
 * Retrieve recent sync logs history directly from MySQL SyncBatch table.
 */
export async function getSyncLogsHistoryService(
  tx: DbClient = prisma,
): Promise<readonly SyncRunLog[]> {
  try {
    const batches = await tx.syncBatch.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        platform: true,
        errors: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return batches.map((batch) => ({
      syncId: batch.batchCode,
      platform: (batch.platform?.code ?? 'lazada') as 'lazada' | 'shopify' | 'tiktok_shop',
      status: batch.status as 'completed' | 'partial' | 'failed',
      created: batch.createdCount,
      updated: batch.updatedCount,
      unchanged: batch.unchangedCount,
      failed: batch.failedCount,
      errors: batch.errors.map((err) => ({
        externalOrderId: err.externalId ?? 'GLOBAL',
        message: err.errorMessage,
        entityType: (err.entityType as 'order' | 'order_item' | 'global') ?? undefined,
        errorCode: err.errorCode ?? undefined,
      })),
      startedAt: batch.startedAt.toISOString(),
      completedAt: (batch.completedAt ?? batch.startedAt).toISOString(),
      durationMs: batch.durationMs ?? 0,
    }));
  } catch {
    return [];
  }
}
