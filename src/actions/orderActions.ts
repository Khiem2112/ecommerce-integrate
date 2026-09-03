'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  getOrdersPaginatedService,
  getOrderByIdService,
  createOrderService,
  updateOrderService,
  softDeleteOrderService,
  addOrderItemService,
  deleteOrderItemService,
  getPlatformsService,
  getOrderStatusesService,
  getCategoriesService,
  getCustomerLookupListService,
} from '@/services';
import {
  orderFilterSchema,
  orderFormSchema,
  orderUpdateSchema,
  addOrderItemSchema,
  getOrderSchema,
  deleteOrderSchema,
  deleteOrderItemSchema,
  type OrderFormValues,
  type OrderUpdateInput,
  type AddOrderItemValues,
} from '@/forms';
import type {
  ActionResponse,
  OrderFilterParams,
  OrderListResponse,
  OrderWithHistory,
  OrderLookupOptions,
} from '@/types';

/**
 * Server Action: Fetch paginated orders with filters.
 */
export async function getOrdersAction(
  filters: OrderFilterParams = {},
): Promise<ActionResponse<OrderListResponse>> {
  try {
    const parsed = orderFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Bộ lọc không hợp lệ.',
      };
    }

    const data = await getOrdersPaginatedService(parsed.data);
    return { success: true, data };
  } catch (error) {
    console.error('Error in getOrdersAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải danh sách đơn hàng.',
    };
  }
}

/**
 * Server Action: Fetch order detail by ID.
 */
export async function getOrderAction(
  id: number,
): Promise<ActionResponse<OrderWithHistory>> {
  try {
    const parsed = getOrderSchema.safeParse({ id });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Mã đơn hàng không hợp lệ.',
      };
    }

    const data = await getOrderByIdService(parsed.data.id);
    if (!data) {
      return { success: false, error: 'Không tìm thấy đơn hàng.' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in getOrderAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải thông tin đơn hàng.',
    };
  }
}

/**
 * Server Action: Create a new order with items.
 */
export async function createOrderAction(
  payload: OrderFormValues,
): Promise<ActionResponse<OrderWithHistory>> {
  try {
    const parsed = orderFormSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' };
    }

    const created = await prisma.$transaction(async (tx) => {
      return createOrderService(parsed.data, tx);
    });

    revalidatePath('/orders');
    return { success: true, data: created };
  } catch (error) {
    console.error('Error in createOrderAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tạo đơn hàng.',
    };
  }
}

/**
 * Server Action: Unified Update for Order (Full or Partial updates).
 */
export async function updateOrderAction(
  payload: OrderUpdateInput,
): Promise<ActionResponse<OrderWithHistory>> {
  try {
    const parsed = orderUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      return updateOrderService(parsed.data, tx);
    });

    revalidatePath('/orders');
    revalidatePath(`/orders/${parsed.data.id}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in updateOrderAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể cập nhật đơn hàng.',
    };
  }
}

/**
 * Server Action: Soft delete an order.
 */
export async function deleteOrderAction(
  id: number,
  expectedUpdatedAt?: string,
): Promise<ActionResponse<{ readonly id: number }>> {
  try {
    const parsed = deleteOrderSchema.safeParse({ id, updatedAt: expectedUpdatedAt });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Mã đơn hàng không hợp lệ.',
      };
    }

    const deleted = await prisma.$transaction(async (tx) => {
      return softDeleteOrderService(parsed.data.id, parsed.data.updatedAt, tx);
    });

    revalidatePath('/orders');
    return { success: true, data: deleted };
  } catch (error) {
    console.error('Error in deleteOrderAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể xóa đơn hàng.',
    };
  }
}

/**
 * Server Action: In-place add item.
 */
export async function addOrderItemAction(
  payload: AddOrderItemValues,
): Promise<ActionResponse<OrderWithHistory>> {
  try {
    const parsed = addOrderItemSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      return addOrderItemService(
        parsed.data.orderId,
        parsed.data.item,
        parsed.data.updatedAt,
        tx,
      );
    });

    revalidatePath('/orders');
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in addOrderItemAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể thêm sản phẩm vào đơn hàng.',
    };
  }
}

/**
 * Server Action: In-place delete item (soft-delete).
 */
export async function deleteOrderItemAction(
  orderId: number,
  itemId: number,
  expectedUpdatedAt?: string,
): Promise<ActionResponse<OrderWithHistory>> {
  try {
    const parsed = deleteOrderItemSchema.safeParse({
      orderId,
      itemId,
      updatedAt: expectedUpdatedAt,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Mã đơn hàng hoặc sản phẩm không hợp lệ.',
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      return deleteOrderItemService(
        parsed.data.orderId,
        parsed.data.itemId,
        parsed.data.updatedAt,
        tx,
      );
    });

    revalidatePath('/orders');
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in deleteOrderItemAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể xóa sản phẩm khỏi đơn hàng.',
    };
  }
}

/**
 * Server Action: Fetch dropdown lookup data.
 */
export async function getOrderLookupOptionsAction(): Promise<ActionResponse<OrderLookupOptions>> {
  try {
    const [platforms, statuses, categories, customers] = await Promise.all([
      getPlatformsService(),
      getOrderStatusesService(),
      getCategoriesService(),
      getCustomerLookupListService(),
    ]);

    return {
      success: true,
      data: {
        platforms,
        statuses,
        categories,
        customers: customers.map((c) => ({
          id: c.id,
          platformBuyerId: c.platformBuyerId,
          platformName: c.platform.name,
          vipTierName: c.vipTier.name,
          vipTierCode: c.vipTier.code,
        })),
      },
    };
  } catch (error) {
    console.error('Error in getOrderLookupOptionsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải danh mục tra cứu.',
    };
  }
}
