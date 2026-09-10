/**
 * Order domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma, PlatformCatalog } from '@prisma/client';

/** Order with current status, connection, and items (each with category) */
export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    currentStatus: true;
    connection: {
      include: {
        platform: true;
      };
    };
    items: { include: { category: true } };
  };
}> & {
  platformId: number;
  platform: PlatformCatalog;
  customer?: Prisma.CustomerGetPayload<{
    include: {
      vipTier: true;
      connection: {
        include: {
          platform: true;
        };
      };
    };
  }> & {
    platformId?: number;
    platform?: PlatformCatalog;
  };
};

/** Order with full status transition history, items, customer, and connection */
export type OrderWithHistory = Prisma.OrderGetPayload<{
  include: {
    currentStatus: true;
    connection: {
      include: {
        platform: true;
      };
    };
    items: { include: { category: true } };
    statusHistory: {
      include: { status: true };
    };
  };
}> & {
  platformId: number;
  platform: PlatformCatalog;
  customer?: Prisma.CustomerGetPayload<{
    include: {
      vipTier: true;
      connection: {
        include: {
          platform: true;
        };
      };
    };
  }> & {
    platformId?: number;
    platform?: PlatformCatalog;
  };
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
