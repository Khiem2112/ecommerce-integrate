/**
 * Order Service — data access layer for order domain.
 * Returns Prisma-derived types directly. No manual field mapping needed.
 */

import { prisma } from '@/lib/prisma';
import type { OrderWithRelations, OrderWithHistory } from '@/types';

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
export async function getOrdersByCustomerId(customerId: number): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: { customerId, isActive: true },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

/** Fetch a single order with full status transition history */
export async function getOrderById(orderId: number): Promise<OrderWithHistory | null> {
  return prisma.order.findUnique({
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
): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: { customerId, isActive: true },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
