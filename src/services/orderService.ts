/**
 * Order Service — data access layer for order records and status transition history.
 * Supports transaction client injection for atomic multi-service operations.
 */

import { prisma } from '@/lib/prisma';
import type { DbClient, OrderWithRelations, OrderWithHistory } from '@/types';

/** Shared include for standard order queries */
const ORDER_INCLUDE = {
  currentStatus: true,
  platform: true,
  items: {
    where: { isActive: true },
    include: { category: true },
  },
} as const;

/** Fetch orders for a customer, ordered by creation date desc */
export async function getOrdersByCustomerId(
  customerId: number,
  tx: DbClient = prisma,
): Promise<OrderWithRelations[]> {
  return tx.order.findMany({
    where: { customerId, isActive: true },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

/** Fetch a single order with full status transition history */
export async function getOrderById(
  orderId: number,
  tx: DbClient = prisma,
): Promise<OrderWithHistory | null> {
  return tx.order.findUnique({
    where: { id: orderId },
    include: {
      ...ORDER_INCLUDE,
      statusHistory: {
        include: { status: true },
        orderBy: { changedAt: 'asc' },
      },
    },
  });
}

/** Fetch the most recent N orders for a customer */
export async function getRecentOrders(
  customerId: number,
  limit: number = 5,
  tx: DbClient = prisma,
): Promise<OrderWithRelations[]> {
  return tx.order.findMany({
    where: { customerId, isActive: true },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
