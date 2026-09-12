/**
 * Sync Change Service — Computes field-level diffs and persists SyncChange audit records.
 * SyncChange records are created only after successful database persist, not for predicted changes.
 */

import { prisma } from '@/lib/prisma';
import { Prisma, type OrderItem } from '@prisma/client';
import type {
  DbClient,
  FieldDiff,
  SyncChangeRecord,
  SyncChangeSummary,
  SyncOrderChangeGroup,
  SyncChangeQueryParams,
  ExternalOrder,
  ExternalOrderItem,
} from '@/types';

type ChangeInput = {
  readonly operationId: number;
  readonly changeType: 'created' | 'updated' | 'unchanged' | 'inactivated';
  readonly entityId: string;
  readonly internalId: number | null;
  readonly changes: Record<string, FieldDiff> | null;
};

/**
 * Computes diff for authoritative order header fields owned by Lazada.
 * Returns null when no field changed.
 */
export function computeOrderHeaderDiff(
  existing: {
    readonly currentStatusId: number;
    readonly totalValue: number;
    readonly shippingFee: number;
    readonly discountAmount: number;
  },
  incoming: ExternalOrder,
  targetStatusId: number,
  statusMap: Map<string, number>,
): Record<string, FieldDiff> | null {
  const diffs: Record<string, FieldDiff> = {};

  if (existing.currentStatusId !== targetStatusId) {
    const beforeCode = findStatusCode(existing.currentStatusId, statusMap);
    const afterCode = findStatusCode(targetStatusId, statusMap);
    diffs['status'] = { before: beforeCode, after: afterCode };
  }

  if (Math.abs(existing.totalValue - incoming.totalAmount) > 0.01) {
    diffs['totalValue'] = { before: existing.totalValue, after: incoming.totalAmount };
  }

  if (Math.abs(existing.shippingFee - incoming.shippingFee) > 0.01) {
    diffs['shippingFee'] = { before: existing.shippingFee, after: incoming.shippingFee };
  }

  if (Math.abs(existing.discountAmount - incoming.voucherDiscount) > 0.01) {
    diffs['discountAmount'] = { before: existing.discountAmount, after: incoming.voucherDiscount };
  }

  return Object.keys(diffs).length > 0 ? diffs : null;
}

/**
 * Computes diff for authoritative order item fields owned by Lazada.
 * Returns null when no field changed.
 */
export function computeOrderItemDiff(
  existing: OrderItem,
  incoming: ExternalOrderItem,
): Record<string, FieldDiff> | null {
  const diffs: Record<string, FieldDiff> = {};
  const targetQuantity = incoming.quantity ?? 1;
  const targetSku = incoming.sku ? incoming.sku.trim() : null;
  const calculatedDiscount = Math.max(0, (incoming.unitPrice ?? 0) - (incoming.paidPrice ?? 0));

  if (existing.quantity !== targetQuantity) {
    diffs['quantity'] = { before: existing.quantity, after: targetQuantity };
  }

  if (Math.abs(existing.unitPrice - incoming.unitPrice) > 0.01) {
    diffs['unitPrice'] = { before: existing.unitPrice, after: incoming.unitPrice };
  }

  if (Math.abs(existing.discount - calculatedDiscount) > 0.01) {
    diffs['discount'] = { before: existing.discount, after: calculatedDiscount };
  }

  if (existing.productName !== incoming.name) {
    diffs['productName'] = { before: existing.productName, after: incoming.name };
  }

  if ((existing.sku ?? '') !== (targetSku ?? '')) {
    diffs['sku'] = { before: existing.sku, after: targetSku };
  }

  // Reactivation counts as a change
  if (!existing.isActive) {
    diffs['isActive'] = { before: false, after: true };
  }

  return Object.keys(diffs).length > 0 ? diffs : null;
}

/**
 * Builds initial field snapshot for a newly created authoritative order header.
 * All fields have before: null and after: initial authoritative value.
 */
export function buildOrderCreatedSnapshot(
  order: ExternalOrder,
  targetStatusId: number,
  statusMap: Map<string, number>,
): Record<string, FieldDiff> {
  const statusCode = findStatusCode(targetStatusId, statusMap);
  return {
    status: { before: null, after: statusCode },
    totalValue: { before: null, after: order.totalAmount },
    shippingFee: { before: null, after: order.shippingFee },
    discountAmount: { before: null, after: order.voucherDiscount },
  };
}

/**
 * Builds initial field snapshot for a newly created authoritative order item.
 * All fields have before: null and after: initial authoritative value.
 */
export function buildOrderItemCreatedSnapshot(
  incoming: ExternalOrderItem,
): Record<string, FieldDiff> {
  const targetQuantity = incoming.quantity ?? 1;
  const targetSku = incoming.sku ? incoming.sku.trim() : null;
  const calculatedDiscount = Math.max(0, (incoming.unitPrice ?? 0) - (incoming.paidPrice ?? 0));

  return {
    productName: { before: null, after: incoming.name ?? 'Sản phẩm Lazada' },
    sku: { before: null, after: targetSku },
    quantity: { before: null, after: targetQuantity },
    unitPrice: { before: null, after: incoming.unitPrice ?? 0 },
    discount: { before: null, after: calculatedDiscount },
  };
}

/**
 * Bulk inserts SyncChange records within the provided transaction.
 */
export async function bulkCreateSyncChanges(
  changes: readonly ChangeInput[],
  tx: DbClient,
): Promise<void> {
  if (changes.length === 0) return;

  await tx.syncChange.createMany({
    data: changes.map((c) => ({
      operationId: c.operationId,
      changeType: c.changeType,
      entityId: c.entityId,
      internalId: c.internalId,
      changes: (c.changes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    })),
  });
}

/**
 * Retrieves sync change summary grouped by order for a given batch code.
 * Returns nested order → items structure for the detail page.
 */
export async function getSyncChangeSummaryByBatch(
  batchCode: string,
  tx: DbClient = prisma,
): Promise<SyncChangeSummary | null> {
  const batch = await tx.syncBatch.findUnique({
    where: { batchCode },
    include: {
      operations: {
        include: {
          changes: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!batch) return null;

  // Separate order operation and item operations
  const orderOperation = batch.operations.find((op) => op.entityType === 'order');
  const itemOperations = batch.operations.filter((op) => op.entityType === 'order_item');

  // Build order changes map from the order operation
  const orderChangesMap = new Map<string, SyncChangeRecord>();
  if (orderOperation) {
    for (const change of orderOperation.changes) {
      orderChangesMap.set(change.entityId, mapChangeToRecord(change));
    }
  }

  // Build item changes map grouped by parentEntityId (externalOrderId)
  const itemChangesMap = new Map<string, SyncChangeRecord[]>();
  for (const itemOp of itemOperations) {
    const parentOrderId = itemOp.parentEntityId;
    if (!parentOrderId) continue;

    const items = itemChangesMap.get(parentOrderId) ?? [];
    for (const change of itemOp.changes) {
      items.push(mapChangeToRecord(change));
    }
    itemChangesMap.set(parentOrderId, items);
  }

  // Merge all unique order IDs from both order changes and item operations
  const allOrderIds = new Set<string>([
    ...orderChangesMap.keys(),
    ...itemChangesMap.keys(),
  ]);

  const orderGroups: SyncOrderChangeGroup[] = [];
  let created = 0;
  let updated = 0;
  let inactivated = 0;

  for (const externalOrderId of allOrderIds) {
    const orderChange = orderChangesMap.get(externalOrderId) ?? null;
    const itemChanges = itemChangesMap.get(externalOrderId) ?? [];

    orderGroups.push({ externalOrderId, orderChange, itemChanges });

    // Count from order change
    if (orderChange) {
      if (orderChange.changeType === 'created') created++;
      else if (orderChange.changeType === 'updated') updated++;
      else if (orderChange.changeType === 'inactivated') inactivated++;
    }

    // Count from item changes
    for (const ic of itemChanges) {
      if (ic.changeType === 'created') created++;
      else if (ic.changeType === 'updated') updated++;
      else if (ic.changeType === 'inactivated') inactivated++;
    }
  }

  // Sort order groups by externalOrderId for consistent display
  orderGroups.sort((a, b) => a.externalOrderId.localeCompare(b.externalOrderId));

  return {
    batchId: batch.id,
    batchCode: batch.batchCode,
    status: batch.status,
    startedAt: batch.startedAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    durationMs: batch.durationMs,
    totalChanges: created + updated + inactivated,
    created,
    updated,
    inactivated,
    orderGroups,
  };
}

/**
 * Queries sync changes filtered by entity with pagination.
 */
export async function querySyncChangesByEntity(
  params: SyncChangeQueryParams,
  tx: DbClient = prisma,
): Promise<{ readonly changes: readonly SyncChangeRecord[]; readonly total: number }> {
  const page = params.page ?? 1;
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const where: Prisma.SyncChangeWhereInput = {};

  if (params.externalOrderId) {
    where.entityId = params.externalOrderId;
  }

  if (params.externalItemId) {
    where.entityId = params.externalItemId;
  }

  if (params.changeType) {
    where.changeType = params.changeType;
  }

  if (params.batchCode) {
    where.operation = {
      batch: { batchCode: params.batchCode },
      ...(params.entityType ? { entityType: params.entityType } : {}),
    };
  } else if (params.entityType) {
    where.operation = { entityType: params.entityType };
  }

  const [changes, total] = await Promise.all([
    tx.syncChange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.syncChange.count({ where }),
  ]);

  return {
    changes: changes.map(mapChangeToRecord),
    total,
  };
}

/** Maps a Prisma SyncChange record to the DTO */
function mapChangeToRecord(change: {
  id: number;
  operationId: number;
  changeType: string;
  entityId: string;
  internalId: number | null;
  changes: Prisma.JsonValue;
  createdAt: Date;
}): SyncChangeRecord {
  return {
    id: change.id,
    operationId: change.operationId,
    changeType: change.changeType as 'created' | 'updated' | 'unchanged' | 'inactivated',
    entityId: change.entityId,
    internalId: change.internalId,
    changes: (change.changes as Record<string, FieldDiff> | null) ?? null,
    createdAt: change.createdAt.toISOString(),
  };
}

/** Reverse-lookup status code from statusId via the statusMap */
function findStatusCode(statusId: number, statusMap: Map<string, number>): string {
  for (const [code, id] of statusMap.entries()) {
    if (id === statusId) return code;
  }
  return `status_id_${statusId}`;
}
