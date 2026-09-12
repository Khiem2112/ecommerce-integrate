import { Prisma, type SyncBatch } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type {
  DbClient,
  SyncBatchListFilter,
  SyncBatchListItem,
  SyncBatchListResponse,
  SyncBatchStatus,
  SyncMode,
} from '@/types';
import { classifySyncError, isSyncErrorRetryEligible } from '@/utils';

type BatchWithListRelations = Prisma.SyncBatchGetPayload<{
  include: {
    connection: { include: { platform: true } };
    parentBatch: { select: { batchCode: true } };
    childBatches: {
      where: { isActive: true };
      select: { batchCode: true; status: true };
      orderBy: { startedAt: 'desc' };
    };
    errors: { select: { errorCode: true; errorMessage: true } };
  };
}>;

function parseScopeDate(scope: Prisma.JsonValue, key: string): string | null {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  const value = scope[key];
  return typeof value === 'string' ? value : null;
}

function toSyncMode(value: string): SyncMode {
  if (value === 'deep_reconcile' || value === 'retry') return value;
  return 'incremental';
}

function toSyncBatchStatus(value: string): SyncBatchStatus {
  const statuses: readonly SyncBatchStatus[] = [
    'queued',
    'running',
    'completed',
    'partial',
    'failed',
    'cancelled',
  ];
  return statuses.includes(value as SyncBatchStatus) ? (value as SyncBatchStatus) : 'failed';
}

function mapBatchListItem(batch: BatchWithListRelations): SyncBatchListItem {
  const runningChild = batch.childBatches.find(
    (child) => child.status === 'running' || child.status === 'queued',
  );
  const latestChild = batch.childBatches[0];
  const categories = batch.errors.map((error) =>
    classifySyncError(error.errorCode, error.errorMessage),
  );
  const hasAuthError = categories.includes('auth_expired');
  const hasEligibleError = categories.some(isSyncErrorRetryEligible);

  let retryBlockedReason: string | null = null;
  if (!batch.connection.isActive) retryBlockedReason = 'Kết nối gian hàng đã bị ngắt.';
  else if (hasAuthError) retryBlockedReason = 'Cần cấp lại quyền truy cập gian hàng.';
  else if (runningChild) retryBlockedReason = 'Đã có đợt thử lại đang chạy.';
  else if (batch.failedCount > 0 && !hasEligibleError) {
    retryBlockedReason = 'Các lỗi hiện tại cần được xử lý thủ công.';
  }

  return {
    id: batch.id,
    batchCode: batch.batchCode,
    platform: batch.connection.platform.code,
    shopName: batch.connection.shopName,
    connectionActive: batch.connection.isActive,
    syncMode: toSyncMode(batch.syncMode),
    status: toSyncBatchStatus(batch.status),
    startedAt: batch.startedAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    triggeredBy: batch.triggeredBy,
    totalOrders: batch.totalOrders,
    createdCount: batch.createdCount,
    updatedCount: batch.updatedCount,
    unchangedCount: batch.unchangedCount,
    failedCount: batch.failedCount,
    durationMs: batch.durationMs,
    rangeFrom: parseScopeDate(batch.scope, 'createdAfter'),
    rangeTo: parseScopeDate(batch.scope, 'createdBefore'),
    parentBatchId: batch.parentBatchId,
    parentBatchCode: batch.parentBatch?.batchCode ?? null,
    childBatchCode: latestChild?.batchCode ?? null,
    hasRunningChild: Boolean(runningChild),
    retryBlockedReason,
  };
}

const LIST_INCLUDE = {
  connection: { include: { platform: true } },
  parentBatch: { select: { batchCode: true } },
  childBatches: {
    where: { isActive: true },
    select: { batchCode: true, status: true },
    orderBy: { startedAt: 'desc' },
  },
  errors: { select: { errorCode: true, errorMessage: true } },
} satisfies Prisma.SyncBatchInclude;

export async function getSyncBatchListService(
  filter: SyncBatchListFilter,
  db: DbClient = prisma,
): Promise<SyncBatchListResponse> {
  const page = filter.page ?? 1;
  const pageSize = filter.limit ?? 20;
  const startedAt: Prisma.DateTimeFilter = {};
  if (filter.dateFrom) startedAt.gte = new Date(`${filter.dateFrom}T00:00:00`);
  if (filter.dateTo) startedAt.lte = new Date(`${filter.dateTo}T23:59:59.999`);

  const where: Prisma.SyncBatchWhereInput = {
    isActive: true,
    ...(filter.platform
      ? { connection: { platform: { code: filter.platform } } }
      : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.batchCode
      ? { batchCode: { contains: filter.batchCode } }
      : {}),
    ...(Object.keys(startedAt).length > 0 ? { startedAt } : {}),
  };

  const [total, runningCount] = await Promise.all([
    db.syncBatch.count({ where }),
    filter.status && filter.status !== 'running'
      ? Promise.resolve(0)
      : db.syncBatch.count({ where: { ...where, status: 'running' } }),
  ]);

  const offset = (page - 1) * pageSize;
  const runningTake = Math.max(0, Math.min(pageSize, runningCount - offset));
  const runningRows = runningTake > 0
    ? await db.syncBatch.findMany({
        where: { ...where, status: 'running' },
        include: LIST_INCLUDE,
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: runningTake,
      })
    : [];

  const remaining = pageSize - runningRows.length;
  const nonRunningOffset = Math.max(0, offset - runningCount);
  const nonRunningRows = remaining > 0 && filter.status !== 'running'
    ? await db.syncBatch.findMany({
        where: runningCount > 0 ? { ...where, status: { not: 'running' } } : where,
        include: LIST_INCLUDE,
        orderBy: { startedAt: 'desc' },
        skip: nonRunningOffset,
        take: remaining,
      })
    : [];

  return {
    data: [...runningRows, ...nonRunningRows].map(mapBatchListItem),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function getEligibleErrorIds(
  batchId: number,
  db: DbClient,
): Promise<readonly string[]> {
  const errors = await db.syncRunError.findMany({
    where: { batchId, entityType: 'order', externalId: { not: null } },
    select: { externalId: true, errorCode: true, errorMessage: true },
  });

  return [...new Set(
    errors
      .filter((error) =>
        isSyncErrorRetryEligible(classifySyncError(error.errorCode, error.errorMessage)),
      )
      .map((error) => error.externalId)
      .filter((externalId): externalId is string => Boolean(externalId)),
  )];
}

export async function retrySyncBatchService(
  batchId: number,
  triggeredBy: string,
  db: DbClient = prisma,
  requestedExternalOrderIds?: readonly string[],
): Promise<SyncBatch> {
  const parent = await db.syncBatch.findUnique({
    where: { id: batchId },
    include: {
      connection: true,
      childBatches: {
        where: { isActive: true, status: { in: ['queued', 'running'] } },
        select: { id: true },
      },
    },
  });

  if (!parent || !parent.isActive) throw new Error('Không tìm thấy đợt đồng bộ cần thử lại.');
  if (!['partial', 'failed'].includes(parent.status)) {
    throw new Error('Chỉ có thể thử lại đợt thất bại hoặc hoàn tất một phần.');
  }
  if (!parent.connection.isActive) {
    throw new Error('Kết nối gian hàng đã bị ngắt. Hãy cấp lại quyền trước khi thử lại.');
  }
  if (parent.childBatches.length > 0) throw new Error('Đã có đợt thử lại đang chạy.');

  const activeBatch = await db.syncBatch.findFirst({
    where: {
      connectionId: parent.connectionId,
      isActive: true,
      status: { in: ['queued', 'running'] },
    },
    select: { batchCode: true },
  });
  if (activeBatch) {
    throw new Error(`Gian hàng đang có đợt ${activeBatch.batchCode} hoạt động.`);
  }

  const eligibleIds = await getEligibleErrorIds(batchId, db);
  const requested = requestedExternalOrderIds
    ? [...new Set(requestedExternalOrderIds)]
    : eligibleIds;
  const retryIds = requested.filter((id) => eligibleIds.includes(id));
  if (retryIds.length === 0) {
    throw new Error('Không có đơn lỗi tạm thời nào đủ điều kiện thử lại.');
  }

  const batchCode = `retry_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = new Date();
  const inheritedScope = parent.scope && typeof parent.scope === 'object' && !Array.isArray(parent.scope)
    ? parent.scope
    : {};

  const child = await db.syncBatch.create({
    data: {
      batchCode,
      connectionId: parent.connectionId,
      operationType: 'apply',
      status: 'queued',
      scope: {
        ...inheritedScope,
        retryExternalOrderIds: retryIds,
        retryOfBatchCode: parent.batchCode,
      } as Prisma.InputJsonValue,
      syncMode: 'retry',
      totalOrders: retryIds.length,
      parentBatchId: parent.id,
      triggeredBy,
      startedAt,
    },
  });

  await db.syncOperation.create({
    data: {
      batchId: child.id,
      entityType: 'order',
      status: 'queued',
      totalCount: retryIds.length,
      startedAt,
    },
  });

  return child;
}
