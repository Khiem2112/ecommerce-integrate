'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomersAction,
  getCustomerAction,
  updateCustomerAction,
  getCustomerLookupOptionsAction,
} from '@/actions';
import type {
  CustomerFilterParams,
  CustomerListResponse,
  CustomerFullDetail,
  CustomerLookupOptions,
} from '@/types';
import type { CustomerUpdateFormValues } from '@/forms';

/**
 * Fetch paginated list of customers with filter criteria.
 */
export function useCustomers(filters: CustomerFilterParams) {
  return useQuery<CustomerListResponse>({
    queryKey: ['customers', filters],
    queryFn: async () => {
      const res = await getCustomersAction(filters);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh sách khách hàng');
      }
      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}

/**
 * Fetch full 360-degree customer dossier by ID.
 */
export function useCustomer(id: number | null | undefined) {
  return useQuery<CustomerFullDetail>({
    queryKey: ['customer', id],
    queryFn: async () => {
      if (!id) throw new Error('Mã khách hàng không hợp lệ');
      const res = await getCustomerAction(id);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải hồ sơ khách hàng');
      }
      return res.data;
    },
    enabled: Boolean(id && !Number.isNaN(id)),
    staleTime: 10000,
  });
}

/**
 * Fetch dropdown options for customer filters (Platforms, VIP Tiers).
 */
export function useCustomerLookups() {
  return useQuery<CustomerLookupOptions>({
    queryKey: ['customerLookups'],
    queryFn: async () => {
      const res = await getCustomerLookupOptionsAction();
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh mục tra cứu khách hàng');
      }
      return res.data;
    },
    staleTime: 300000, // 5 minutes cache
  });
}

/**
 * Mutation hook for updating customer profile details.
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CustomerUpdateFormValues) => {
      const res = await updateCustomerAction(payload);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Cập nhật hồ sơ khách hàng thất bại');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
      queryClient.invalidateQueries({ queryKey: ['customerContext'] });
    },
  });
}
