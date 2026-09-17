'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { AUTH_CONFIG } from '@/config/authentication';
import {
  userAccessFilterSchema,
  userProvisionSchema,
  userRemoveSchema,
  userResetPasswordSchema,
  userUpdateSchema,
  type UserAccessFilterValues,
  type UserProvisionValues,
  type UserRemoveValues,
  type UserResetPasswordValues,
  type UserUpdateValues,
} from '@/forms';
import { prisma } from '@/lib/prisma';
import {
  getActiveOrganizationContextService,
  getAuthenticatedSessionContextService,
  getCurrentMockUserService,
  getUserAccessDetailService,
  listUserAccessHistoryService,
  listUsersForActiveOrganizationService,
  provisionUserAccessService,
  removeUserAccessService,
  resetUserPasswordService,
  updateUserAccessService,
} from '@/services';
import type {
  ActionResponse,
  MembershipRemovalResult,
  PasswordResetResult,
  UserAccessDetail,
  UserAccessHistoryResult,
  UserAccessListResult,
  UserProvisioningResult,
} from '@/types';

function actionError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
}

async function resolveActorAndOrganization(): Promise<{
  actorUserId: number;
  activeOrgId: number;
}> {
  const authContext = await getAuthenticatedSessionContextService().catch(() => null);
  let userId: number;
  if (authContext?.user?.id) {
    userId = authContext.user.id;
  } else {
    const mockUser = await getCurrentMockUserService();
    userId = mockUser.id;
  }

  const cookieStore = await cookies();
  const orgCookie = cookieStore.get(AUTH_CONFIG.ACTIVE_ORG_COOKIE_NAME)?.value;
  const requestedOrgId = orgCookie ? parseInt(orgCookie, 10) : null;
  const activeOrg = await getActiveOrganizationContextService(userId, requestedOrgId);

  if (!activeOrg.organizationId) {
    throw new Error('Chưa chọn tổ chức làm việc.');
  }

  return { actorUserId: userId, activeOrgId: activeOrg.organizationId };
}

export async function getUsersAction(
  filters: UserAccessFilterValues = {},
): Promise<ActionResponse<UserAccessListResult>> {
  try {
    const parsed = userAccessFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Bộ lọc không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();
    const data = await listUsersForActiveOrganizationService(
      actorUserId,
      activeOrgId,
      parsed.data,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi tải danh sách người dùng.'),
    };
  }
}

export async function getUserAccessDetailAction(
  userId: number,
): Promise<ActionResponse<UserAccessDetail>> {
  try {
    if (!userId || userId <= 0) {
      return {
        success: false,
        error: 'Mã người dùng không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();
    const data = await getUserAccessDetailService(actorUserId, activeOrgId, userId);

    if (!data) {
      return {
        success: false,
        error: 'Thành viên không tồn tại trong tổ chức này.',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi lấy thông tin thành viên.'),
    };
  }
}

export async function getUserAccessHistoryAction(
  userId: number,
  page = 1,
  limit = 20,
): Promise<ActionResponse<UserAccessHistoryResult>> {
  try {
    if (!userId || userId <= 0) {
      return {
        success: false,
        error: 'Mã người dùng không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();
    const data = await listUserAccessHistoryService(
      actorUserId,
      activeOrgId,
      userId,
      page,
      limit,
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi lấy lịch sử hoạt động.'),
    };
  }
}

export async function provisionUserAccessAction(
  input: UserProvisionValues,
): Promise<ActionResponse<UserProvisioningResult>> {
  try {
    const parsed = userProvisionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Dữ liệu cấp quyền không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();

    const result = await prisma.$transaction(async (tx) => {
      return await provisionUserAccessService(
        actorUserId,
        activeOrgId,
        parsed.data,
        tx,
      );
    });

    revalidatePath('/users');
    revalidatePath('/organizations');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi thêm người dùng.'),
    };
  }
}

export async function updateUserAccessAction(
  input: UserUpdateValues,
): Promise<ActionResponse<UserAccessDetail>> {
  try {
    const parsed = userUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Dữ liệu cập nhật không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();

    const result = await prisma.$transaction(async (tx) => {
      return await updateUserAccessService(
        actorUserId,
        activeOrgId,
        parsed.data,
        tx,
      );
    });

    revalidatePath('/users');
    revalidatePath(`/users/${input.userId}`);
    revalidatePath('/organizations');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi cập nhật thành viên.'),
    };
  }
}

export async function resetUserPasswordAction(
  input: UserResetPasswordValues,
): Promise<ActionResponse<PasswordResetResult>> {
  try {
    const parsed = userResetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Dữ liệu đặt lại mật khẩu không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();

    const result = await prisma.$transaction(async (tx) => {
      return await resetUserPasswordService(
        actorUserId,
        activeOrgId,
        parsed.data,
        tx,
      );
    });

    revalidatePath(`/users/${input.userId}`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi đặt lại mật khẩu.'),
    };
  }
}

export async function removeUserAccessAction(
  input: UserRemoveValues,
): Promise<ActionResponse<MembershipRemovalResult>> {
  try {
    const parsed = userRemoveSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Dữ liệu gỡ quyền không hợp lệ.',
      };
    }

    const { actorUserId, activeOrgId } = await resolveActorAndOrganization();

    const result = await prisma.$transaction(async (tx) => {
      return await removeUserAccessService(
        actorUserId,
        activeOrgId,
        parsed.data,
        tx,
      );
    });

    revalidatePath('/users');
    revalidatePath(`/users/${input.userId}`);
    revalidatePath('/organizations');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, 'Lỗi khi gỡ quyền thành viên.'),
    };
  }
}
