import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  DbClient,
  PaginationMeta,
  SyncBatchDetail,
  SyncBatchDetailProgress,
  SyncBatchStatus,
  SyncErrorCategory,
  SyncFieldDiff,
  SyncItemDiffGroup,
  SyncMode,
  SyncOrderChangeType,
  SyncOrderDiff,
  SyncOrderListItem,
} from '@/types';
import { classifySyncError, isSyncErrorRetryEligible } from '@/utils';
import { retrySyncBatchService } from './syncBatchListService';

function asStatus(value: string): SyncBatchStatus {
  return value as SyncBatchStatus;
}

function asMode(value: string): SyncMode {
  if (value === 'deep_reconcile' || value === 'retry') return value;
  return 'incremental';
}

function getScopeDate(scope: Prisma.JsonValue, key: string): string | null {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  return typeof scope[key] === 'string' ? scope[key] : null;
}

function parseDiffs(changes: Prisma.JsonValue, changedAt: Date): readonly SyncFieldDiff[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes).flatMap(([fieldName, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    return [{
      fieldName,
      before: record.before,
      after: record.after,
      changedAt: changedAt.toISOString(),
    }];
  });
}

type OrderSnapshot = {
  readonly currentStatus: string | null;
  readonly totalValue: number | null;
  readonly shippingFee: number | null;
  readonly discountAmount: number | null;
};

export async function getSyncBatchDetailService(
  batchId: number,
  db: DbClient = prisma,
): Promise<SyncBatchDetail | null> {
  const batch = await db.syncBatch.findUnique({
    where: { id: batchId },
    include: {
      connection: { include: { platform: true } },
      parentBatch: { select: { batchCode: true } },
    },
  });
  if (!batch || !batch.isActive) return null;

  return {
    id: batch.id,
    batchCode: batch.batchCode,
    platform: batch.connection.platform.code,
    shopName: batch.connection.shopName,
    connectionActive: batch.connection.isActive,
    syncMode: asMode(batch.syncMode),
    status: asStatus(batch.status),
    startedAt: batch.startedAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    triggeredBy: batch.triggeredBy,
    totalOrders: batch.totalOrders,
    createdCount: batch.createdCount,
    updatedCount: batch.updatedCount,
    unchangedCount: batch.unchangedCount,
    failedCount: batch.failedCount,
    durationMs: batch.durationMs,
    rangeFrom: getScopeDate(batch.scope, 'createdAfter'),
    rangeTo: getScopeDate(batch.scope, 'createdBefore'),
    parentBatchId: batch.parentBatchId,
    parentBatchCode: batch.parentBatch?.batchCode ?? null,
  };
}

export async function getSyncBatchDetailByCodeService(
  batchCode: string,
  db: DbClient = prisma,
): Promise<SyncBatchDetail | null> {
  const batch = await db.syncBatch.findUnique({
    where: { batchCode },
    select: { id: true, isActive: true },
  });
  if (!batch?.isActive) return null;
  return getSyncBatchDetailService(batch.id, db);
}

export async function getSyncOrderListService(
  batchId: number,
  changeType: SyncOrderChangeType | undefined,
  page: number,
  limit: number,
  db: DbClient = prisma,
): Promise<{ readonly data: readonly SyncOrderListItem[]; readonly meta: PaginationMeta }> {
  const [changes, itemOperations, errors] = await Promise.all([
    db.syncChange.findMany({
      where: {
        operation: { batchId, entityType: 'order' },
        ...(changeType && changeType !== 'failed' ? { changeType } : {}),
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.syncOperation.findMany({
      where: { batchId, entityType: 'order_item', parentEntityId: { not: null }, isActive: true },
      include: { changes: { select: { id: true } } },
    }),
    db.syncRunError.findMany({
      where: { batchId, entityType: 'order', externalId: { not: null } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const itemCounts = new Map<string, number>();
  for (const operation of itemOperations) {
    if (operation.parentEntityId) {
      itemCounts.set(
        operation.parentEntityId,
        (itemCounts.get(operation.parentEntityId) ?? 0) + operation.changes.length,
      );
    }
  }

  const internalOrderIds = [...new Set(
    changes
      .map((change) => change.internalId)
      .filter((id): id is number => typeof id === 'number'),
  )];
  const orderSnapshots = new Map<number, OrderSnapshot>();
  if (internalOrderIds.length > 0) {
    const orders = await db.order.findMany({
      where: { id: { in: internalOrderIds } },
      select: {
        id: true,
        totalValue: true,
        shippingFee: true,
        discountAmount: true,
        currentStatus: { select: { code: true } },
      },
    });
    for (const order of orders) {
      orderSnapshots.set(order.id, {
        currentStatus: order.currentStatus.code,
        totalValue: order.totalValue,
        shippingFee: order.shippingFee,
        discountAmount: order.discountAmount,
      });
    }
  }

  const byOrderId = new Map<string, SyncOrderListItem>();
  if (changeType !== 'failed') {
    for (const change of changes) {
      const orderFields = parseDiffs(change.changes, change.createdAt);
      const snapshot = change.internalId ? orderSnapshots.get(change.internalId) : null;
      const mappedType: SyncOrderChangeType = change.changeType === 'created'
        ? 'created'
        : change.changeType === 'unchanged'
          ? 'unchanged'
          : 'updated';
      if (changeType && mappedType !== changeType) continue;
      byOrderId.set(change.entityId, {
        externalOrderId: change.entityId,
        internalOrderId: change.internalId,
        syncedAt: change.createdAt.toISOString(),
        changeType: mappedType,
        changedOrderFields: orderFields.map((field) => field.fieldName),
        orderFields,
        currentStatus: snapshot?.currentStatus ?? null,
        totalValue: snapshot?.totalValue ?? null,
        shippingFee: snapshot?.shippingFee ?? null,
        discountAmount: snapshot?.discountAmount ?? null,
        changedItemCount: itemCounts.get(change.entityId) ?? 0,
        errorCategory: null,
        errorMessage: null,
        retryEligible: false,
      });
    }
  }

  if (!changeType || changeType === 'failed') {
    for (const error of errors) {
      if (!error.externalId) continue;
      const category = classifySyncError(error.errorCode, error.errorMessage);
      byOrderId.set(error.externalId, {
        externalOrderId: error.externalId,
        internalOrderId: null,
        syncedAt: error.createdAt.toISOString(),
        changeType: 'failed',
        changedOrderFields: [],
        orderFields: [],
        currentStatus: null,
        totalValue: null,
        shippingFee: null,
        discountAmount: null,
        changedItemCount: 0,
        errorCategory: category,
        errorMessage: error.errorMessage,
        retryEligible: isSyncErrorRetryEligible(category),
      });
    }
  }

  const all = [...byOrderId.values()].sort((a, b) =>
    a.syncedAt.localeCompare(b.syncedAt) || a.externalOrderId.localeCompare(b.externalOrderId),
  );
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  return {
    data: all.slice(offset, offset + safeLimit),
    meta: {
      page: safePage,
      pageSize: safeLimit,
      total: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / safeLimit)),
    },
  };
}

export async function getSyncOrderDiffService(
  batchId: number,
  externalOrderId: string,
  db: DbClient = prisma,
): Promise<SyncOrderDiff | null> {
  const [orderChange, itemOperations, error] = await Promise.all([
    db.syncChange.findFirst({
      where: { entityId: externalOrderId, operation: { batchId, entityType: 'order' } },
      orderBy: { createdAt: 'desc' },
    }),
    db.syncOperation.findMany({
      where: { batchId, entityType: 'order_item', parentEntityId: externalOrderId, isActive: true },
      include: { changes: { orderBy: { createdAt: 'asc' } } },
    }),
    db.syncRunError.findFirst({
      where: { batchId, entityType: 'order', externalId: externalOrderId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!orderChange && itemOperations.length === 0 && !error) return null;
  const itemGroupMap = new Map<string, SyncItemDiffGroup>();
  for (const operation of itemOperations) {
    for (const change of operation.changes) {
      const existing = itemGroupMap.get(change.entityId);
      itemGroupMap.set(change.entityId, {
        entityId: change.entityId,
        changeType: change.changeType as SyncItemDiffGroup['changeType'],
        fields: [
          ...(existing?.fields ?? []),
          ...parseDiffs(change.changes, change.createdAt),
        ],
      });
    }
  }
  const itemGroups = [...itemGroupMap.values()];
  const category: SyncErrorCategory | null = error
    ? classifySyncError(error.errorCode, error.errorMessage)
    : null;
  const mappedType: SyncOrderChangeType = error
    ? 'failed'
    : orderChange?.changeType === 'created'
      ? 'created'
      : orderChange?.changeType === 'unchanged'
        ? 'unchanged'
        : 'updated';

  return {
    externalOrderId,
    internalOrderId: orderChange?.internalId ?? null,
    changeType: mappedType,
    syncedAt: (orderChange?.createdAt ?? error?.createdAt ?? new Date()).toISOString(),
    orderFields: orderChange ? parseDiffs(orderChange.changes, orderChange.createdAt) : [],
    itemGroups,
    errorCategory: category,
    errorMessage: error?.errorMessage ?? null,
    retryEligible: category ? isSyncErrorRetryEligible(category) : false,
  };
}

export async function getSyncBatchDetailProgressService(
  batchId: number,
  db: DbClient = prisma,
): Promise<SyncBatchDetailProgress | null> {
  const batch = await db.syncBatch.findUnique({
    where: { id: batchId },
    select: {
      isActive: true,
      status: true,
      totalOrders: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      failedCount: true,
    },
  });
  if (!batch?.isActive) return null;
  const processed = batch.createdCount + batch.updatedCount + batch.unchangedCount + batch.failedCount;
  const progressPercent = batch.status === 'completed'
    ? 100
    : batch.totalOrders > 0
      ? Math.min(99, Math.round((processed / batch.totalOrders) * 100))
      : 0;

  return {
    totalOrders: Math.max(batch.totalOrders, processed),
    createdCount: batch.createdCount,
    updatedCount: batch.updatedCount,
    unchangedCount: batch.unchangedCount,
    failedCount: batch.failedCount,
    progressPercent,
    status: asStatus(batch.status),
  };
}

export async function retrySelectedOrdersService(
  batchId: number,
  externalOrderIds: readonly string[],
  triggeredBy: string,
  db: DbClient = prisma,
): Promise<{ readonly batchCode: string }> {
  const child = await retrySyncBatchService(batchId, triggeredBy, db, externalOrderIds);
  return { batchCode: child.batchCode };
}
