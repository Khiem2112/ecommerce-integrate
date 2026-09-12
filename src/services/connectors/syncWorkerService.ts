/**
 * Sync Worker Service — Background runner for processing queued sync batches.
 * Executes chunked order ingestion, resilient error handling, and progress reporting in Node.js background.
 */

import { prisma, runWithTx } from '@/lib/prisma';
import { MAX_ORDERS_TO_SYNC } from '@/constants';
import type { FetchOrdersParams, ExternalOrder } from '@/types';
import * as connectorFactory from './connectorFactory';
import {
  claimNextQueuedBatchService,
  updateBatchProgressService,
  completeBatchService,
} from './syncQueueService';
import {
  ensureMasterCatalogs,
  reconcileSingleExternalOrder,
} from './orderSyncService';
import { bulkCreateSyncChanges } from './syncChangeService';
import { classifySyncError } from '@/utils';

let isWorkerLoopRunning = false;

type RetryFetchFailure = {
  readonly externalOrderId: string;
  readonly message: string;
  readonly category: ReturnType<typeof classifySyncError>;
};

/**
 * Triggers background processing of all queued batches.
 * Ensures single concurrent worker loop within the process to prevent duplicate execution.
 */
export async function triggerSyncWorker(customWorkerId?: string): Promise<void> {
  if (isWorkerLoopRunning) {
    return;
  }

  isWorkerLoopRunning = true;
  const workerId = customWorkerId ?? `worker_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    while (true) {
      const batch = await claimNextQueuedBatchService(workerId, prisma);
      if (!batch) {
        break;
      }

      await processClaimedBatch(batch);
    }
  } catch (err: unknown) {
    console.error('[SyncWorker] Error in worker processing loop:', err);
  } finally {
    isWorkerLoopRunning = false;
  }
}

/**
 * Dispatches worker asynchronously in the next Node.js event loop tick (non-blocking).
 */
export function dispatchSyncWorkerAsync(workerId?: string): void {
  setImmediate(() => {
    triggerSyncWorker(workerId).catch((err) => {
      console.error('[SyncWorker] Async worker dispatch failed:', err);
    });
  });
}

/**
 * Processes a single claimed SyncBatch chunk by chunk outside large DB transactions.
 */
async function processClaimedBatch(
  batch: NonNullable<Awaited<ReturnType<typeof claimNextQueuedBatchService>>>,
): Promise<void> {
  const platformCode = batch.connection?.platform?.code ?? 'lazada';
  const connector = connectorFactory.getChannelConnector(platformCode);
  const catalogs = await ensureMasterCatalogs(prisma);

  const rawParams = (batch.scope as Record<string, unknown>) ?? {};
  const retryExternalOrderIds = Array.isArray(rawParams.retryExternalOrderIds)
    ? rawParams.retryExternalOrderIds.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    : [];
  const params: FetchOrdersParams = {
    createdAfter: rawParams.createdAfter ? new Date(String(rawParams.createdAfter)) : undefined,
    createdBefore: rawParams.createdBefore ? new Date(String(rawParams.createdBefore)) : undefined,
    status: rawParams.status ? String(rawParams.status) : undefined,
  };

  // Find root order operation
  const orderOperation = await prisma.syncOperation.findFirst({
    where: {
      batchId: batch.id,
      entityType: 'order',
      parentEntityType: null,
    },
  });

  const orderOpId = orderOperation?.id ?? 0;
  let page = 1;
  const pageSize = 50;
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSuccess = 0;
  let retryOffset = 0;

  try {
    while (totalProcessed < MAX_ORDERS_TO_SYNC) {
      // Check if user cancelled batch
      const currentCheck = await prisma.syncBatch.findUnique({
        where: { id: batch.id },
        select: { status: true },
      });

      if (currentCheck?.status === 'cancelled') {
        return;
      }

      // Retry fetch failures remain attributable to their exact order ID.
      let retryFetchFailures: RetryFetchFailure[] = [];
      const retryIdsChunk = retryExternalOrderIds.slice(retryOffset, retryOffset + pageSize);
      const pageResult = retryExternalOrderIds.length > 0
        ? await (async () => {
            const fetched = await Promise.all(retryIdsChunk.map(async (externalOrderId) => {
              try {
                return { order: await connector.fetchOrderDetail(externalOrderId), failure: null };
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Không thể tải lại đơn hàng từ sàn.';
                return {
                  order: null,
                  failure: {
                    externalOrderId,
                    message,
                    category: classifySyncError(
                      error && typeof error === 'object' && 'code' in error ? String(error.code) : null,
                      message,
                    ),
                  },
                };
              }
            }));
            retryFetchFailures = fetched.flatMap((item) => item.failure ? [item.failure] : []);
            return {
              orders: fetched.flatMap((item) => item.order ? [item.order] : []),
              totalCount: retryExternalOrderIds.length,
              page,
              pageSize,
              hasMore: retryOffset + pageSize < retryExternalOrderIds.length,
            };
          })()
        : await connector.fetchOrders({
            ...params,
            includeItems: true,
            page,
            pageSize,
          });

      if ((!pageResult.orders || pageResult.orders.length === 0) && retryFetchFailures.length === 0) {
        break;
      }

      const ordersChunk: ExternalOrder[] = [...pageResult.orders];

      // Fetch missing line items in batch if any orders lack items
      const missingItems = ordersChunk.filter(
        (o) => !o.itemsComplete || (o.items.length === 0 && !o.itemsError),
      );
      if (missingItems.length > 0 && typeof connector.fetchMultipleOrderItems === 'function') {
        const missingIds = missingItems.map((o) => o.externalOrderId);
        const itemsMap = await connector.fetchMultipleOrderItems(missingIds);
        for (let i = 0; i < ordersChunk.length; i++) {
          const ord = ordersChunk[i];
          const fetched = itemsMap.get(ord.externalOrderId);
          if (fetched !== undefined) {
            ordersChunk[i] = {
              ...ord,
              items: fetched,
              itemsComplete: true,
            };
          }
        }
      }

      let chunkCreated = 0;
      let chunkUpdated = 0;
      let chunkUnchanged = 0;
      let chunkFailed = retryFetchFailures.length;
      let fatalErrorMessage: string | null = retryFetchFailures.some(
        (failure) => failure.category === 'auth_expired',
      )
        ? 'Xác thực gian hàng đã hết hạn. Hãy cấp lại quyền trước khi đồng bộ.'
        : null;

      for (const failure of retryFetchFailures) {
        await prisma.syncRunError.create({
          data: {
            batchId: batch.id,
            operationId: orderOpId > 0 ? orderOpId : undefined,
            entityType: 'order',
            externalId: failure.externalOrderId,
            errorCode: failure.category,
            errorMessage: failure.message,
          },
        });
      }

      // Reconcile each order in its own short transaction
      for (const order of fatalErrorMessage ? [] : ordersChunk) {
        try {
          const result = await runWithTx(prisma, async (scopedTx) => {
            const reconciliation = await reconcileSingleExternalOrder(
              order,
              catalogs.platformId,
              catalogs.connectionId,
              catalogs.defaultTierId,
              catalogs.statusMap,
              scopedTx,
            );

            if (orderOpId > 0) {
              const pendingOrderChange = reconciliation.pendingChanges.find(
                (change) => change.entityType === 'order',
              );
              await bulkCreateSyncChanges(
                [{
                  operationId: orderOpId,
                  changeType: pendingOrderChange?.changeType ?? reconciliation.outcome,
                  entityId: order.externalOrderId,
                  internalId: reconciliation.orderId,
                  changes: pendingOrderChange?.changes ?? null,
                }],
                scopedTx,
              );

              const itemChanges = reconciliation.pendingChanges.filter(
                (change) => change.entityType === 'order_item',
              );
              if (itemChanges.length > 0) {
                const itemOperation = await scopedTx.syncOperation.create({
                  data: {
                    batchId: batch.id,
                    entityType: 'order_item',
                    parentEntityType: 'order',
                    parentEntityId: order.externalOrderId,
                    status: 'completed',
                    totalCount: itemChanges.length,
                    processedCount: itemChanges.length,
                    successCount: itemChanges.length,
                    completedAt: new Date(),
                  },
                });
                await bulkCreateSyncChanges(
                  itemChanges.map((change) => ({
                    operationId: itemOperation.id,
                    changeType: change.changeType,
                    entityId: change.entityId,
                    internalId: change.internalId,
                    changes: change.changes,
                  })),
                  scopedTx,
                );
              }
            }

            return reconciliation;
          });

          if (result.outcome === 'created') chunkCreated++;
          else if (result.outcome === 'updated') chunkUpdated++;
          else chunkUnchanged++;

        } catch (err: unknown) {
          chunkFailed++;
          const message = err instanceof Error ? err.message : 'Lỗi khi lưu đơn hàng';
          const category = classifySyncError(
            err && typeof err === 'object' && 'code' in err ? String(err.code) : null,
            message,
          );
          await prisma.syncRunError.create({
            data: {
              batchId: batch.id,
              operationId: orderOpId > 0 ? orderOpId : undefined,
              entityType: 'order',
              externalId: order.externalOrderId,
              errorCode: category,
              errorMessage: message,
            },
          });
          if (category === 'auth_expired') {
            fatalErrorMessage = 'Xác thực gian hàng đã hết hạn. Hãy cấp lại quyền trước khi đồng bộ.';
            break;
          }
        }
      }

      const attemptedCount = retryExternalOrderIds.length > 0
        ? retryIdsChunk.length
        : ordersChunk.length;
      totalProcessed += attemptedCount;
      totalFailed += chunkFailed;
      totalSuccess += (chunkCreated + chunkUpdated + chunkUnchanged);

      // Update batch progress in MySQL
      await updateBatchProgressService(batch.id, {
        created: chunkCreated,
        updated: chunkUpdated,
        unchanged: chunkUnchanged,
        failed: chunkFailed,
        newTotal: pageResult.totalCount,
      });

      if (fatalErrorMessage) {
        throw new Error(fatalErrorMessage);
      }

      if (!pageResult.hasMore || attemptedCount < pageSize || totalProcessed >= pageResult.totalCount) {
        break;
      }

      page++;
      retryOffset += attemptedCount;
    }

    // Finalize status
    const finalStatus: 'completed' | 'partial' | 'failed' =
      totalFailed > 0 && totalSuccess > 0
        ? 'partial'
        : totalFailed > 0 && totalSuccess === 0
          ? 'failed'
          : 'completed';

    await completeBatchService(batch.id, finalStatus);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định trong worker';
    console.error(`[SyncWorker] Fatal error processing batch ${batch.id}:`, err);
    await completeBatchService(batch.id, 'failed', errorMsg);
  }
}
