/**
 * Sync Queue Service — MySQL-backed queue management and progress tracking for batch synchronization.
 * Supports non-blocking enqueue, atomic job claiming, heartbeat renewal, and real-time live feed generation.
 */

import { prisma } from '@/lib/prisma';
import type { DbClient, FetchOrdersParams, SyncBatchProgress, SyncedOrderFeedItem } from '@/types';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';

/**
 * Enqueues a new sync batch into MySQL in 'queued' status.
 * Responds immediately (< 100ms) without blocking on external network calls.
 */
export async function enqueueSyncBatchService(
  connectionId: number,
  params: FetchOrdersParams = {},
  estimatedTotal = 0,
  tx: DbClient = prisma,
): Promise<{ readonly batchId: number; readonly batchCode: string }> {
  const batchCode = `sync_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = new Date();

  const syncBatch = await tx.syncBatch.create({
    data: {
      batchCode,
      connectionId,
      operationType: 'apply',
      status: 'queued',
      scope: (params as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      totalOrders: estimatedTotal,
      startedAt,
    },
  });

  // Create root SyncOperation for orders
  await tx.syncOperation.create({
    data: {
      batchId: syncBatch.id,
      entityType: 'order',
      parentEntityType: null,
      parentEntityId: null,
      status: 'queued',
      totalCount: estimatedTotal,
      startedAt,
    },
  });

  return {
    batchId: syncBatch.id,
    batchCode: syncBatch.batchCode,
  };
}

/**
 * Atomically claims the next pending batch for processing by workerId.
 * Also re-claims stale zombie batches (heartbeat older than 5 minutes, attemptCount < 3).
 */
export async function claimNextQueuedBatchService(
  workerId: string,
  tx: DbClient = prisma,
) {
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

  // Find candidate batch
  const candidate = await tx.syncBatch.findFirst({
    where: {
      isActive: true,
      OR: [
        { status: 'queued' },
        {
          status: 'running',
          heartbeatAt: { lt: staleThreshold },
          attemptCount: { lt: 3 },
        },
      ],
    },
    orderBy: { id: 'asc' },
  });

  if (!candidate) {
    return null;
  }

  // Atomically claim the batch
  const now = new Date();
  const claimed = await tx.syncBatch.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
    },
    data: {
      status: 'running',
      workerId,
      heartbeatAt: now,
      attemptCount: { increment: 1 },
    },
  });

  if (claimed.count === 0) {
    // Another worker claimed it concurrently
    return null;
  }

  // Update root operation status
  await tx.syncOperation.updateMany({
    where: {
      batchId: candidate.id,
      entityType: 'order',
    },
    data: {
      status: 'running',
    },
  });

  return tx.syncBatch.findUnique({
    where: { id: candidate.id },
    include: { connection: { include: { platform: true } } },
  });
}

/**
 * Updates batch progress counts and renews heartbeat timestamp to prevent stale detection.
 */
export async function updateBatchProgressService(
  batchId: number,
  stats: {
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
    readonly failed: number;
    readonly newTotal?: number;
  },
  tx: DbClient = prisma,
): Promise<void> {
  const now = new Date();

  await tx.syncBatch.update({
    where: { id: batchId },
    data: {
      createdCount: { increment: stats.created },
      updatedCount: { increment: stats.updated },
      unchangedCount: { increment: stats.unchanged },
      failedCount: { increment: stats.failed },
      ...(stats.newTotal ? { totalOrders: stats.newTotal } : {}),
      heartbeatAt: now,
    },
  });

  // Also update root operation counts
  await tx.syncOperation.updateMany({
    where: {
      batchId,
      entityType: 'order',
    },
    data: {
      processedCount: { increment: stats.created + stats.updated + stats.unchanged + stats.failed },
      successCount: { increment: stats.created + stats.updated + stats.unchanged },
      failedCount: { increment: stats.failed },
    },
  });
}

/**
 * Marks a batch as finalized (completed, partial, failed, or cancelled).
 */
export async function completeBatchService(
  batchId: number,
  finalStatus: 'completed' | 'partial' | 'failed' | 'cancelled',
  errorMessage?: string,
  tx: DbClient = prisma,
): Promise<void> {
  const batch = await tx.syncBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) return;

  const now = new Date();
  const durationMs = now.getTime() - batch.startedAt.getTime();

  await tx.syncBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      completedAt: now,
      durationMs,
      errorMessage: errorMessage ?? batch.errorMessage,
      heartbeatAt: now,
    },
  });

  await tx.syncOperation.updateMany({
    where: { batchId },
    data: {
      status: finalStatus,
      completedAt: now,
      errorMessage: errorMessage ?? undefined,
    },
  });
}

/**
 * Retrieves detailed progress and live feed for UI polling.
 */
export async function getBatchProgressService(
  batchCode: string,
  tx: DbClient = prisma,
): Promise<SyncBatchProgress | null> {
  const batch = await tx.syncBatch.findUnique({
    where: { batchCode },
  });

  if (!batch) {
    return null;
  }

  const processedOrders =
    batch.createdCount + batch.updatedCount + batch.unchangedCount + batch.failedCount;

  const totalOrders = Math.max(batch.totalOrders, processedOrders);
  let progressPercentage = 0;

  if (batch.status === 'completed') {
    progressPercentage = 100;
  } else if (totalOrders > 0) {
    progressPercentage = Math.min(99, Math.round((processedOrders / totalOrders) * 100));
  }

  // Fetch recent synced orders for this connection modified during this batch
  const recentOrdersRaw = await tx.order.findMany({
    where: {
      connectionId: batch.connectionId,
      isActive: true,
      updatedAt: { gte: batch.startedAt },
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    include: {
      currentStatus: true,
      customer: true,
      items: {
        where: { isActive: true },
        take: 5,
      },
    },
  });

  const recentOrders: SyncedOrderFeedItem[] = recentOrdersRaw.map((o) => {
    const isNew = o.createdAt.getTime() >= batch.startedAt.getTime();
    return {
      externalOrderId: o.platformOrderId,
      orderNumber: o.platformOrderId,
      buyerName: o.customer ? `Khách hàng #${o.customer.platformBuyerId}` : 'Khách hàng Lazada',
      status: o.currentStatus?.name ?? 'Đang xử lý',
      totalAmount: o.totalValue,
      outcome: isNew ? 'created' : 'updated',
      processedAt: o.updatedAt.toISOString(),
      items: o.items.map((it) => ({
        name: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    };
  });

  return {
    batchId: batch.id,
    batchCode: batch.batchCode,
    status: batch.status as SyncBatchProgress['status'],
    totalOrders,
    processedOrders,
    createdCount: batch.createdCount,
    updatedCount: batch.updatedCount,
    unchangedCount: batch.unchangedCount,
    failedCount: batch.failedCount,
    progressPercentage,
    startedAt: batch.startedAt.toISOString(),
    completedAt: batch.completedAt ? batch.completedAt.toISOString() : undefined,
    durationMs: batch.durationMs ?? (Date.now() - batch.startedAt.getTime()),
    errorMessage: batch.errorMessage ?? undefined,
    recentOrders,
  };
}

/**
 * Checks if there is an active running/queued sync batch for a platform.
 */
export async function getActiveBatchForPlatformService(
  platformCode = 'lazada',
  tx: DbClient = prisma,
): Promise<SyncBatchProgress | null> {
  const platform = await tx.platformCatalog.findUnique({
    where: { code: platformCode },
  });

  if (!platform) return null;

  const connection = await tx.platformConnection.findUnique({
    where: { platformId: platform.id },
  });

  if (!connection) return null;

  const activeBatch = await tx.syncBatch.findFirst({
    where: {
      connectionId: connection.id,
      status: { in: ['queued', 'running'] },
      isActive: true,
    },
    orderBy: { id: 'desc' },
  });

  if (!activeBatch) return null;

  return getBatchProgressService(activeBatch.batchCode, tx);
}

/**
 * Cancels an active or queued batch.
 */
export async function cancelSyncBatchService(
  batchCode: string,
  tx: DbClient = prisma,
): Promise<boolean> {
  const batch = await tx.syncBatch.findUnique({
    where: { batchCode },
  });

  if (!batch || batch.status === 'completed' || batch.status === 'failed') {
    return false;
  }

  await completeBatchService(batch.id, 'cancelled', 'Người dùng đã hủy đợt đồng bộ.', tx);
  return true;
}
