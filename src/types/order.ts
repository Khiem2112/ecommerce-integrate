/**
 * Order domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma } from '@prisma/client';

/** Order with current status, platform, and items (each with category) */
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    currentStatus: true;
    platform: true;
    items: { include: { category: true } };
  };
}>;

/** Order with full status transition history */
type OrderWithHistory = Prisma.OrderGetPayload<{
  include: {
    currentStatus: true;
    platform: true;
    items: { include: { category: true } };
    statusHistory: { include: { status: true } };
  };
}>;

/** Single order item with category */
type OrderItemWithCategory = Prisma.OrderItemGetPayload<{
  include: { category: true };
}>;

/** Order status transition history entry */
type OrderStatusHistoryWithStatus = Prisma.OrderStatusHistoryGetPayload<{
  include: { status: true };
}>;

export type {
  OrderWithRelations,
  OrderWithHistory,
  OrderItemWithCategory,
  OrderStatusHistoryWithStatus,
};
