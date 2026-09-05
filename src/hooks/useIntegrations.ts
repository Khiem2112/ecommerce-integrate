'use client';

/**
 * React Query Hooks for Channel Integrations and Order Synchronization.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIntegrationSummaryAction,
  checkConnectionHealthAction,
  syncLazadaOrdersAction,
  preflightLazadaSyncAction,
  refreshOrderFromLazadaAction,
  getSyncLogsHistoryAction,
  getMockSeedsAction,
} from '@/actions';
import type { FetchOrdersParams, IntegrationSummary, ConnectionHealth, SyncResult, PreflightSyncResult, SeedProfile } from '@/types';

export const INTEGRATION_QUERY_KEYS = {
  summary: (platform: string) => ['integrations', 'summary', platform] as const,
  health: (platform: string) => ['integrations', 'health', platform] as const,
  preflight: (params: FetchOrdersParams) => ['integrations', 'preflight', params] as const,
  history: () => ['integrations', 'history'] as const,
  seeds: () => ['integrations', 'seeds'] as const,
};

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
 * Hook to trigger batch order synchronization.
 */
export function useSyncLazadaOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: FetchOrdersParams): Promise<SyncResult> => {
      const res = await syncLazadaOrdersAction(params);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Đồng bộ đơn hàng thất bại.');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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
