'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  disconnectShopConnectionAction,
  getManageableOrganizationsAction,
  getShopConnectionActivityAction,
  getShopConnectionDetailAction,
  getShopConnectionsAction,
  reassignShopConnectionAction,
  startShopAuthorizationAction,
  updateShopConnectionLabelAction,
} from '@/actions';
import type {
  ShopConnectionDisconnectValues,
  ShopConnectionFilterInput,
  ShopConnectionLabelUpdateValues,
  ShopConnectionReassignValues,
  ShopConnectionStartAuthorizationValues,
} from '@/forms';
import type {
  AuthorizationStartResult,
  ManageableOrganizationOption,
  ShopConnectionActivityPage,
  ShopConnectionDetail,
  ShopConnectionListResult,
} from '@/types';

export function useShopConnections(
  filters: ShopConnectionFilterInput = {},
): UseQueryResult<ShopConnectionListResult, Error> {
  return useQuery<ShopConnectionListResult>({
    queryKey: ['shop-connections', 'list', filters],
    queryFn: async () => {
      const res = await getShopConnectionsAction(filters);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'LOAD_SHOPS_FAILED');
      }
      return res.data;
    },
    placeholderData: (previous) => previous,
    staleTime: 20_000,
  });
}

export function useShopConnection(
  connectionId: number | null | undefined,
): UseQueryResult<ShopConnectionDetail, Error> {
  return useQuery<ShopConnectionDetail>({
    queryKey: ['shop-connections', 'detail', connectionId],
    queryFn: async () => {
      if (!connectionId || connectionId <= 0) {
        throw new Error('INVALID_CONNECTION_ID');
      }
      const res = await getShopConnectionDetailAction(connectionId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'LOAD_SHOP_DETAIL_FAILED');
      }
      return res.data;
    },
    enabled: Boolean(connectionId && connectionId > 0),
    staleTime: 10_000,
  });
}

export function useShopConnectionActivity(
  connectionId: number,
  cursor?: number,
): UseQueryResult<ShopConnectionActivityPage, Error> {
  return useQuery<ShopConnectionActivityPage>({
    queryKey: ['shop-connections', 'activity', connectionId, cursor],
    queryFn: async () => {
      const res = await getShopConnectionActivityAction(connectionId, cursor);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'LOAD_ACTIVITY_FAILED');
      }
      return res.data;
    },
    enabled: Boolean(connectionId && connectionId > 0),
    staleTime: 10_000,
  });
}

export function useManageableOrganizations(): UseQueryResult<
  readonly ManageableOrganizationOption[],
  Error
> {
  return useQuery<readonly ManageableOrganizationOption[]>({
    queryKey: ['shop-connections', 'manageable-organizations'],
    queryFn: async () => {
      const res = await getManageableOrganizationsAction();
      if (!res.success || !res.data) {
        throw new Error(res.error || 'LOAD_ORGS_FAILED');
      }
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useStartShopAuthorization(): UseMutationResult<
  AuthorizationStartResult,
  Error,
  ShopConnectionStartAuthorizationValues
> {
  return useMutation<AuthorizationStartResult, Error, ShopConnectionStartAuthorizationValues>({
    mutationFn: async (input: ShopConnectionStartAuthorizationValues) => {
      const res = await startShopAuthorizationAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'AUTH_START_FAILED');
      }
      return res.data;
    },
  });
}

export function useUpdateShopConnectionLabel(): UseMutationResult<
  ShopConnectionDetail,
  Error,
  ShopConnectionLabelUpdateValues
> {
  const queryClient = useQueryClient();

  return useMutation<ShopConnectionDetail, Error, ShopConnectionLabelUpdateValues>({
    mutationFn: async (input: ShopConnectionLabelUpdateValues) => {
      const res = await updateShopConnectionLabelAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'UPDATE_LABEL_FAILED');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'activity', data.id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useDisconnectShopConnection(): UseMutationResult<
  ShopConnectionDetail,
  Error,
  ShopConnectionDisconnectValues
> {
  const queryClient = useQueryClient();

  return useMutation<ShopConnectionDetail, Error, ShopConnectionDisconnectValues>({
    mutationFn: async (input: ShopConnectionDisconnectValues) => {
      const res = await disconnectShopConnectionAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'DISCONNECT_FAILED');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'activity', data.id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useReassignShopConnection(): UseMutationResult<
  ShopConnectionDetail,
  Error,
  ShopConnectionReassignValues
> {
  const queryClient = useQueryClient();

  return useMutation<ShopConnectionDetail, Error, ShopConnectionReassignValues>({
    mutationFn: async (input: ShopConnectionReassignValues) => {
      const res = await reassignShopConnectionAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'REASSIGN_FAILED');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'activity', data.id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
