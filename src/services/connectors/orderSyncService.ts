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
  OrderPreviewPage,
  OrderPreviewRow,
  OrderPreviewItemRow,
  PendingSyncChange,
  FieldDiff,
} from '@/types';

import { MAX_ORDERS_TO_SYNC } from '@/constants';
import * as connectorFactory from './connectorFactory';
import { ensurePlatformConnectionService } from '@/services/platformConnectionService';
import {
  computeOrderHeaderDiff,
  computeOrderItemDiff,
  bulkCreateSyncChanges,
  buildOrderCreatedSnapshot,
  buildOrderItemCreatedSnapshot,
} from './syncChangeService';

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
  readonly connectionId: number;
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

  const connection = await ensurePlatformConnectionService(platform.id, tx);

  return {
    platformId: platform.id,
    connectionId: connection.id,
    defaultTierId: defaultTier.id,
    statusMap,
  };
}

type ItemReconcileResult = {
  readonly modified: boolean;
  readonly changeType: 'created' | 'updated' | 'unchanged';
  readonly diff: Record<string, FieldDiff> | null;
  readonly internalId: number | null;
};

/**
 * Reconciles a single order item against the local database snapshot.
 * Creates a new item or updates changed authoritative fields.
 * Returns modification status along with field-level diff for SyncChange audit.
 */
async function reconcileSingleOrderItem(
  orderId: number,
  incoming: ExternalOrderItem,
  existing: OrderItem | undefined,
  tx: DbClient,
): Promise<ItemReconcileResult> {
  const targetQuantity = incoming.quantity ?? 1;
  const targetSku = incoming.sku ? incoming.sku.trim() : null;
  const calculatedDiscount = Math.max(0, (incoming.unitPrice ?? 0) - (incoming.paidPrice ?? 0));

  if (!existing) {
    // New line item — all fields are new, record as created
    const created = await tx.orderItem.create({
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
    return {
      modified: true,
      changeType: 'created',
      diff: buildOrderItemCreatedSnapshot(incoming),
      internalId: created.id,
    };
  }

  // Compute field-level diff for existing item
  const diff = computeOrderItemDiff(existing, incoming);

  if (diff) {
    await tx.orderItem.update({
      where: { id: existing.id },
      data: {
        quantity: targetQuantity,
        unitPrice: incoming.unitPrice,
        discount: calculatedDiscount,
        productName: incoming.name,
        sku: targetSku,
        isActive: true,
      },
    });
    return { modified: true, changeType: 'updated', diff, internalId: existing.id };
  }

  return { modified: false, changeType: 'unchanged', diff: null, internalId: existing.id };
}

/**
 * Reconciles all items of an order, including additions, updates, and safe inactivation of disappeared items.
 * Returns whether items changed and collects PendingSyncChange entries for audit.
 */
async function reconcileOrderItems(
  orderId: number,
  incomingItems: readonly ExternalOrderItem[],
  existingItems: OrderItem[],
  isResponseComplete: boolean,
  itemsError: string | undefined,
  externalOrderId: string,
  tx: DbClient,
): Promise<{ readonly itemsChanged: boolean; readonly itemPendingChanges: PendingSyncChange[] }> {
  const itemPendingChanges: PendingSyncChange[] = [];
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
    const result = await reconcileSingleOrderItem(orderId, incoming, existing, tx);

    if (result.modified) {
      itemsChanged = true;
      itemPendingChanges.push({
        entityType: 'order_item',
        changeType: result.changeType as 'created' | 'updated',
        entityId: incoming.externalItemId,
        internalId: result.internalId,
        parentEntityId: externalOrderId,
        changes: result.diff,
      });
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
          },
        });
        itemsChanged = true;
        itemPendingChanges.push({
          entityType: 'order_item',
          changeType: 'inactivated',
          entityId: existing.externalItemId,
          internalId: existing.id,
          parentEntityId: externalOrderId,
          changes: { isActive: { before: true, after: false } },
        });
      }
    }
  } else if (itemsError) {
    throw new Error(`Dữ liệu sản phẩm của đơn hàng [${externalOrderId}] bị lỗi từ API: ${itemsError}`);
  }

  return { itemsChanged, itemPendingChanges };
}

type ReconcileResult = {
  readonly outcome: 'created' | 'updated' | 'unchanged';
  readonly itemsProcessed: number;
  readonly pendingChanges: readonly PendingSyncChange[];
  readonly orderId: number;
};

/**
 * Reconciles a single external order and its items idempotently inside a short database transaction.
 * Uses (connectionId, platformOrderId) for Order identity and (orderId, externalItemId) for OrderItem identity.
 * Returns field-level pending changes for SyncChange audit recording.
 */
async function reconcileSingleExternalOrder(
  externalOrder: ExternalOrder,
  platformId: number,
  connectionId: number,
  defaultTierId: number,
  statusMap: Map<string, number>,
  tx: DbClient,
): Promise<ReconcileResult> {
  // Validate item external identity strictly without SKU fallback
  for (const item of externalOrder.items) {
    if (!item.externalItemId || item.externalItemId.trim() === '') {
      throw new Error(
        `Đơn hàng [${externalOrder.externalOrderId}] chứa dòng sản phẩm (${item.name || 'N/A'}) thiếu externalItemId hợp lệ.`,
      );
    }
  }

  const pendingChanges: PendingSyncChange[] = [];
  const buyerIdStr = externalOrder.buyer.externalBuyerId;

  // Find or create customer
  let customer = await tx.customer.findUnique({
    where: {
      connectionId_platformBuyerId: {
        connectionId,
        platformBuyerId: buyerIdStr,
      },
    },
  });

  if (!customer) {
    customer = await tx.customer.create({
      data: {
        connectionId,
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
      connectionId_platformOrderId: {
        connectionId,
        platformOrderId: externalOrder.externalOrderId,
      },
    },
    include: {
      items: {
        where: { isActive: true },
      },
    },
  });

  if (!existingOrder) {
    // Create new order with authoritative fields and initial items
    const newOrder = await tx.order.create({
      data: {
        connectionId,
        platformOrderId: externalOrder.externalOrderId,
        customerId: customer.id,
        currentStatusId: targetStatusId,
        totalValue: externalOrder.totalAmount,
        shippingFee: externalOrder.shippingFee,
        discountAmount: externalOrder.voucherDiscount,
        currency: 'VND',
        createdAt: externalOrder.createdAt,
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
      include: { items: true },
    });

    // Record order creation as SyncChange
    pendingChanges.push({
      entityType: 'order',
      changeType: 'created',
      entityId: externalOrder.externalOrderId,
      internalId: newOrder.id,
      parentEntityId: null,
      changes: buildOrderCreatedSnapshot(externalOrder, targetStatusId, statusMap),
    });

    // Record each created item as SyncChange
    for (const createdItem of newOrder.items ?? []) {
      const incomingItem = externalOrder.items.find(
        (it) => it.externalItemId === createdItem.externalItemId,
      );
      pendingChanges.push({
        entityType: 'order_item',
        changeType: 'created',
        entityId: createdItem.externalItemId ?? createdItem.productId,
        internalId: createdItem.id,
        parentEntityId: externalOrder.externalOrderId,
        changes: incomingItem ? buildOrderItemCreatedSnapshot(incomingItem) : null,
      });
    }

    return { outcome: 'created', itemsProcessed: externalOrder.items.length, pendingChanges, orderId: newOrder.id };
  }

  // Compute order header diff before persisting
  const orderHeaderDiff = computeOrderHeaderDiff(existingOrder, externalOrder, targetStatusId, statusMap);
  const isStatusChanged = existingOrder.currentStatusId !== targetStatusId;

  if (orderHeaderDiff) {
    await tx.order.update({
      where: { id: existingOrder.id },
      data: {
        currentStatusId: targetStatusId,
        totalValue: externalOrder.totalAmount,
        shippingFee: externalOrder.shippingFee,
        discountAmount: externalOrder.voucherDiscount,
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

    pendingChanges.push({
      entityType: 'order',
      changeType: 'updated',
      entityId: externalOrder.externalOrderId,
      internalId: existingOrder.id,
      parentEntityId: null,
      changes: orderHeaderDiff,
    });
  }

  // Reconcile order items with diff tracking
  const isResponseComplete = externalOrder.itemsComplete !== false && !externalOrder.itemsError;
  const { itemsChanged, itemPendingChanges } = await reconcileOrderItems(
    existingOrder.id,
    externalOrder.items,
    existingOrder.items,
    isResponseComplete,
    externalOrder.itemsError,
    externalOrder.externalOrderId,
    tx,
  );

  pendingChanges.push(...itemPendingChanges);

  const outcome = orderHeaderDiff || itemsChanged ? 'updated' : 'unchanged';
  return { outcome, itemsProcessed: externalOrder.items.length, pendingChanges, orderId: existingOrder.id };
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
      connectionId: catalogs.connectionId,
      operationType: 'apply',
      status: 'running',
      scope: (params as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      totalOrders: 0,
      startedAt,
    },
  });

  // Initialize root order SyncOperation (parentEntityType = null)
  const orderOperation = await tx.syncOperation.create({
    data: {
      batchId: syncBatch.id,
      entityType: 'order',
      parentEntityType: null,
      parentEntityId: null,
      status: 'running',
      startedAt,
    },
  });

  const errors: SyncRecordError[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  // Track per-order item operations for SyncChange grouping
  const itemOperationMap = new Map<string, number>();

  try {
    // External network call executed strictly outside database transaction
    const connector = connectorFactory.getChannelConnector('lazada');

    // Fetch orders across pages in the requested date range (up to 200 orders per sync batch)
    let page = params.page ?? 1;
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 50));
    const allOrders: ExternalOrder[] = [];

    while (allOrders.length < MAX_ORDERS_TO_SYNC) {
      const pageResult = await connector.fetchOrders({
        ...params,
        includeItems: true,
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

    // Ensure line items are fetched for any orders where items are still missing
    const ordersNeedingItems = allOrders.filter(
      (o) => !o.itemsComplete || (o.items.length === 0 && !o.itemsError),
    );
    if (ordersNeedingItems.length > 0 && typeof connector.fetchMultipleOrderItems === 'function') {
      const missingOrderIds = ordersNeedingItems.map((o) => o.externalOrderId);
      const itemsMap = await connector.fetchMultipleOrderItems(missingOrderIds);
      for (let i = 0; i < allOrders.length; i++) {
        const order = allOrders[i];
        const fetched = itemsMap.get(order.externalOrderId);
        if (fetched !== undefined) {
          allOrders[i] = {
            ...order,
            items: fetched,
            itemsComplete: true,
          };
        }
      }
    }

    const totalOrders = allOrders.length;

    // Update batch total expectations
    await tx.syncBatch.update({
      where: { id: syncBatch.id },
      data: { totalOrders },
    });

    await tx.syncOperation.update({
      where: { id: orderOperation.id },
      data: { totalCount: totalOrders },
    });

    // Create per-order item SyncOperations (parentEntityType = 'order', parentEntityId = externalOrderId)
    for (const order of allOrders) {
      const itemOp = await tx.syncOperation.create({
        data: {
          batchId: syncBatch.id,
          entityType: 'order_item',
          parentEntityType: 'order',
          parentEntityId: order.externalOrderId,
          status: 'queued',
          totalCount: order.items?.length ?? 0,
          startedAt,
        },
      });
      itemOperationMap.set(order.externalOrderId, itemOp.id);
    }

    // Reconcile each external order within its own short transaction
    for (const order of allOrders) {
      try {
        const result = await runWithTx(tx, async (scopedTx) => {
          return reconcileSingleExternalOrder(
            order,
            catalogs.platformId,
            catalogs.connectionId,
            catalogs.defaultTierId,
            catalogs.statusMap,
            scopedTx,
          );
        });

        if (result.outcome === 'created') createdCount++;
        else if (result.outcome === 'updated') updatedCount++;
        else unchangedCount++;

        // Persist SyncChange records grouped by their operation
        if (result.pendingChanges.length > 0) {
          const orderChanges = result.pendingChanges.filter((c) => c.entityType === 'order');
          const itemChanges = result.pendingChanges.filter((c) => c.entityType === 'order_item');

          // Order-level changes → order operation
          if (orderChanges.length > 0) {
            await bulkCreateSyncChanges(
              orderChanges.map((c) => ({
                operationId: orderOperation.id,
                changeType: c.changeType,
                entityId: c.entityId,
                internalId: c.internalId,
                changes: c.changes,
              })),
              tx,
            );
          }

          // Item-level changes → per-order item operation
          const itemOpId = itemOperationMap.get(order.externalOrderId);
          if (itemChanges.length > 0 && itemOpId) {
            await bulkCreateSyncChanges(
              itemChanges.map((c) => ({
                operationId: itemOpId,
                changeType: c.changeType,
                entityId: c.entityId,
                internalId: c.internalId,
                changes: c.changes,
              })),
              tx,
            );
          }
        }

        // Finalize per-order item operation
        const itemOpId = itemOperationMap.get(order.externalOrderId);
        if (itemOpId) {
          await tx.syncOperation.update({
            where: { id: itemOpId },
            data: {
              status: 'completed',
              processedCount: result.itemsProcessed,
              successCount: result.itemsProcessed,
              completedAt: new Date(),
            },
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const itemCount = order.items?.length ?? 0;

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

        // Mark per-order item operation as failed
        const itemOpId = itemOperationMap.get(order.externalOrderId);
        if (itemOpId) {
          await tx.syncOperation.update({
            where: { id: itemOpId },
            data: {
              status: 'failed',
              failedCount: itemCount,
              completedAt: new Date(),
              errorMessage: message,
            },
          });
        }
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

    if (finalStatus === 'completed' || finalStatus === 'partial') {
      await tx.platformConnection.update({
        where: { id: catalogs.connectionId },
        data: { lastSyncedAt: completedAt },
      });
    }

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
      catalogs.connectionId,
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
 * Fetches a paginated preview window of orders from the specified channel connector
 * and computes field-level differences in-memory against local database records.
 * Non-mutating read-only service: does NOT write or create database entities.
 */
export async function getPreviewOrdersPageService(
  platform: string = 'lazada',
  params: FetchOrdersParams = {},
  tx: DbClient = prisma,
): Promise<OrderPreviewPage> {
  const connector = connectorFactory.getChannelConnector(platform);
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;

  const result = await connector.fetchOrders({
    ...params,
    includeItems: false,
    page,
    pageSize,
  });

  // Bulk-fetch local connection and order status mappings for entity reconciliation
  const platformRecord = await tx.platformCatalog.findUnique({
    where: { code: platform },
  });

  const connection = platformRecord
    ? await tx.platformConnection.findUnique({
        where: { platformId: platformRecord.id },
      })
    : null;

  const statusRecords = await tx.orderStatus.findMany();
  const statusMap = new Map<string, number>();
  for (const record of statusRecords) {
    statusMap.set(record.code, record.id);
  }

  const orderNumbers = result.orders.map((o) => o.orderNumber);

  // Bulk-query existing order snapshots to eliminate N+1 roundtrips during diff computation
  const existingOrders =
    connection && orderNumbers.length > 0
      ? await tx.order.findMany({
          where: {
            connectionId: connection.id,
            platformOrderId: { in: orderNumbers },
            isActive: true,
          },
          select: {
            platformOrderId: true,
            currentStatusId: true,
            totalValue: true,
            shippingFee: true,
            discountAmount: true,
          },
        })
      : [];

  const existingMap = new Map(existingOrders.map((o) => [o.platformOrderId, o]));

  const rows: OrderPreviewRow[] = result.orders.map((order) => {
    const existing = existingMap.get(order.orderNumber);

    let previewStatus: 'new' | 'existing_changed' | 'existing_unchanged' = 'new';
    let diffSummary: Record<string, FieldDiff> | null = null;

    if (existing) {
      const normalizedCode = normalizeLazadaStatus(order.status);
      const targetStatusId = statusMap.get(normalizedCode) ?? existing.currentStatusId;
      const diff = computeOrderHeaderDiff(existing, order, targetStatusId, statusMap);

      if (diff) {
        previewStatus = 'existing_changed';
        diffSummary = diff;
      } else {
        previewStatus = 'existing_unchanged';
      }
    }

    return {
      externalOrderId: order.externalOrderId,
      orderNumber: order.orderNumber,
      platform: order.platform,
      status: order.status,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      voucherDiscount: order.voucherDiscount,
      paymentMethod: order.paymentMethod,
      remarks: order.remarks,
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
      updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : String(order.updatedAt),
      previewStatus,
      buyer: {
        externalBuyerId: order.buyer.externalBuyerId,
        firstName: order.buyer.firstName,
        lastName: order.buyer.lastName,
        phone: order.buyer.phone,
        email: order.buyer.email,
      },
      itemCount: order.items?.length,
      diffSummary,
    };
  });

  return {
    rows,
    totalCount: result.totalCount,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
  };
}

/**
 * Retrieves un-synced line items for a specific order on-demand to support lazy inspection.
 * Bypasses database persistence to minimize storage overhead during read-only evaluation.
 */
export async function getPreviewOrderItemsService(
  platform: string = 'lazada',
  externalOrderId: string,
): Promise<readonly OrderPreviewItemRow[]> {
  const connector = connectorFactory.getChannelConnector(platform);
  if (!connector.fetchOrderItems) {
    return [];
  }
  const items = await connector.fetchOrderItems(externalOrderId);

  return items.map((item) => ({
    externalItemId: item.externalItemId,
    externalOrderId: item.externalOrderId,
    name: item.name,
    sku: item.sku,
    unitPrice: item.unitPrice,
    paidPrice: item.paidPrice,
    quantity: item.quantity,
    shippingFee: item.shippingFee,
    status: item.status,
    trackingCode: item.trackingCode,
    shippingProvider: item.shippingProvider,
    productImage: item.productImage,
    cancelReason: item.cancelReason,
  }));
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
    const connection = await tx.platformConnection.findUnique({
      where: { platformId: platformRecord.id },
    });

    if (connection) {
      totalOrders = await tx.order.count({
        where: { connectionId: connection.id, isActive: true },
      });

      if (connection.lastSyncedAt) {
        lastSyncedAt = connection.lastSyncedAt.toISOString();
      }

      try {
        // Query most recent completed or partial sync batch from MySQL
        const latestBatch = await tx.syncBatch.findFirst({
          where: {
            connectionId: connection.id,
            status: { in: ['completed', 'partial'] },
          },
          orderBy: { completedAt: 'desc' },
        });

        if (!lastSyncedAt && latestBatch?.completedAt) {
          lastSyncedAt = latestBatch.completedAt.toISOString();
        }

        // Query most recent sync batch to get failed records count
        const recentBatch = await tx.syncBatch.findFirst({
          where: { connectionId: connection.id },
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
        connection: {
          include: {
            platform: true,
          },
        },
        errors: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return batches.map((batch) => ({
      syncId: batch.batchCode,
      platform: (batch.connection.platform.code ?? 'lazada') as 'lazada' | 'shopify' | 'tiktok_shop',
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
