import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ActiveOrganizationContext, DbClient } from '@/types';

type MockUserData = Readonly<Pick<User, 'id' | 'subjectId' | 'displayName'>>;

const MOCK_CURRENT_SUBJECT_ID = 'mock-owner-001';

export async function getCurrentMockUserService(
  tx: DbClient = prisma,
): Promise<MockUserData> {
  const user = await tx.user.findFirst({
    where: {
      subjectId: MOCK_CURRENT_SUBJECT_ID,
      isActive: true,
    },
    select: {
      id: true,
      subjectId: true,
      displayName: true,
    },
  });

  if (!user) {
    throw new Error('Current mock user is unavailable.');
  }

  return user;
}

export async function getActiveOrganizationContextService(
  userId: number,
  tx: DbClient = prisma,
): Promise<ActiveOrganizationContext> {
  const preference = await tx.organizationContextPreference.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      organization: true,
    },
  });

  if (preference) {
    const validMembership = await tx.organizationMember.findFirst({
      where: {
        userId,
        organizationId: preference.organizationId,
        isActive: true,
        membershipStatus: {
          code: 'active',
          isActive: true,
        },
        organization: {
          isActive: true,
          status: {
            code: 'active',
            isActive: true,
          },
        },
      },
    });

    if (validMembership) {
      return {
        organizationId: preference.organizationId,
        displayName: preference.organization.displayName,
        slug: preference.organization.slug,
      };
    }
  }

  const fallback = await tx.organizationMember.findFirst({
    where: {
      userId,
      isActive: true,
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
      organization: {
        isActive: true,
        status: {
          code: 'active',
          isActive: true,
        },
      },
    },
    include: {
      organization: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!fallback) {
    return {
      organizationId: null,
      displayName: null,
      slug: null,
    };
  }

  await tx.organizationContextPreference.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      organizationId: fallback.organizationId,
    },
    update: {
      organizationId: fallback.organizationId,
      isActive: true,
    },
  });

  return {
    organizationId: fallback.organizationId,
    displayName: fallback.organization.displayName,
    slug: fallback.organization.slug,
  };
}

export async function getCurrentOrganizationIdService(
  tx: DbClient = prisma,
): Promise<number> {
  const user = await getCurrentMockUserService(tx);
  const context = await getActiveOrganizationContextService(user.id, tx);

  if (!context.organizationId) {
    throw new Error('No active organization context is available.');
  }

  return context.organizationId;
}

export async function switchActiveOrganizationContextService(
  userId: number,
  organizationId: number,
  tx: DbClient = prisma,
): Promise<ActiveOrganizationContext> {
  const membership = await tx.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
      organization: {
        isActive: true,
        status: {
          code: 'active',
          isActive: true,
        },
      },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw new Error('Organization context is unavailable.');
  }

  await tx.organizationContextPreference.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      organizationId,
    },
    update: {
      organizationId,
      isActive: true,
    },
  });

  return {
    organizationId,
    displayName: membership.organization.displayName,
    slug: membership.organization.slug,
  };
}
