/**
 * Order Service — Data access layer for order records and status transitions.
 * Supports transaction client injection (`tx`) for atomic multi-service operations.
 * Enforces Single Responsibility Principle (SRP) and Optimistic Concurrency Control (OCC).
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  DbClient,
  OrderWithRelations,
  OrderWithHistory,
  OrderFilterParams,
  OrderListResponse,
  OrderLookupOptions,
} from '@/types';
import type {
  OrderFormValues,
  OrderUpdateInput,
  OrderItemFormValues,
} from '@/forms';

/** Shared Prisma include for standard order queries */
const ORDER_INCLUDE = {
  currentStatus: true,
  platform: true,
  customer: {
    include: {
      vipTier: true,
      platform: true,
    },
  },
  items: {
    where: { isActive: true },
    include: { category: true },
  },
} as const;

/** Full detail include with transition history */
const ORDER_FULL_INCLUDE = {
  ...ORDER_INCLUDE,
  statusHistory: {
    where: { isActive: true },
    include: { status: true },
    orderBy: { changedAt: 'desc' as const },
  },
} as const;

/** Helper to transform Prisma unique constraint / known errors into descriptive domain messages */
function handlePrismaKnownError(error: unknown, defaultMessage: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new Error('Mã đơn hàng sàn này đã tồn tại trên hệ thống.');
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(defaultMessage);
}

/**
 * Fetch paginated orders with keyword search, platform, and status filtering.
 */
export async function getOrdersPaginatedService(
  filters: OrderFilterParams = {},
  tx: DbClient = prisma,
): Promise<OrderListResponse> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 10));
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.OrderWhereInput = {
    isActive: true,
  };

  if (filters.platformId) {
    whereClause.platformId = filters.platformId;
  }

  if (filters.statusId) {
    whereClause.currentStatusId = filters.statusId;
  }

  if (filters.keyword && filters.keyword.trim() !== '') {
    const kw = filters.keyword.trim();
    whereClause.OR = [
      { platformOrderId: { contains: kw } },
      { customer: { platformBuyerId: { contains: kw } } },
    ];
  }

  const orderBy: Prisma.OrderOrderByWithRelationInput = filters.sortBy
    ? { [filters.sortBy]: filters.sortOrder ?? 'desc' }
    : { createdAt: 'desc' };

  const [items, total] = await Promise.all([
    tx.order.findMany({
      where: whereClause,
      include: ORDER_INCLUDE,
      orderBy,
      skip,
      take: pageSize,
    }),
    tx.order.count({ where: whereClause }),
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/**
 * Fetch a single order by ID with full relations and status history.
 */
export async function getOrderByIdService(
  orderId: number,
  tx: DbClient = prisma,
): Promise<OrderWithHistory | null> {
  return tx.order.findUnique({
    where: { id: orderId },
    include: ORDER_FULL_INCLUDE,
  });
}

/**
 * Optimistic concurrency check helper.
 */
async function checkConcurrency(
  orderId: number,
  expectedUpdatedAt?: string,
  tx: DbClient = prisma,
): Promise<void> {
  if (!expectedUpdatedAt) return;

  const existing = await tx.order.findUnique({
    where: { id: orderId },
    select: { updatedAt: true },
  });

  if (!existing) {
    throw new Error('Đơn hàng không tồn tại.');
  }

  const existingTimestamp = new Date(existing.updatedAt).getTime();
  const expectedTimestamp = new Date(expectedUpdatedAt).getTime();

  if (Math.abs(existingTimestamp - expectedTimestamp) > 1000) {
    throw new Error('Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng làm mới trang trước khi lưu.');
  }
}

/**
 * Create a new order with items and initial status history log.
 * Computes `totalValue` directly on the server side to ensure mathematical correctness.
 */
export async function createOrderService(
  values: OrderFormValues,
  tx: DbClient = prisma,
): Promise<OrderWithHistory> {
  try {
    const itemsSubtotal = values.items.reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice - (item.discount || 0)),
      0,
    );
    const shippingFee = values.shippingFee || 0;
    const discountAmount = values.discountAmount || 0;
    const totalValue = Math.max(0, itemsSubtotal - discountAmount + shippingFee);

    const newOrder = await tx.order.create({
      data: {
        platformId: values.platformId,
        platformOrderId: values.platformOrderId,
        customerId: values.customerId,
        currentStatusId: values.currentStatusId,
        currency: values.currency || 'VND',
        totalValue,
        shippingFee,
        discountAmount,
        cancelReturnInitiator: values.cancelReturnInitiator || null,
        cancellationReason: values.cancellationReason || null,
        items: {
          create: values.items.map((item) => ({
            productId: item.productId,
            sku: item.sku || null,
            productName: item.productName,
            categoryId: item.categoryId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            refundAmount: item.refundAmount || 0,
          })),
        },
        statusHistory: {
          create: {
            statusId: values.currentStatusId,
            changedBy: 'system',
            note: 'Khởi tạo đơn hàng mới',
          },
        },
      },
      include: ORDER_FULL_INCLUDE,
    });

    return newOrder;
  } catch (error) {
    return handlePrismaKnownError(error, 'Không thể tạo đơn hàng.');
  }
}

/**
 * Update an existing order with partial or full field updates, concurrency check,
 * granular item synchronization (soft-delete removed items), and server-side total calculation.
 */
export async function updateOrderService(
  values: OrderUpdateInput,
  tx: DbClient = prisma,
): Promise<OrderWithHistory> {
  try {
    await checkConcurrency(values.id, values.updatedAt, tx);

    const existingOrder = await tx.order.findUnique({
      where: { id: values.id },
      include: { items: { where: { isActive: true } } },
    });

    if (!existingOrder) {
      throw new Error('Đơn hàng không tồn tại.');
    }

    const updateData: Prisma.OrderUpdateInput = {
      ...(values.platformId !== undefined && { platform: { connect: { id: values.platformId } } }),
      ...(values.platformOrderId !== undefined && { platformOrderId: values.platformOrderId }),
      ...(values.customerId !== undefined && { customer: { connect: { id: values.customerId } } }),
      ...(values.currency !== undefined && { currency: values.currency }),
      ...(values.shippingFee !== undefined && { shippingFee: values.shippingFee }),
      ...(values.discountAmount !== undefined && { discountAmount: values.discountAmount }),
      ...(values.cancelReturnInitiator !== undefined && {
        cancelReturnInitiator: values.cancelReturnInitiator || null,
      }),
      ...(values.cancellationReason !== undefined && {
        cancellationReason: values.cancellationReason || null,
      }),
      ...(values.paidAt !== undefined && { paidAt: values.paidAt ? new Date(values.paidAt) : null }),
      ...(values.fulfilledAt !== undefined && {
        fulfilledAt: values.fulfilledAt ? new Date(values.fulfilledAt) : null,
      }),
      ...(values.cancelledAt !== undefined && {
        cancelledAt: values.cancelledAt ? new Date(values.cancelledAt) : null,
      }),
    };

    // Handle status transition
    if (values.currentStatusId !== undefined && values.currentStatusId !== existingOrder.currentStatusId) {
      updateData.currentStatus = { connect: { id: values.currentStatusId } };
      const targetStatus = await tx.orderStatus.findUnique({
        where: { id: values.currentStatusId },
      });

      if (targetStatus?.code === 'delivered') updateData.fulfilledAt = new Date();
      else if (targetStatus?.code === 'cancelled') updateData.cancelledAt = new Date();
      else if (targetStatus?.code === 'paid') updateData.paidAt = new Date();

      updateData.statusHistory = {
        create: {
          statusId: values.currentStatusId,
          changedBy: values.statusChangedBy || 'agent',
          note: values.statusChangeNote || `Chuyển trạng thái sang "${targetStatus?.name || values.currentStatusId}"`,
        },
      };
    }

    // Synchronize items with soft-delete (avoid hard-deleting items)
    if (values.items && Array.isArray(values.items)) {
      const existingItems = await tx.orderItem.findMany({
        where: { orderId: values.id, isActive: true },
      });

      const incomingIds = new Set(
        values.items
          .map((it) => it.id)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      );

      // Soft-delete items removed from list
      const itemsToDeactivate = existingItems.filter((it) => !incomingIds.has(it.id));
      if (itemsToDeactivate.length > 0) {
        await tx.orderItem.updateMany({
          where: { id: { in: itemsToDeactivate.map((it) => it.id) } },
          data: { isActive: false },
        });
      }

      // Update existing items or create newly added items
      for (const item of values.items) {
        if (item.id && existingItems.some((e) => e.id === item.id)) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              productId: item.productId,
              sku: item.sku || null,
              productName: item.productName,
              categoryId: item.categoryId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              refundAmount: item.refundAmount || 0,
              isActive: true,
            },
          });
        } else {
          await tx.orderItem.create({
            data: {
              orderId: values.id,
              productId: item.productId,
              sku: item.sku || null,
              productName: item.productName,
              categoryId: item.categoryId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              refundAmount: item.refundAmount || 0,
            },
          });
        }
      }
    }

    // Always recompute totalValue on server from real DB active items + shipping + discount
    const activeItems = await tx.orderItem.findMany({
      where: { orderId: values.id, isActive: true },
    });
    const itemsSubtotal = activeItems.reduce(
      (sum, it) => sum + (it.quantity * it.unitPrice - it.discount),
      0,
    );
    const effectiveShipping = values.shippingFee !== undefined ? values.shippingFee : existingOrder.shippingFee;
    const effectiveDiscount = values.discountAmount !== undefined ? values.discountAmount : existingOrder.discountAmount;
    updateData.totalValue = Math.max(0, itemsSubtotal - effectiveDiscount + effectiveShipping);

    return await tx.order.update({
      where: { id: values.id },
      data: updateData,
      include: ORDER_FULL_INCLUDE,
    });
  } catch (error) {
    return handlePrismaKnownError(error, 'Không thể cập nhật đơn hàng.');
  }
}

/**
 * Soft delete an order by ID.
 */
export async function softDeleteOrderService(
  orderId: number,
  expectedUpdatedAt?: string,
  tx: DbClient = prisma,
): Promise<{ readonly id: number }> {
  await checkConcurrency(orderId, expectedUpdatedAt, tx);

  await tx.order.update({
    where: { id: orderId },
    data: { isActive: false },
  });

  return { id: orderId };
}

/**
 * Sub-modal action: Add single line item to order.
 */
export async function addOrderItemService(
  orderId: number,
  item: OrderItemFormValues,
  expectedUpdatedAt?: string,
  tx: DbClient = prisma,
): Promise<OrderWithHistory> {
  await checkConcurrency(orderId, expectedUpdatedAt, tx);

  await tx.orderItem.create({
    data: {
      orderId,
      productId: item.productId,
      sku: item.sku || null,
      productName: item.productName,
      categoryId: item.categoryId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      refundAmount: item.refundAmount || 0,
    },
  });

  // Recalculate total value
  const allItems = await tx.orderItem.findMany({
    where: { orderId, isActive: true },
  });
  const currentOrder = await tx.order.findUnique({
    where: { id: orderId },
  });

  if (!currentOrder) throw new Error('Đơn hàng không tồn tại.');

  const itemsSubtotal = allItems.reduce(
    (sum, it) => sum + (it.quantity * it.unitPrice - it.discount),
    0,
  );
  const totalValue = Math.max(
    0,
    itemsSubtotal - currentOrder.discountAmount + currentOrder.shippingFee,
  );

  return tx.order.update({
    where: { id: orderId },
    data: { totalValue },
    include: ORDER_FULL_INCLUDE,
  });
}

/**
 * Sub-modal action: Soft delete single line item from order.
 */
export async function deleteOrderItemService(
  orderId: number,
  itemId: number,
  expectedUpdatedAt?: string,
  tx: DbClient = prisma,
): Promise<OrderWithHistory> {
  await checkConcurrency(orderId, expectedUpdatedAt, tx);

  await tx.orderItem.update({
    where: { id: itemId },
    data: { isActive: false },
  });

  const allItems = await tx.orderItem.findMany({
    where: { orderId, isActive: true },
  });
  const currentOrder = await tx.order.findUnique({
    where: { id: orderId },
  });

  if (!currentOrder) throw new Error('Đơn hàng không tồn tại.');

  const itemsSubtotal = allItems.reduce(
    (sum, it) => sum + (it.quantity * it.unitPrice - it.discount),
    0,
  );
  const totalValue = Math.max(
    0,
    itemsSubtotal - currentOrder.discountAmount + currentOrder.shippingFee,
  );

  return tx.order.update({
    where: { id: orderId },
    data: { totalValue },
    include: ORDER_FULL_INCLUDE,
  });
}

/**
 * Fetch lookup options (Platforms, Statuses, Customers, Categories) for dropdowns.
 */
export async function getOrderLookupOptionsService(
  tx: DbClient = prisma,
): Promise<OrderLookupOptions> {
  const [platforms, statuses, customers, categories] = await Promise.all([
    tx.platformCatalog.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { id: 'asc' },
    }),
    tx.orderStatus.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, isFinal: true },
      orderBy: { sortOrder: 'asc' },
    }),
    tx.customer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        platformBuyerId: true,
        platform: { select: { name: true } },
        vipTier: { select: { name: true, code: true } },
      },
      orderBy: { id: 'asc' },
      take: 100,
    }),
    tx.categoryCatalog.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    platforms,
    statuses,
    customers: customers.map((c) => ({
      id: c.id,
      platformBuyerId: c.platformBuyerId,
      platformName: c.platform.name,
      vipTierName: c.vipTier.name,
      vipTierCode: c.vipTier.code,
    })),
    categories,
  };
}

/** Legacy & cross-service compatibility aliases */
export const getOrderById = getOrderByIdService;

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
