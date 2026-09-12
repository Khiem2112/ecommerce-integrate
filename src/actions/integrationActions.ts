'use server';

/**
 * Server Actions for Channel Integrations and Order Synchronization.
 * Handles input validation, service coordination, and cache revalidation.
 */

import {
  platformSchema,
  syncParamsSchema,
  refreshOrderSchema,
  batchCodeSchema,
  syncChangeQuerySchema,
} from '@/forms';
import type {
  ActionResponse,
  ConnectionHealth,
  IntegrationSummary,
  SyncResult,
  SyncRunLog,
  PreflightSyncResult,
  FetchOrdersParams,
  ExternalOrder,
  SeedProfile,
  PlatformCode,
  SyncChangeSummary,
  SyncChangeRecord,
  OrderPreviewPage,
  OrderPreviewItemRow,
  SyncBatchProgress,
} from '@/types';
import {
  syncOrdersFromLazadaService,
  preflightLazadaSyncService,
  getPreviewOrdersPageService,
  getPreviewOrderItemsService,
  refreshOrderFromLazadaService,
  getIntegrationSummaryService,
  getSyncLogsHistoryService,
  getMockSeedsService,
  getChannelConnector,
  getSyncChangeSummaryByBatch,
  querySyncChangesByEntity,
  enqueueSyncBatchService,
  getBatchProgressService,
  getActiveBatchForPlatformService,
  cancelSyncBatchService,
  dispatchSyncWorkerAsync,
} from '@/services';
import { ensurePlatformConnectionService } from '@/services/platformConnectionService';
import { prisma } from '@/lib/prisma';


/**
 * Server Action: Retrieve overall integration summary for a platform card.
 */
export async function getIntegrationSummaryAction(
  platform: unknown = 'lazada',
): Promise<ActionResponse<IntegrationSummary>> {
  try {
    const parsed = platformSchema.safeParse(platform);
    if (!parsed.success) {
      return { success: false, error: 'Kênh sàn không hợp lệ.' };
    }

    const summary = await getIntegrationSummaryService(parsed.data);
    return { success: true, data: summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể lấy thông tin tích hợp sàn.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Trigger an active health check probe.
 */
export async function checkConnectionHealthAction(
  platform: unknown = 'lazada',
): Promise<ActionResponse<ConnectionHealth>> {
  try {
    const parsed = platformSchema.safeParse(platform);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Kênh sàn không hợp lệ.',
        data: {
          status: 'error',
          latencyMs: 0,
          message: 'Kênh sàn không hợp lệ.',
          lastCheckedAt: new Date(),
        },
      };
    }

    const connector = getChannelConnector(parsed.data as PlatformCode);
    const health = await connector.getConnectionHealth();
    return { success: true, data: health };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại.';
    return {
      success: false,
      error: message,
      data: {
        status: 'error',
        latencyMs: 0,
        message,
        lastCheckedAt: new Date(),
      },
    };
  }
}

/**
 * Server Action: Trigger batch synchronization of orders from Lazada.
 */
export async function syncLazadaOrdersAction(
  rawParams: unknown = {},
): Promise<ActionResponse<SyncResult>> {
  try {
    const parsed = syncParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Tham số đồng bộ không hợp lệ.',
      };
    }

    const params: FetchOrdersParams = parsed.data;
    const result = await syncOrdersFromLazadaService(params);

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Đồng bộ đơn hàng thất bại.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Enqueues background synchronization and returns immediately (< 100ms).
 */
export async function startQueuedSyncOrdersAction(
  platform: unknown = 'lazada',
  rawParams: unknown = {},
): Promise<ActionResponse<{ readonly syncId: string; readonly batchCode: string; readonly status: 'queued' }>> {
  try {
    const platformParsed = platformSchema.safeParse(platform);
    if (!platformParsed.success) {
      return { success: false, error: 'Kênh sàn không hợp lệ.' };
    }

    const parsed = syncParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Tham số đồng bộ không hợp lệ.',
      };
    }

    const platformRecord = await prisma.platformCatalog.findUnique({
      where: { code: platformParsed.data },
    });
    if (!platformRecord) {
      return { success: false, error: 'Không tìm thấy kênh sàn trên hệ thống.' };
    }

    const connection = await ensurePlatformConnectionService(platformRecord.id, prisma);

    // Preflight check to estimate total count
    let estimatedTotal = 0;
    try {
      const preflight = await preflightLazadaSyncService(parsed.data);
      estimatedTotal = preflight.totalCount;
    } catch {
      // Non-critical fallback
    }

    // Enqueue batch in MySQL
    const { batchCode } = await enqueueSyncBatchService(
      connection.id,
      parsed.data,
      estimatedTotal,
      prisma,
    );

    // Asynchronously dispatch worker in background
    dispatchSyncWorkerAsync();

    return {
      success: true,
      data: {
        syncId: batchCode,
        batchCode,
        status: 'queued',
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể khởi động tiến trình đồng bộ nền.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Polls current progress and live feed of a SyncBatch.
 */
export async function getSyncBatchProgressAction(
  batchCode: unknown,
): Promise<ActionResponse<SyncBatchProgress>> {
  try {
    const parsed = batchCodeSchema.safeParse(batchCode);
    if (!parsed.success) {
      return { success: false, error: 'Mã đợt đồng bộ không hợp lệ.' };
    }

    const progress = await getBatchProgressService(parsed.data, prisma);
    if (!progress) {
      return { success: false, error: 'Không tìm thấy thông tin tiến trình đợt đồng bộ.' };
    }

    return { success: true, data: progress };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể lấy thông tin tiến trình.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Detects whether an active sync batch is queued or running for a platform.
 */
export async function getActiveSyncBatchAction(
  platform: unknown = 'lazada',
): Promise<ActionResponse<SyncBatchProgress | null>> {
  try {
    const platformParsed = platformSchema.safeParse(platform);
    if (!platformParsed.success) {
      return { success: false, error: 'Kênh sàn không hợp lệ.' };
    }

    const active = await getActiveBatchForPlatformService(platformParsed.data, prisma);
    return { success: true, data: active };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể kiểm tra trạng thái đồng bộ.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Cancels an active or queued sync batch.
 */
export async function cancelSyncBatchAction(
  batchCode: unknown,
): Promise<ActionResponse<{ readonly cancelled: boolean }>> {
  try {
    const parsed = batchCodeSchema.safeParse(batchCode);
    if (!parsed.success) {
      return { success: false, error: 'Mã đợt đồng bộ không hợp lệ.' };
    }

    const ok = await cancelSyncBatchService(parsed.data, prisma);
    return { success: true, data: { cancelled: ok } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể hủy đợt đồng bộ.';
    return { success: false, error: message };
  }
}

/**
 * Preflight Discovery — probes order count in selected date range.
 */
export async function preflightLazadaSyncAction(
  rawParams: unknown = {},
): Promise<ActionResponse<PreflightSyncResult>> {
  try {
    const parsed = syncParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Tham số lọc ngày không hợp lệ.',
      };
    }

    const result = await preflightLazadaSyncService(parsed.data);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể thăm dò số lượng đơn hàng.';
    return { success: false, error: message };
  }
}

/**
 * Evaluates an uncommitted order preview page for the specified marketplace platform.
 * Enforces schema validation on incoming date and pagination bounds before delegating to the connector service.
 */
export async function getPreviewOrdersPageAction(
  platform: unknown = 'lazada',
  rawParams: unknown = {},
): Promise<ActionResponse<OrderPreviewPage>> {
  try {
    const platformResult = platformSchema.safeParse(platform);
    if (!platformResult.success) {
      return { success: false, error: 'Kênh sàn không hợp lệ.' };
    }

    const parsed = syncParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Tham số xem trước không hợp lệ.',
      };
    }

    const result = await getPreviewOrdersPageService(platformResult.data, parsed.data);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tải bản xem trước đơn hàng.';
    return { success: false, error: message };
  }
}

/**
 * Fetches line items for an uncommitted order row to support on-demand table expansion.
 */
export async function getPreviewOrderItemsAction(
  platform: unknown = 'lazada',
  externalOrderId: unknown = '',
): Promise<ActionResponse<readonly OrderPreviewItemRow[]>> {
  try {
    const platformResult = platformSchema.safeParse(platform);
    if (!platformResult.success) {
      return { success: false, error: 'Kênh sàn không hợp lệ.' };
    }

    if (typeof externalOrderId !== 'string' || !externalOrderId.trim()) {
      return {
        success: false,
        error: 'Mã đơn hàng không hợp lệ.',
      };
    }

    const items = await getPreviewOrderItemsService(platformResult.data, externalOrderId.trim());
    return { success: true, data: items };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tải chi tiết sản phẩm của đơn hàng.';
    return { success: false, error: message };
  }
}



/**
 * Server Action: Refresh a single order from Lazada authoritative source.
 */
export async function refreshOrderFromLazadaAction(
  payload: unknown,
): Promise<ActionResponse<{ readonly outcome: 'created' | 'updated' | 'unchanged'; readonly order: ExternalOrder }>> {
  try {
    const parsed = refreshOrderSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Mã đơn không hợp lệ.' };
    }

    const result = await refreshOrderFromLazadaService(parsed.data.externalOrderId);

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể làm mới đơn hàng từ Lazada.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Fetch recent sync runs history.
 */
export async function getSyncLogsHistoryAction(): Promise<ActionResponse<readonly SyncRunLog[]>> {
  try {
    const logs = await getSyncLogsHistoryService();
    return { success: true, data: logs };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể lấy lịch sử đồng bộ.';
    return { success: false, error: message };
  }
}

/**
 * Server Action: Fetch mock seeds available on mock server.
 */
export async function getMockSeedsAction(): Promise<ActionResponse<readonly SeedProfile[]>> {
  try {
    const seeds = await getMockSeedsService();
    return { success: true, data: seeds };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tải danh sách mock seeds.';
    return { success: false, error: message };
  }
}


/**
 * Server Action: Query sync change summary grouped by order for a batch.
 */
export async function getSyncChangeSummaryAction(
  batchCode: unknown,
): Promise<ActionResponse<SyncChangeSummary>> {
  try {
    const parsed = batchCodeSchema.safeParse(batchCode);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Mã đợt không hợp lệ.' };
    }

    const summary = await getSyncChangeSummaryByBatch(parsed.data);
    if (!summary) {
      return { success: false, error: 'Không tìm thấy đợt đồng bộ.' };
    }

    return { success: true, data: summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể tải chi tiết thay đổi.';
    return { success: false, error: message };
  }
}


/**
 * Server Action: Query sync changes by entity with pagination.
 */
export async function getSyncChangesByEntityAction(
  rawParams: unknown,
): Promise<ActionResponse<{ readonly changes: readonly SyncChangeRecord[]; readonly total: number }>> {
  try {
    const parsed = syncChangeQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Tham số truy vấn không hợp lệ.' };
    }

    const result = await querySyncChangesByEntity(parsed.data);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Không thể truy vấn lịch sử thay đổi.';
    return { success: false, error: message };
  }
}
