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

export type SyncChangeType = 'created' | 'updated' | 'inactivated';

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
