'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeOrganizationLifecycleAction,
  createOrganizationAction,
  getActiveOrganizationContextAction,
  getMockUsersAction,
  getOrganizationDetailAction,
  getOrganizationsAction,
  mutateOrganizationMemberAction,
  switchActiveOrganizationAction,
  updateOrganizationAction,
} from '@/actions';
import type {
  OrganizationCreateValues,
  OrganizationLifecycleValues,
  OrganizationMemberValues,
  OrganizationUpdateValues,
} from '@/forms';
import type {
  ActiveOrganizationContext,
  MockUserOption,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationListResult,
} from '@/types';

export function useOrganizations(filters: OrganizationFilters) {
  return useQuery<OrganizationListResult>({
    queryKey: ['organizations', 'list', filters],
    queryFn: async () => {
      const res = await getOrganizationsAction(filters);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh sách tổ chức');
      }
      return res.data;
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

export function useOrganization(organizationId: number | null | undefined) {
  return useQuery<OrganizationDetail>({
    queryKey: ['organizations', 'detail', organizationId],
    queryFn: async () => {
      if (!organizationId || organizationId <= 0) {
        throw new Error('Mã tổ chức không hợp lệ');
      }
      const res = await getOrganizationDetailAction(organizationId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải thông tin tổ chức');
      }
      return res.data;
    },
    enabled: Boolean(organizationId && organizationId > 0),
    staleTime: 10_000,
  });
}

export function useActiveOrganizationContext() {
  return useQuery<ActiveOrganizationContext>({
    queryKey: ['organizations', 'active-context'],
    queryFn: async () => {
      const res = await getActiveOrganizationContextAction();
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải thông tin tổ chức đang chọn');
      }
      return res.data;
    },
    staleTime: 10_000,
  });
}

export function useMockUsers() {
  return useQuery<readonly MockUserOption[]>({
    queryKey: ['organizations', 'mock-users'],
    queryFn: async () => {
      const res = await getMockUsersAction();
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh sách người dùng mẫu');
      }
      return res.data;
    },
    staleTime: 300_000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrganizationCreateValues) => {
      const res = await createOrganizationAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Tạo tổ chức thất bại');
      }
      return res.data;
    },
    onSuccess: (organization) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.setQueryData(
        ['organizations', 'detail', organization.id],
        organization,
      );
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrganizationUpdateValues) => {
      const res = await updateOrganizationAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Cập nhật tổ chức thất bại');
      }
      return res.data;
    },
    onSuccess: (organization) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] });
      queryClient.setQueryData(
        ['organizations', 'detail', organization.id],
        organization,
      );
    },
  });
}

export function useSwitchActiveOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: number) => {
      const res = await switchActiveOrganizationAction(organizationId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Chuyển đổi tổ chức thất bại');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.invalidateQueries();
    },
  });
}

export function useMutateOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrganizationMemberValues) => {
      const res = await mutateOrganizationMemberAction(input);
      if (!res.success) {
        throw new Error(res.error || 'Cập nhật thành viên tổ chức thất bại');
      }
      return res.data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({
        queryKey: ['organizations', 'detail', input.organizationId],
      });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] });
    },
  });
}

export function useChangeOrganizationLifecycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrganizationLifecycleValues) => {
      const res = await changeOrganizationLifecycleAction(input);
      if (!res.success) {
        throw new Error(res.error || 'Thay đổi trạng thái tổ chức thất bại');
      }
      return res.data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({
        queryKey: ['organizations', 'detail', input.organizationId],
      });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'list'] });
      queryClient.invalidateQueries({
        queryKey: ['organizations', 'active-context'],
      });
    },
  });
}
