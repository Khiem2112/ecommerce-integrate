'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  getCustomersPaginatedService,
  getCustomerDetailService,
  updateCustomerService,
  getPlatformsService,
  getVipTiersService,
} from '@/services';
import {
  customerFilterSchema,
  customerUpdateSchema,
  getCustomerSchema,
  type CustomerUpdateFormValues,
} from '@/forms';
import type {
  ActionResponse,
  CustomerFilterParams,
  CustomerListResponse,
  CustomerFullDetail,
  CustomerWithRelations,
  CustomerLookupOptions,
} from '@/types';

/**
 * Server Action: Fetch paginated customer list with filters.
 */
export async function getCustomersAction(
  filters: CustomerFilterParams = {},
): Promise<ActionResponse<CustomerListResponse>> {
  try {
    const parsed = customerFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Bộ lọc khách hàng không hợp lệ.',
      };
    }

    const data = await getCustomersPaginatedService(parsed.data);
    return { success: true, data };
  } catch (error) {
    console.error('Error in getCustomersAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải danh sách khách hàng.',
    };
  }
}

/**
 * Server Action: Fetch full 360-degree customer dossier by ID.
 */
export async function getCustomerAction(
  id: number,
): Promise<ActionResponse<CustomerFullDetail>> {
  try {
    const parsed = getCustomerSchema.safeParse({ id });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Mã khách hàng không hợp lệ.',
      };
    }

    const data = await getCustomerDetailService(parsed.data.id);
    if (!data) {
      return {
        success: false,
        error: 'Không tìm thấy thông tin khách hàng.',
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in getCustomerAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải hồ sơ khách hàng.',
    };
  }
}

/**
 * Server Action: Update customer profile preferences & consent.
 */
export async function updateCustomerAction(
  payload: CustomerUpdateFormValues,
): Promise<ActionResponse<CustomerWithRelations>> {
  try {
    const parsed = customerUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.',
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      return updateCustomerService(parsed.data, tx);
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${parsed.data.id}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in updateCustomerAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ khách hàng.',
    };
  }
}

/**
 * Server Action: Fetch dropdown lookups for customer filters.
 */
export async function getCustomerLookupOptionsAction(): Promise<ActionResponse<CustomerLookupOptions>> {
  try {
    const [platforms, vipTiers] = await Promise.all([
      getPlatformsService(),
      getVipTiersService(),
    ]);
    return { success: true, data: { platforms, vipTiers } };
  } catch (error) {
    console.error('Error in getCustomerLookupOptionsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải danh mục tra cứu khách hàng.',
    };
  }
}
