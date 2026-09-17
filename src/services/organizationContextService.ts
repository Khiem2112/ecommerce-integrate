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
  requestedOrgIdOrTx?: number | null | DbClient,
  maybeTx?: DbClient,
): Promise<ActiveOrganizationContext> {
  const requestedOrgId =
    typeof requestedOrgIdOrTx === 'number' ? requestedOrgIdOrTx : null;
  const tx: DbClient =
    typeof requestedOrgIdOrTx === 'object' && requestedOrgIdOrTx !== null
      ? requestedOrgIdOrTx
      : (maybeTx ?? prisma);

  if (requestedOrgId) {
    const validRequested = await tx.organizationMember.findFirst({

      where: {
        userId,
        organizationId: requestedOrgId,
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

    if (validRequested) {
      return {
        organizationId: validRequested.organizationId,
        displayName: validRequested.organization.displayName,
        slug: validRequested.organization.slug,
      };
    }
  }

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
  // Try retrieving verified organization from active session
  try {
    const { getAuthenticatedSessionContextService } = await import(
      './authentication'
    );
    const authContext = await getAuthenticatedSessionContextService(tx);
    if (authContext?.activeOrganization?.organizationId) {
      return authContext.activeOrganization.organizationId;
    }
  } catch {
    // Session context not available, proceed to fallback
  }

  // Fallback for background sync / cron operations
  const fallback = await tx.organization.findFirst({
    where: {
      isActive: true,
      status: {
        code: 'active',
        isActive: true,
      },
    },
    select: { id: true },
  });

  if (fallback) {
    return fallback.id;
  }

  throw new Error('No active organization context is available.');
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
