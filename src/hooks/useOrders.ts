'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrdersAction,
  getOrderAction,
  createOrderAction,
  updateOrderAction,
  deleteOrderAction,
  addOrderItemAction,
  deleteOrderItemAction,
  getOrderLookupOptionsAction,
} from '@/actions';
import type {
  OrderFilterParams,
  OrderListResponse,
  OrderWithHistory,
  OrderLookupOptions,
} from '@/types';
import type {
  OrderFormValues,
  OrderUpdateInput,
  AddOrderItemValues,
} from '@/forms';

/**
 * Fetch paginated list of orders with filter criteria.
 */
export function useOrders(filters: OrderFilterParams) {
  return useQuery<OrderListResponse>({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const res = await getOrdersAction(filters);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh sách đơn hàng');
      }
      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}

/**
 * Fetch single order by ID with relations and history.
 */
export function useOrder(id: number | null | undefined) {
  return useQuery<OrderWithHistory>({
    queryKey: ['order', id],
    queryFn: async () => {
      if (!id) throw new Error('Mã đơn hàng không hợp lệ');
      const res = await getOrderAction(id);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải chi tiết đơn hàng');
      }
      return res.data;
    },
    enabled: Boolean(id && !Number.isNaN(id)),
    staleTime: 10000,
  });
}

/**
 * Fetch dropdown options for orders (platforms, statuses, customers, categories).
 */
export function useOrderLookups() {
  return useQuery<OrderLookupOptions>({
    queryKey: ['orderLookups'],
    queryFn: async () => {
      const res = await getOrderLookupOptionsAction();
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh mục tra cứu');
      }
      return res.data;
    },
    staleTime: 300000, // 5 minutes cache
  });
}

/**
 * Mutation hook for creating a new order.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OrderFormValues) => {
      const res = await createOrderAction(payload);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Tạo đơn hàng thất bại');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/**
 * Unified mutation hook for updating an existing order (Full or Partial updates).
 */
export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: OrderUpdateInput) => {
      const res = await updateOrderAction(payload);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Cập nhật đơn hàng thất bại');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      queryClient.invalidateQueries({ queryKey: ['customerContext'] });
    },
  });
}

/**
 * Mutation hook for soft deleting an order.
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updatedAt }: { readonly id: number; readonly updatedAt?: string }) => {
      const res = await deleteOrderAction(id, updatedAt);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Xóa đơn hàng thất bại');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      queryClient.invalidateQueries({ queryKey: ['customerContext'] });
    },
  });
}

/**
 * Mutation hook for adding a line item in-place.
 */
export function useAddOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddOrderItemValues) => {
      const res = await addOrderItemAction(payload);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Thêm sản phẩm thất bại');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      queryClient.invalidateQueries({ queryKey: ['customerContext'] });
    },
  });
}

/**
 * Mutation hook for deleting a line item in-place.
 */
export function useDeleteOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      itemId,
      updatedAt,
    }: {
      readonly orderId: number;
      readonly itemId: number;
      readonly updatedAt?: string;
    }) => {
      const res = await deleteOrderItemAction(orderId, itemId, updatedAt);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Xóa sản phẩm thất bại');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      queryClient.invalidateQueries({ queryKey: ['customerContext'] });
    },
  });
}
