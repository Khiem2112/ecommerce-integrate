'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUserAccessDetailAction,
  getUserAccessHistoryAction,
  getUsersAction,
  provisionUserAccessAction,
  removeUserAccessAction,
  resetUserPasswordAction,
  updateUserAccessAction,
} from '@/actions';
import type {
  UserAccessFilterValues,
  UserProvisionValues,
  UserRemoveValues,
  UserResetPasswordValues,
  UserUpdateValues,
} from '@/forms';
import type {
  MembershipRemovalResult,
  PasswordResetResult,
  UserAccessDetail,
  UserAccessHistoryResult,
  UserAccessListResult,
  UserProvisioningResult,
} from '@/types';

export function useUsers(filters: UserAccessFilterValues = {}) {
  return useQuery<UserAccessListResult>({
    queryKey: ['users', 'list', filters],
    queryFn: async () => {
      const res = await getUsersAction(filters);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi tải danh sách người dùng.');
      }
      return res.data;
    },
    placeholderData: (previous) => previous,
    staleTime: 10_000,
  });
}

export function useUserAccessDetail(userId: number | null | undefined) {
  return useQuery<UserAccessDetail>({
    queryKey: ['users', 'detail', userId],
    queryFn: async () => {
      if (!userId || userId <= 0) {
        throw new Error('Mã người dùng không hợp lệ.');
      }
      const res = await getUserAccessDetailAction(userId);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi lấy thông tin thành viên.');
      }
      return res.data;
    },
    enabled: Boolean(userId && userId > 0),
    staleTime: 10_000,
  });
}

export function useUserAccessHistory(
  userId: number | null | undefined,
  page = 1,
  limit = 20,
) {
  return useQuery<UserAccessHistoryResult>({
    queryKey: ['users', 'history', userId, page, limit],
    queryFn: async () => {
      if (!userId || userId <= 0) {
        throw new Error('Mã người dùng không hợp lệ.');
      }
      const res = await getUserAccessHistoryAction(userId, page, limit);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi lấy lịch sử hoạt động.');
      }
      return res.data;
    },
    enabled: Boolean(userId && userId > 0),
    staleTime: 10_000,
  });
}

export function useProvisionUserAccess() {
  const queryClient = useQueryClient();

  return useMutation<UserProvisioningResult, Error, UserProvisionValues>({
    mutationFn: async (input) => {
      const res = await provisionUserAccessAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi thêm người dùng.');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useUpdateUserAccess() {
  const queryClient = useQueryClient();

  return useMutation<UserAccessDetail, Error, UserUpdateValues>({
    mutationFn: async (input) => {
      const res = await updateUserAccessAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi cập nhật thành viên.');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'detail', data.userId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'history', data.userId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation<PasswordResetResult, Error, UserResetPasswordValues>({
    mutationFn: async (input) => {
      const res = await resetUserPasswordAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi đặt lại mật khẩu.');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users', 'detail', data.userId] });
      queryClient.invalidateQueries({ queryKey: ['users', 'history', data.userId] });
    },
  });
}

export function useRemoveUserAccess() {
  const queryClient = useQueryClient();

  return useMutation<MembershipRemovalResult, Error, UserRemoveValues>({
    mutationFn: async (input) => {
      const res = await removeUserAccessAction(input);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Lỗi khi gỡ quyền thành viên.');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
