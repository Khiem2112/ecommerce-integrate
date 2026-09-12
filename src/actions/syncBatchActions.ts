'use server';

import { revalidatePath } from 'next/cache';
import {
  retrySelectedSyncOrdersSchema,
  syncBatchIdSchema,
  syncBatchListFilterSchema,
  syncOrderDiffQuerySchema,
  syncOrdersQuerySchema,
} from '@/forms';
import { prisma } from '@/lib/prisma';
import {
  dispatchSyncWorkerAsync,
  getSyncBatchDetailByCodeService,
  getSyncBatchDetailProgressService,
  getSyncBatchDetailService,
  getSyncBatchListService,
  getSyncOrderDiffService,
  getSyncOrderListService,
  retrySelectedOrdersService,
  retrySyncBatchService,
} from '@/services';
import type {
  ActionResponse,
  PaginationMeta,
  SyncBatchDetail,
  SyncBatchDetailProgress,
  SyncBatchListResponse,
  SyncOrderDiff,
  SyncOrderListItem,
} from '@/types';

const CURRENT_OPERATOR = 'integration_operator';

export async function getSyncBatchListAction(
  rawFilter: unknown,
): Promise<ActionResponse<SyncBatchListResponse>> {
  try {
    const parsed = syncBatchListFilterSchema.safeParse(rawFilter);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Bộ lọc không hợp lệ.' };
    }
    return { success: true, data: await getSyncBatchListService(parsed.data) };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải lịch sử đồng bộ.',
    };
  }
}

export async function retrySyncBatchAction(
  batchId: unknown,
): Promise<ActionResponse<{ readonly batchCode: string; readonly status: 'queued' }>> {
  try {
    const parsed = syncBatchIdSchema.safeParse(batchId);
    if (!parsed.success) return { success: false, error: 'Mã đợt đồng bộ không hợp lệ.' };

    const child = await prisma.$transaction((tx) =>
      retrySyncBatchService(parsed.data, CURRENT_OPERATOR, tx),
    );
    dispatchSyncWorkerAsync();
    revalidatePath('/settings/integrations/lazada/syncs');
    return { success: true, data: { batchCode: child.batchCode, status: 'queued' } };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tạo đợt thử lại.',
    };
  }
}

export async function getSyncBatchDetailAction(
  batchId: unknown,
): Promise<ActionResponse<SyncBatchDetail>> {
  try {
    const parsed = syncBatchIdSchema.safeParse(batchId);
    if (!parsed.success) return { success: false, error: 'Mã đợt đồng bộ không hợp lệ.' };
    const detail = await getSyncBatchDetailService(parsed.data);
    return detail
      ? { success: true, data: detail }
      : { success: false, error: 'Không tìm thấy đợt đồng bộ.' };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải chi tiết đợt đồng bộ.',
    };
  }
}

export async function getSyncBatchDetailByCodeAction(
  batchCode: unknown,
): Promise<ActionResponse<SyncBatchDetail>> {
  try {
    if (typeof batchCode !== 'string' || !batchCode.trim()) {
      return { success: false, error: 'Mã đợt đồng bộ không hợp lệ.' };
    }
    const detail = await getSyncBatchDetailByCodeService(batchCode.trim());
    return detail
      ? { success: true, data: detail }
      : { success: false, error: 'Không tìm thấy đợt đồng bộ.' };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải chi tiết đợt đồng bộ.',
    };
  }
}

export async function getSyncOrdersByChangeTypeAction(
  rawParams: unknown,
): Promise<ActionResponse<{ readonly data: readonly SyncOrderListItem[]; readonly meta: PaginationMeta }>> {
  try {
    const parsed = syncOrdersQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Tham số truy vấn không hợp lệ.' };
    }
    const result = await getSyncOrderListService(
      parsed.data.batchId,
      parsed.data.changeType,
      parsed.data.page,
      parsed.data.limit,
    );
    return { success: true, data: result };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải danh sách đơn trong đợt.',
    };
  }
}

export async function getSyncOrderDiffAction(
  rawParams: unknown,
): Promise<ActionResponse<SyncOrderDiff>> {
  try {
    const parsed = syncOrderDiffQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Đơn hàng không hợp lệ.' };
    }
    const result = await getSyncOrderDiffService(
      parsed.data.batchId,
      parsed.data.externalOrderId,
    );
    return result
      ? { success: true, data: result }
      : { success: false, error: 'Không tìm thấy dữ liệu đối soát của đơn hàng.' };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải dữ liệu đối soát.',
    };
  }
}

export async function getSyncBatchDetailProgressAction(
  batchId: unknown,
): Promise<ActionResponse<SyncBatchDetailProgress>> {
  try {
    const parsed = syncBatchIdSchema.safeParse(batchId);
    if (!parsed.success) return { success: false, error: 'Mã đợt đồng bộ không hợp lệ.' };
    const progress = await getSyncBatchDetailProgressService(parsed.data);
    return progress
      ? { success: true, data: progress }
      : { success: false, error: 'Không tìm thấy tiến trình đồng bộ.' };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể tải tiến trình đồng bộ.',
    };
  }
}

export async function retrySelectedOrdersAction(
  rawParams: unknown,
): Promise<ActionResponse<{ readonly batchCode: string; readonly status: 'queued' }>> {
  try {
    const parsed = retrySelectedSyncOrdersSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Danh sách đơn thử lại không hợp lệ.' };
    }
    const result = await prisma.$transaction((tx) =>
      retrySelectedOrdersService(
        parsed.data.batchId,
        parsed.data.externalOrderIds,
        CURRENT_OPERATOR,
        tx,
      ),
    );
    dispatchSyncWorkerAsync();
    revalidatePath('/settings/integrations/lazada/syncs');
    return { success: true, data: { batchCode: result.batchCode, status: 'queued' } };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể thử lại các đơn đã chọn.',
    };
  }
}
