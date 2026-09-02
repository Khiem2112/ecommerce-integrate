/**
 * Order domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma } from '@prisma/client';

/** Order with current status, platform, and items (each with category) */
export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    currentStatus: true;
    platform: true;
    items: { include: { category: true } };
  };
}> & {
  customer?: Prisma.CustomerGetPayload<{
    include: {
      vipTier: true;
      platform: true;
    };
  }>;
};

/** Order with full status transition history, items, customer, and platform */
export type OrderWithHistory = Prisma.OrderGetPayload<{
  include: {
    currentStatus: true;
    platform: true;
    items: { include: { category: true } };
    statusHistory: {
      include: { status: true };
    };
  };
}> & {
  customer?: Prisma.CustomerGetPayload<{
    include: {
      vipTier: true;
      platform: true;
    };
  }>;
};

/** Single order item with category */
export type OrderItemWithCategory = Prisma.OrderItemGetPayload<{
  include: { category: true };
}>;

/** Order status transition history entry */
export type OrderStatusHistoryWithStatus = Prisma.OrderStatusHistoryGetPayload<{
  include: { status: true };
}>;

/** Filter parameters for querying order list */
export type OrderFilterParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly keyword?: string;
  readonly platformId?: number;
  readonly statusId?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
};

/** Pagination metadata */
export type PaginationMeta = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
};

/** Response for paginated order query */
export type OrderListResponse = {
  readonly items: readonly OrderWithRelations[];
  readonly pagination: PaginationMeta;
};

/** Lookup options for dropdowns in forms and filters */
export type OrderLookupOptions = {
  readonly platforms: readonly { readonly id: number; readonly code: string; readonly name: string }[];
  readonly statuses: readonly { readonly id: number; readonly code: string; readonly name: string; readonly isFinal: boolean }[];
  readonly customers: readonly {
    readonly id: number;
    readonly platformBuyerId: string;
    readonly platformName: string;
    readonly vipTierName: string;
    readonly vipTierCode: string;
  }[];
  readonly categories: readonly { readonly id: number; readonly code: string; readonly name: string }[];
};
