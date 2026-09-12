/**
 * Synchronization Domain Types.
 * Derives directly from Prisma-generated types via `prisma generate`.
 */

import type {
  Prisma,
  SyncBatch,
  SyncOperation,
  SyncRunError,
  SyncChange,
} from '@prisma/client';
import type { PaginationMeta } from './order';

// Re-export core Prisma models
export type { SyncBatch, SyncOperation, SyncRunError, SyncChange };

// ============================================================================
// Prisma-Derived Relation Types
// ============================================================================

/** SyncBatch with platform, operations and errors included */
export type SyncBatchWithRelations = Prisma.SyncBatchGetPayload<{
  include: {
    platform: true;
    operations: true;
    errors: true;
  };
}>;

/** SyncBatch with full operations hierarchy and nested changes */
export type SyncBatchWithOperations = Prisma.SyncBatchGetPayload<{
  include: {
    operations: {
      include: {
        changes: true;
        errors: true;
      };
    };
    errors: true;
  };
}>;

/** SyncOperation with nested changes and errors */
export type SyncOperationWithRelations = Prisma.SyncOperationGetPayload<{
  include: {
    changes: true;
    errors: true;
  };
}>;

/** Raw SyncChange model record directly from Prisma */
export type SyncChangeModel = Prisma.SyncChangeGetPayload<object>;

/** Raw SyncRunError model record directly from Prisma */
export type SyncRunErrorModel = Prisma.SyncRunErrorGetPayload<object>;

// ============================================================================
// Sync Change Tracking & Audit DTOs (Derived from Prisma SyncChange)
// ============================================================================

export type SyncChangeType = 'created' | 'updated' | 'unchanged' | 'inactivated';

export type SyncChangeEntityType = 'order' | 'order_item';

export type FieldDiff = {
  readonly before: unknown;
  readonly after: unknown;
};

/**
 * Domain DTO for SyncChange with strongly-typed field diffs and ISO date string,
 * derived from the Prisma SyncChange model.
 */
export type SyncChangeRecord = Omit<SyncChange, 'changes' | 'createdAt'> & {
  readonly changeType: SyncChangeType;
  readonly changes: Record<string, FieldDiff> | null;
  readonly createdAt: string;
};

/** Order-level change group with nested item changes for the detail page */
export type SyncOrderChangeGroup = {
  readonly externalOrderId: string;
  readonly orderChange: SyncChangeRecord | null;
  readonly itemChanges: readonly SyncChangeRecord[];
};

/** Aggregated summary of all changes in a sync batch */
export type SyncChangeSummary = {
  readonly batchId: number;
  readonly batchCode: string;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly totalChanges: number;
  readonly created: number;
  readonly updated: number;
  readonly inactivated: number;
  readonly orderGroups: readonly SyncOrderChangeGroup[];
};

/** Parameters for querying sync changes by entity */
export type SyncChangeQueryParams = {
  readonly batchCode?: string;
  readonly externalOrderId?: string;
  readonly externalItemId?: string;
  readonly entityType?: SyncChangeEntityType;
  readonly changeType?: SyncChangeType;
  readonly page?: number;
  readonly pageSize?: number;
};

/** Input shape for creating a SyncChange before it has an operationId assigned */
export type PendingSyncChange = {
  readonly entityType: SyncChangeEntityType;
  readonly changeType: SyncChangeType;
  readonly entityId: string;
  readonly internalId: number | null;
  readonly parentEntityId: string | null;
  readonly changes: Record<string, FieldDiff> | null;
};

// ============================================================================
// Sync Execution, Results & Run Logs
// ============================================================================

export type SyncRecordError = {
  readonly externalOrderId: string;
  readonly message: string;
  readonly entityType?: 'order' | 'order_item' | 'global';
  readonly errorCode?: string;
};

export type SyncResult = {
  readonly syncId: string;
  readonly status: 'completed' | 'partial' | 'failed';
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly failed: number;
  readonly errors?: readonly SyncRecordError[];
  readonly startedAt: string;
  readonly completedAt?: string;
};

export type SyncRunLog = {
  readonly syncId: string;
  readonly platform: 'lazada' | 'shopify' | 'tiktok_shop';
  readonly status: 'completed' | 'partial' | 'failed';
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly failed: number;
  readonly errors?: readonly SyncRecordError[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
};

export type PreflightSyncResult = {
  readonly totalCount: number;
  readonly dateRange?: {
    readonly from?: string;
    readonly to?: string;
  };
  readonly status?: string;
};

export type SyncedOrderFeedItem = {
  readonly externalOrderId: string;
  readonly orderNumber: string;
  readonly buyerName: string;
  readonly status: string;
  readonly totalAmount: number;
  readonly outcome: 'created' | 'updated' | 'unchanged' | 'failed';
  readonly processedAt: string;
  readonly items: readonly {
    readonly name: string;
    readonly sku: string | null;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
};

export type SyncBatchProgress = {
  readonly batchId: number;
  readonly batchCode: string;
  readonly status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  readonly totalOrders: number;
  readonly processedOrders: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly failedCount: number;
  readonly progressPercentage: number;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly errorMessage?: string;
  readonly recentOrders?: readonly SyncedOrderFeedItem[];
};

// ============================================================================
// Quick Preview Types (Client-facing DTOs)
// ============================================================================

export type OrderPreviewStatus = 'new' | 'existing_changed' | 'existing_unchanged';

export type OrderPreviewRow = {
  readonly externalOrderId: string;
  readonly orderNumber: string;
  readonly platform: string;
  readonly status: string;
  readonly totalAmount: number;
  readonly shippingFee: number;
  readonly voucherDiscount: number;
  readonly paymentMethod: string;
  readonly remarks?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly previewStatus: OrderPreviewStatus;
  readonly buyer: {
    readonly externalBuyerId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly phone?: string;
    readonly email?: string;
  };
  readonly itemCount?: number;
  readonly diffSummary?: Record<string, FieldDiff> | null;
};

export type OrderPreviewPage = {
  readonly rows: readonly OrderPreviewRow[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
  readonly cachedAt?: string;
};

export type OrderPreviewItemRow = {
  readonly externalItemId: string;
  readonly externalOrderId: string;
  readonly name: string;
  readonly sku: string;
  readonly unitPrice: number;
  readonly paidPrice: number;
  readonly quantity: number;
  readonly shippingFee: number;
  readonly status: string;
  readonly trackingCode?: string;
  readonly shippingProvider?: string;
  readonly productImage?: string;
  readonly cancelReason?: string;
};

// ============================================================================
// Sync Batch Operations Screens
// ============================================================================

export type SyncBatchStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type SyncMode = 'incremental' | 'deep_reconcile' | 'retry';

export type SyncBatchListItem = {
  readonly id: number;
  readonly batchCode: string;
  readonly platform: string;
  readonly shopName: string | null;
  readonly connectionActive: boolean;
  readonly syncMode: SyncMode;
  readonly status: SyncBatchStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly triggeredBy: string | null;
  readonly totalOrders: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly failedCount: number;
  readonly durationMs: number | null;
  readonly rangeFrom: string | null;
  readonly rangeTo: string | null;
  readonly parentBatchId: number | null;
  readonly parentBatchCode: string | null;
  readonly childBatchCode: string | null;
  readonly hasRunningChild: boolean;
  readonly retryBlockedReason: string | null;
};

export type SyncBatchListFilter = {
  readonly platform?: string;
  readonly status?: SyncBatchStatus;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly batchCode?: string;
  readonly page?: number;
  readonly limit?: number;
};

export type SyncBatchListResponse = {
  readonly data: readonly SyncBatchListItem[];
  readonly meta: PaginationMeta;
};

export type SyncOrderChangeType = 'created' | 'updated' | 'unchanged' | 'failed';

export type SyncErrorCategory =
  | 'transient_network'
  | 'rate_limited'
  | 'auth_expired'
  | 'validation_error'
  | 'unknown';

export type SyncOrderListItem = {
  readonly externalOrderId: string;
  readonly internalOrderId: number | null;
  readonly syncedAt: string;
  readonly changeType: SyncOrderChangeType;
  readonly changedOrderFields: readonly string[];
  readonly orderFields: readonly SyncFieldDiff[];
  readonly currentStatus: string | null;
  readonly totalValue: number | null;
  readonly shippingFee: number | null;
  readonly discountAmount: number | null;
  readonly changedItemCount: number;
  readonly errorCategory: SyncErrorCategory | null;
  readonly errorMessage: string | null;
  readonly retryEligible: boolean;
};

export type SyncBatchDetail = {
  readonly id: number;
  readonly batchCode: string;
  readonly platform: string;
  readonly shopName: string | null;
  readonly connectionActive: boolean;
  readonly syncMode: SyncMode;
  readonly status: SyncBatchStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly triggeredBy: string | null;
  readonly totalOrders: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly failedCount: number;
  readonly durationMs: number | null;
  readonly rangeFrom: string | null;
  readonly rangeTo: string | null;
  readonly parentBatchId: number | null;
  readonly parentBatchCode: string | null;
};

export type SyncFieldDiff = {
  readonly fieldName: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly changedAt: string;
};

export type SyncItemDiffGroup = {
  readonly entityId: string;
  readonly changeType: SyncChangeType;
  readonly fields: readonly SyncFieldDiff[];
};

export type SyncOrderDiff = {
  readonly externalOrderId: string;
  readonly internalOrderId: number | null;
  readonly changeType: SyncOrderChangeType;
  readonly syncedAt: string;
  readonly orderFields: readonly SyncFieldDiff[];
  readonly itemGroups: readonly SyncItemDiffGroup[];
  readonly errorCategory: SyncErrorCategory | null;
  readonly errorMessage: string | null;
  readonly retryEligible: boolean;
};

export type SyncBatchDetailProgress = {
  readonly totalOrders: number;
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly failedCount: number;
  readonly progressPercent: number;
  readonly status: SyncBatchStatus;
};
