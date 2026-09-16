'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  organizationCreateSchema,
  organizationFilterSchema,
  organizationIdSchema,
  organizationLifecycleSchema,
  organizationMemberSchema,
  organizationUpdateSchema,
  type OrganizationCreateValues,
  type OrganizationLifecycleValues,
  type OrganizationMemberValues,
  type OrganizationUpdateValues,
} from '@/forms';
import {
  changeOrganizationLifecycleService,
  createOrganizationForUserService,
  getActiveOrganizationContextService,
  getCurrentMockUserService,
  getMockUsersService,
  getOrganizationDetailForUserService,
  listOrganizationsForUserService,
  mutateOrganizationMembershipService,
  switchActiveOrganizationContextService,
  updateOrganizationForUserService,
} from '@/services';
import type {
  ActionResponse,
  ActiveOrganizationContext,
  MockUserOption,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationListResult,
} from '@/types';

function actionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Organization operation failed.';
}

export async function getOrganizationsAction(
  filters: OrganizationFilters = {},
): Promise<ActionResponse<OrganizationListResult>> {
  try {
    const parsed = organizationFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid organization filters.',
      };
    }

    const user = await getCurrentMockUserService();
    const data = await listOrganizationsForUserService(user.id, parsed.data);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function getOrganizationDetailAction(
  id: number,
): Promise<ActionResponse<OrganizationDetail>> {
  try {
    const parsed = organizationIdSchema.safeParse({ id });
    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid organization identifier.',
      };
    }

    const user = await getCurrentMockUserService();
    const data = await getOrganizationDetailForUserService(
      user.id,
      parsed.data.id,
    );

    if (!data) {
      return {
        success: false,
        error: 'Organization is unavailable.',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function getActiveOrganizationContextAction(): Promise<
  ActionResponse<ActiveOrganizationContext>
> {
  try {
    const user = await getCurrentMockUserService();
    const data = await getActiveOrganizationContextService(user.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function getMockUsersAction(): Promise<
  ActionResponse<readonly MockUserOption[]>
> {
  try {
    const data = await getMockUsersService();

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function createOrganizationAction(
  input: OrganizationCreateValues,
): Promise<ActionResponse<OrganizationDetail>> {
  try {
    const parsed = organizationCreateSchema.safeParse({
      ...input,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid organization data.',
      };
    }

    const user = await getCurrentMockUserService();
    const data = await prisma.$transaction(async (tx) => {
      return await createOrganizationForUserService(user.id, parsed.data, tx);
    });

    revalidatePath('/organizations');

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function updateOrganizationAction(
  input: OrganizationUpdateValues,
): Promise<ActionResponse<OrganizationDetail>> {
  try {
    const parsed = organizationUpdateSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid organization data.',
      };
    }

    const user = await getCurrentMockUserService();
    const data = await prisma.$transaction(async (tx) => {
      return await updateOrganizationForUserService(user.id, parsed.data, tx);
    });

    revalidatePath('/organizations');
    revalidatePath(`/organizations/${input.id}`);

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function switchActiveOrganizationAction(
  organizationId: number,
): Promise<ActionResponse<ActiveOrganizationContext>> {
  try {
    const parsed = organizationIdSchema.safeParse({ id: organizationId });

    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid organization identifier.',
      };
    }

    const user = await getCurrentMockUserService();
    const data = await prisma.$transaction(async (tx) => {
      return await switchActiveOrganizationContextService(
        user.id,
        parsed.data.id,
        tx,
      );
    });

    revalidatePath('/');

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function mutateOrganizationMemberAction(
  input: OrganizationMemberValues,
): Promise<ActionResponse<null>> {
  try {
    const parsed = organizationMemberSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid membership data.',
      };
    }

    const user = await getCurrentMockUserService();
    await prisma.$transaction(async (tx) => {
      await mutateOrganizationMembershipService(user.id, parsed.data, tx);
    });

    revalidatePath(`/organizations/${input.organizationId}`);

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}

export async function changeOrganizationLifecycleAction(
  input: OrganizationLifecycleValues,
): Promise<ActionResponse<null>> {
  try {
    const parsed = organizationLifecycleSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: 'Invalid lifecycle data.',
      };
    }

    const user = await getCurrentMockUserService();
    await prisma.$transaction(async (tx) => {
      await changeOrganizationLifecycleService(user.id, parsed.data, tx);
    });

    revalidatePath('/organizations');
    revalidatePath(`/organizations/${input.organizationId}`);

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error),
    };
  }
}
