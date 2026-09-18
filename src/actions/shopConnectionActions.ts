'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  shopConnectionDisconnectSchema,
  shopConnectionFilterSchema,
  shopConnectionLabelUpdateSchema,
  shopConnectionReassignSchema,
  shopConnectionStartAuthorizationSchema,
  type ShopConnectionDisconnectValues,
  type ShopConnectionFilterInput,
  type ShopConnectionFilterValues,
  type ShopConnectionLabelUpdateValues,
  type ShopConnectionReassignValues,
  type ShopConnectionStartAuthorizationValues,
} from '@/forms';
import {
  getShopConnectionDetailForUserService,
  listAdminManagedOrganizationsForUserService,
  listShopConnectionActivityForUserService,
  listShopConnectionsForUserService,
  requestShopConnectionDisconnectService,
  requestShopConnectionReassignmentService,
  resolveShopConnectionActorService,
  startShopAuthorizationService,
  updateShopConnectionLabelForUserService,
  type ShopConnectionActor,
} from '@/services';
import type {
  ActionResponse,
  AuthorizationStartResult,
  ManageableOrganizationOption,
  ShopConnectionActivityPage,
  ShopConnectionDetail,
  ShopConnectionListResult,
} from '@/types';

function actionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Thao tác gian hàng thất bại.';
}

async function resolveCurrentUser(): Promise<ShopConnectionActor> {
  return resolveShopConnectionActorService(prisma);
}

export async function getShopConnectionsAction(
  filters: ShopConnectionFilterInput = {},
): Promise<ActionResponse<ShopConnectionListResult>> {
  try {
    const parsed = shopConnectionFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Bộ lọc danh sách gian hàng không hợp lệ.',
      };
    }

    const actor = await resolveCurrentUser();
    const result = await listShopConnectionsForUserService(actor, parsed.data, prisma);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function getShopConnectionDetailAction(
  connectionId: number,
): Promise<ActionResponse<ShopConnectionDetail>> {
  try {
    if (!connectionId || connectionId <= 0) {
      return { success: false, error: 'Mã kết nối không hợp lệ.' };
    }

    const actor = await resolveCurrentUser();
    const result = await getShopConnectionDetailForUserService(actor, connectionId, prisma);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function getShopConnectionActivityAction(
  connectionId: number,
  cursor?: number,
): Promise<ActionResponse<ShopConnectionActivityPage>> {
  try {
    if (!connectionId || connectionId <= 0) {
      return { success: false, error: 'Mã kết nối không hợp lệ.' };
    }

    const actor = await resolveCurrentUser();
    const result = await listShopConnectionActivityForUserService(
      actor,
      connectionId,
      cursor,
      20,
      prisma,
    );
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function startShopAuthorizationAction(
  input: ShopConnectionStartAuthorizationValues,
): Promise<ActionResponse<AuthorizationStartResult>> {
  try {
    const parsed = shopConnectionStartAuthorizationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Thông tin bắt đầu xác thực không hợp lệ.',
      };
    }

    const actor = await resolveCurrentUser();
    const result = await startShopAuthorizationService(actor, parsed.data, prisma);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function updateShopConnectionLabelAction(
  input: ShopConnectionLabelUpdateValues,
): Promise<ActionResponse<ShopConnectionDetail>> {
  try {
    const parsed = shopConnectionLabelUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Thông tin cập nhật nhãn không hợp lệ.',
      };
    }

    const actor = await resolveCurrentUser();
    const result = await updateShopConnectionLabelForUserService(actor, parsed.data, prisma);

    revalidatePath('/shops');
    revalidatePath(`/shops/${input.connectionId}`);
    revalidatePath('/organizations');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function disconnectShopConnectionAction(
  input: ShopConnectionDisconnectValues,
): Promise<ActionResponse<ShopConnectionDetail>> {
  try {
    const parsed = shopConnectionDisconnectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Thông tin ngắt kết nối không hợp lệ.',
      };
    }

    const actor = await resolveCurrentUser();
    const result = await requestShopConnectionDisconnectService(actor, parsed.data, prisma);

    revalidatePath('/shops');
    revalidatePath(`/shops/${input.connectionId}`);
    revalidatePath('/organizations');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function reassignShopConnectionAction(
  input: ShopConnectionReassignValues,
): Promise<ActionResponse<ShopConnectionDetail>> {
  try {
    const parsed = shopConnectionReassignSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Thông tin chuyển tổ chức không hợp lệ.',
      };
    }

    const actor = await resolveCurrentUser();
    const result = await requestShopConnectionReassignmentService(actor, parsed.data, prisma);

    revalidatePath('/shops');
    revalidatePath(`/shops/${input.connectionId}`);
    revalidatePath('/organizations');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function getManageableOrganizationsAction(): Promise<
  ActionResponse<readonly ManageableOrganizationOption[]>
> {
  try {
    const actor = await resolveCurrentUser();
    const result = await listAdminManagedOrganizationsForUserService(actor, prisma);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}
