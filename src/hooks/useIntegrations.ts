'use client';

/**
 * React Query Hooks for Channel Integrations and Order Synchronization.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIntegrationSummaryAction,
  checkConnectionHealthAction,
  startQueuedSyncOrdersAction,
  getSyncBatchProgressAction,
  getActiveSyncBatchAction,
  cancelSyncBatchAction,
  preflightLazadaSyncAction,
  refreshOrderFromLazadaAction,
  getSyncLogsHistoryAction,
  getMockSeedsAction,
  getSyncChangeSummaryAction,
  getSyncChangesByEntityAction,
  getPreviewOrdersPageAction,
  getPreviewOrderItemsAction,
  getSyncBatchListAction,
  retrySyncBatchAction,
  getSyncBatchDetailByCodeAction,
  getSyncOrdersByChangeTypeAction,
  getSyncOrderDiffAction,
  getSyncBatchDetailProgressAction,
  retrySelectedOrdersAction,
} from '@/actions';
import type {
  FetchOrdersParams,
  IntegrationSummary,
  ConnectionHealth,
  PreflightSyncResult,
  SeedProfile,
  SyncChangeSummary,
  SyncChangeQueryParams,
  SyncChangeRecord,
  OrderPreviewPage,
  OrderPreviewItemRow,
  SyncBatchProgress,
  SyncBatchListFilter,
  SyncBatchListResponse,
  SyncBatchDetail,
  SyncOrderChangeType,
  SyncOrderListItem,
  PaginationMeta,
  SyncOrderDiff,
  SyncBatchDetailProgress,
} from '@/types';
import {
  generatePreviewCacheKey,
  getPreviewPage,
  savePreviewPage,
  getOrderItemsPreview,
  saveOrderItemsPreview,
  clearAllPreviews,
} from '@/services/client';

export const INTEGRATION_QUERY_KEYS = {
  summary: (platform: string) => ['integrations', 'summary', platform] as const,
  health: (platform: string) => ['integrations', 'health', platform] as const,
  preflight: (params: FetchOrdersParams) => ['integrations', 'preflight', params] as const,
  previewOrders: (platform: string, params: FetchOrdersParams) => ['integrations', 'preview', platform, params] as const,
  previewItems: (platform: string, externalOrderId: string) => ['integrations', 'previewItems', platform, externalOrderId] as const,
  history: () => ['integrations', 'history'] as const,
  seeds: () => ['integrations', 'seeds'] as const,
  changeSummary: (batchCode: string) => ['integrations', 'changeSummary', batchCode] as const,
  changesByEntity: (params: SyncChangeQueryParams) => ['integrations', 'changesByEntity', params] as const,
  activeBatch: (platform: string) => ['integrations', 'activeBatch', platform] as const,
  batchProgress: (batchCode: string) => ['integrations', 'batchProgress', batchCode] as const,
  syncBatchList: (filter: SyncBatchListFilter) => ['syncBatches', 'list', filter] as const,
  syncBatchDetail: (batchCode: string) => ['syncBatches', 'detail', batchCode] as const,
  syncOrdersByType: (batchId: number, changeType: string, page: number, limit: number) =>
    ['syncBatches', 'orders', batchId, changeType, page, limit] as const,
  syncOrderDiff: (batchId: number, externalOrderId: string) =>
    ['syncBatches', 'orderDiff', batchId, externalOrderId] as const,
  syncBatchDetailProgress: (batchId: number) =>
    ['syncBatches', 'detailProgress', batchId] as const,
};

export function useSyncBatchList(filter: SyncBatchListFilter, enabled: boolean = true) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.syncBatchList(filter),
    queryFn: async (): Promise<SyncBatchListResponse> => {
      const response = await getSyncBatchListAction(filter);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể tải lịch sử đồng bộ.');
      }
      return response.data;
    },
    enabled,
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
    refetchInterval: (query) =>
      query.state.data?.data.some((batch) => batch.status === 'running' || batch.status === 'queued') ? 5000 : false,
  });
}

export function useRetrySyncBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: number): Promise<{ readonly batchCode: string }> => {
      const response = await retrySyncBatchAction(batchId);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể tạo đợt thử lại.');
      }
      return { batchCode: response.data.batchCode };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['syncBatches'] }),
  });
}

export function useSyncBatchDetail(batchCode: string, enabled: boolean = true) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.syncBatchDetail(batchCode),
    queryFn: async (): Promise<SyncBatchDetail> => {
      const response = await getSyncBatchDetailByCodeAction(batchCode);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể tải chi tiết đợt đồng bộ.');
      }
      return response.data;
    },
    enabled: enabled && Boolean(batchCode),
    staleTime: 60000,
  });
}

export function useSyncOrdersByChangeType(
  batchId: number,
  changeType: SyncOrderChangeType | undefined,
  page: number,
  enabled: boolean = true,
  limit: number = 20,
) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.syncOrdersByType(batchId, changeType ?? 'all', page, limit),
    queryFn: async (): Promise<{ readonly data: readonly SyncOrderListItem[]; readonly meta: PaginationMeta }> => {
      const response = await getSyncOrdersByChangeTypeAction({ batchId, changeType, page, limit });
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể tải danh sách đơn trong đợt.');
      }
      return response.data;
    },
    enabled: enabled && batchId > 0,
    placeholderData: (previousData) => previousData,
  });
}

export function useSyncOrderDiff(batchId: number, externalOrderId: string | null) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.syncOrderDiff(batchId, externalOrderId ?? ''),
    queryFn: async (): Promise<SyncOrderDiff> => {
      const response = await getSyncOrderDiffAction({ batchId, externalOrderId });
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể tải dữ liệu đối soát.');
      }
      return response.data;
    },
    enabled: batchId > 0 && Boolean(externalOrderId),
    staleTime: 60000,
  });
}

export function useSyncBatchDetailProgress(batchId: number, enabled: boolean = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.syncBatchDetailProgress(batchId),
    queryFn: async (): Promise<SyncBatchDetailProgress> => {
      const response = await getSyncBatchDetailProgressAction(batchId);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể tải tiến trình đồng bộ.');
      }
      if (!['queued', 'running'].includes(response.data.status)) {
        queryClient.invalidateQueries({ queryKey: ['syncBatches', 'detail'] });
        queryClient.invalidateQueries({ queryKey: ['syncBatches', 'orders', batchId] });
      }
      return response.data;
    },
    enabled: enabled && batchId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 3000 : false;
    },
  });
}

export function useRetrySelectedOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      readonly batchId: number;
      readonly externalOrderIds: readonly string[];
    }): Promise<{ readonly batchCode: string }> => {
      const response = await retrySelectedOrdersAction(params);
      if (!response.success || !response.data) {
        throw new Error(response.error ?? 'Không thể thử lại các đơn đã chọn.');
      }
      return { batchCode: response.data.batchCode };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['syncBatches'] }),
  });
}



/**
 * Hook to query current integration summary and status.
 */
export function useIntegrationSummary(platform: string = 'lazada') {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.summary(platform),
    queryFn: async (): Promise<IntegrationSummary> => {
      const res = await getIntegrationSummaryAction(platform);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể tải thông tin tích hợp.');
      }
      return res.data;
    },
    staleTime: 30000,
  });
}

/**
 * Hook to probe connection health.
 */
export function useCheckConnectionHealth(platform: string = 'lazada') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<ConnectionHealth> => {
      const res = await checkConnectionHealthAction(platform);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Kiểm tra kết nối thất bại.');
      }
      return res.data;
    },
    onSuccess: (health) => {
      queryClient.setQueryData(INTEGRATION_QUERY_KEYS.summary(platform), (prev?: IntegrationSummary) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: health.status,
          latencyMs: health.latencyMs,
          lastCheckedAt:
            typeof health.lastCheckedAt === 'string'
              ? health.lastCheckedAt
              : new Date(health.lastCheckedAt).toISOString(),
          errorMessage: health.message,
        };
      });
      queryClient.invalidateQueries({ queryKey: INTEGRATION_QUERY_KEYS.summary(platform) });
    },
  });
}


/**
 * Hook to enqueue background synchronization and receive syncId immediately (< 100ms).
 */
export function useStartQueuedSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      platform = 'lazada',
      params = {},
    }: {
      platform?: string;
      params?: FetchOrdersParams;
    }): Promise<{ syncId: string; batchCode: string; status: 'queued' }> => {
      const res = await startQueuedSyncOrdersAction(platform, params);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể khởi chạy đồng bộ nền.');
      }
      return res.data;
    },
    onSuccess: (data, variables) => {
      const platform = variables.platform ?? 'lazada';
      queryClient.invalidateQueries({ queryKey: INTEGRATION_QUERY_KEYS.activeBatch(platform) });
      queryClient.invalidateQueries({ queryKey: INTEGRATION_QUERY_KEYS.batchProgress(data.batchCode) });
    },
  });
}

/**
 * Hook to check if there is an active running/queued sync batch for a platform.
 */
export function useActiveSyncBatch(platform: string = 'lazada') {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.activeBatch(platform),
    queryFn: async (): Promise<SyncBatchProgress | null> => {
      const res = await getActiveSyncBatchAction(platform);
      if (!res.success) {
        return null;
      }
      return res.data ?? null;
    },
    staleTime: 5000,
  });
}

/**
 * Hook to poll progress and live feed of an active or recent sync batch.
 * Automatically polls every 1.5s when queued or running, stops when finished.
 */
export function useSyncBatchProgress(batchCode: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.batchProgress(batchCode ?? ''),
    queryFn: async (): Promise<SyncBatchProgress | null> => {
      if (!batchCode) return null;
      const res = await getSyncBatchProgressAction(batchCode);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể lấy tiến trình đồng bộ.');
      }

      // If completed or failed, invalidate relevant queries
      if (res.data.status === 'completed' || res.data.status === 'partial') {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
      }

      return res.data;
    },
    enabled: enabled && Boolean(batchCode),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'queued' || status === 'running') {
        return 1500;
      }
      return false;
    },
  });
}

/**
 * Hook to cancel an active sync batch.
 */
export function useCancelSyncBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchCode: string): Promise<boolean> => {
      const res = await cancelSyncBatchAction(batchCode);
      if (!res.success) {
        throw new Error(res.error ?? 'Không thể hủy đợt đồng bộ.');
      }
      return res.data?.cancelled ?? false;
    },
    onSuccess: (_, batchCode) => {
      queryClient.invalidateQueries({ queryKey: INTEGRATION_QUERY_KEYS.batchProgress(batchCode) });
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

/**
 * Phase 1.25 Hook: Preflight query to probe order count in selected date range.
 */
export function usePreflightLazadaSync(params: FetchOrdersParams, enabled: boolean = true) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.preflight(params),
    queryFn: async (): Promise<PreflightSyncResult> => {
      const res = await preflightLazadaSyncAction(params);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể thăm dò đơn hàng.');
      }
      return res.data;
    },
    enabled: enabled && Boolean(params.createdAfter || params.createdBefore || params.status),
    staleTime: 30000,
  });
}

/**
 * Hook to refresh single order from Lazada.
 */
export function useRefreshOrderFromLazada() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (externalOrderId: string) => {
      const res = await refreshOrderFromLazadaAction(externalOrderId);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể làm mới đơn hàng từ Lazada.');
      }
      return res.data;
    },
    onSuccess: (_, externalOrderId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', externalOrderId] });
    },
  });
}

/**
 * Hook to fetch sync logs history.
 */
export function useSyncLogsHistory() {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.history(),
    queryFn: async () => {
      const res = await getSyncLogsHistoryAction();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể lấy lịch sử đồng bộ.');
      }
      return res.data;
    },
    refetchInterval: 15000,
  });
}

/**
 * Hook to fetch mock seeds.
 */
export function useMockSeeds() {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.seeds(),
    queryFn: async (): Promise<readonly SeedProfile[]> => {
      const res = await getMockSeedsAction();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể tải danh sách mock seeds.');
      }
      return res.data;
    },
    staleTime: 60000,
  });
}

/**
 * Fetch change summary grouped by order for a sync batch.
 */
export function useSyncChangeSummary(batchCode: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.changeSummary(batchCode ?? ''),
    queryFn: async (): Promise<SyncChangeSummary> => {
      if (!batchCode) {
        throw new Error('Mã đợt đồng bộ không hợp lệ.');
      }
      const res = await getSyncChangeSummaryAction(batchCode);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể tải chi tiết thay đổi.');
      }
      return res.data;
    },
    enabled: enabled && Boolean(batchCode),
    staleTime: 60000,
  });
}

/**
 * Query sync changes by entity (e.g. order) with pagination.
 */
export function useSyncChangesByEntity(params: SyncChangeQueryParams, enabled: boolean = true) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.changesByEntity(params),
    queryFn: async (): Promise<{ readonly changes: readonly SyncChangeRecord[]; readonly total: number }> => {
      const res = await getSyncChangesByEntityAction(params);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể truy vấn lịch sử thay đổi.');
      }
      return res.data;
    },
    enabled,
    staleTime: 30000,
  });
}

/**
 * Hook to retrieve an uncommitted preview page with client-side IndexedDB caching.
 * Protects channel rate limits by returning cached pages unless a force-refresh is requested.
 */
export function useOrderPreview(
  platform: string = 'lazada',
  params: FetchOrdersParams = {},
  options: { enabled?: boolean; forceRefresh?: boolean } = {},
) {
  const { enabled = false, forceRefresh = false } = options;
  const cacheKey = generatePreviewCacheKey({ platform, ...params });

  return useQuery({
    queryKey: [...INTEGRATION_QUERY_KEYS.previewOrders(platform, params), { forceRefresh }],
    queryFn: async (): Promise<OrderPreviewPage> => {
      if (!forceRefresh) {
        const cached = await getPreviewPage(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const res = await getPreviewOrdersPageAction(platform, params);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể tải bản xem trước đơn hàng.');
      }

      await savePreviewPage(cacheKey, res.data, 120);
      return res.data;
    },
    enabled,
    staleTime: 60000,
  });
}

/**
 * Hook to lazy-load un-synced line items with browser-level caching.
 */
export function useOrderItemsPreview(
  platform: string = 'lazada',
  externalOrderId: string = '',
  enabled: boolean = false,
) {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEYS.previewItems(platform, externalOrderId),
    queryFn: async (): Promise<readonly OrderPreviewItemRow[]> => {
      const cached = await getOrderItemsPreview(platform, externalOrderId);
      if (cached && cached.length > 0) {
        return cached;
      }

      const res = await getPreviewOrderItemsAction(platform, externalOrderId);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Không thể tải chi tiết sản phẩm.');
      }

      await saveOrderItemsPreview(platform, externalOrderId, res.data, 120);
      return res.data;
    },
    enabled: enabled && Boolean(externalOrderId),
    staleTime: 120000,
  });
}

/**
 * Clears local browser preview cache and invalidates active preview queries.
 */
export function useClearOrderPreviewCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await clearAllPreviews();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['integrations', 'preview'],
      });
      queryClient.invalidateQueries({
        queryKey: ['integrations', 'previewItems'],
      });
    },
  });
}
