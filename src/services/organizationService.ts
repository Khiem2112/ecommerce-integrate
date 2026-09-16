import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  DbClient,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationListResult,
  OrganizationRoleCode,
  OrganizationStatusCode,
  OrganizationSummary,
  OrganizationConnection,
  MockUserOption,
} from '@/types';
import type {
  OrganizationCreateValues,
  OrganizationUpdateValues,
} from '@/forms';
import { appendOrganizationAuditService } from './organizationAuditService';
import { getActiveOrganizationContextService } from './organizationContextService';
import { getActiveOrganizationMembershipService } from './organizationMembershipService';

const SUMMARY_INCLUDE = {
  status: true,
  connections: {
    where: {
      isActive: true,
    },
    include: {
      platform: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  _count: {
    select: {
      members: {
        where: {
          isActive: true,
          membershipStatus: {
            code: 'active',
          },
        },
      },
      connections: {
        where: {
          isActive: true,
        },
      },
    },
  },
} as const;

const DETAIL_INCLUDE = {
  ...SUMMARY_INCLUDE,
  members: {
    where: {
      isActive: true,
    },
    include: {
      user: true,
      role: true,
      membershipStatus: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

type OrganizationWithRelations = Prisma.OrganizationGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;

function mapSummary(
  organization: OrganizationWithRelations,
  role: OrganizationRoleCode,
): OrganizationSummary {
  const mappedConnections: readonly OrganizationConnection[] =
    organization.connections.map((connection) => ({
      id: connection.id,
      shopName: connection.shopName,
      platformName: connection.platform.name,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    }));

  return {
    id: organization.id,
    displayName: organization.displayName,
    slug: organization.slug,
    logoUrl: organization.logoUrl,
    timezone: organization.timezone,
    baseCurrency: organization.baseCurrency,
    status: organization.status.code as OrganizationStatusCode,
    role,
    memberCount: organization._count.members,
    shopCount: organization._count.connections,
    connections: mappedConnections,
    version: organization.version,
    updatedAt: organization.updatedAt.toISOString(),
  };
}

export async function listOrganizationsForUserService(
  userId: number,
  filters: OrganizationFilters,
  tx: DbClient = prisma,
): Promise<OrganizationListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

  const statusFilter = filters.status ? { code: filters.status } : {};
  const queryFilter = filters.query
    ? {
      OR: [
        { displayName: { contains: filters.query } },
        { slug: { contains: filters.query } },
      ],
    }
    : {};

  const memberships = await tx.organizationMember.findMany({
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
          isActive: true,
          ...statusFilter,
        },
        ...queryFilter,
      },
    },
    include: {
      role: true,
      organization: {
        include: SUMMARY_INCLUDE,
      },
    },
    orderBy: {
      organization: {
        updatedAt: 'desc',
      },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const total = await tx.organizationMember.count({
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
          isActive: true,
          ...statusFilter,
        },
        ...queryFilter,
      },
    },
  });

  const items = memberships.map((membership) =>
    mapSummary(
      membership.organization,
      membership.role.code as OrganizationRoleCode,
    ),
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOrganizationDetailForUserService(
  userId: number,
  organizationId: number,
  tx: DbClient = prisma,
): Promise<OrganizationDetail | null> {
  const membership = await tx.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      isActive: true,
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
    },
    include: {
      role: true,
    },
  });

  if (!membership) {
    return null;
  }

  const organization = await tx.organization.findFirst({
    where: {
      id: organizationId,
      isActive: true,
    },
    include: DETAIL_INCLUDE,
  });

  if (!organization) {
    return null;
  }

  const active = await getActiveOrganizationContextService(userId, tx);
  const summary = mapSummary(
    organization,
    membership.role.code as OrganizationRoleCode,
  );
  const canManage =
    membership.role.code === 'owner' || membership.role.code === 'admin';

  const members = organization.members.map((item) => ({
    id: item.id,
    userId: item.userId,
    displayName: item.user.displayName,
    email: item.user.email,
    avatarUrl: item.user.avatarUrl,
    role: item.role.code as OrganizationRoleCode,
    membershipStatus: item.membershipStatus.code as 'active' | 'invited' | 'removed',
    isCurrentUser: item.userId === userId,
  }));

  const connections = organization.connections.map((connection) => ({
    id: connection.id,
    shopName: connection.shopName,
    platformName: connection.platform.name,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
  }));

  return {
    ...summary,
    legalName: canManage ? organization.legalName : null,
    countryCode: canManage ? organization.countryCode : null,
    members,
    connections,
    canManage,
    canManageLifecycle: membership.role.code === 'owner',
    isActiveContext: active.organizationId === organization.id,
  };
}

export async function createOrganizationForUserService(
  userId: number,
  input: OrganizationCreateValues,
  tx: DbClient = prisma,
): Promise<OrganizationDetail> {
  if (input.idempotencyKey) {
    const existing = await tx.organization.findFirst({
      where: {
        createIdempotencyKey: input.idempotencyKey,
        isActive: true,
      },
    });

    if (existing) {
      const detail = await getOrganizationDetailForUserService(
        userId,
        existing.id,
        tx,
      );
      if (detail) {
        return detail;
      }
    }
  }

  const [status, ownerRole, activeMembership] = await Promise.all([
    tx.organizationStatus.findFirst({
      where: {
        code: 'active',
        isActive: true,
      },
    }),
    tx.organizationRoleCatalog.findFirst({
      where: {
        code: 'owner',
        isActive: true,
      },
    }),
    tx.organizationMembershipStatus.findFirst({
      where: {
        code: 'active',
        isActive: true,
      },
    }),
  ]);

  if (!status || !ownerRole || !activeMembership) {
    throw new Error('Organization catalog data is unavailable.');
  }

  const organization = await tx.organization.create({
    data: {
      displayName: input.displayName,
      slug: input.slug,
      timezone: input.timezone,
      baseCurrency: input.baseCurrency.toUpperCase(),
      logoUrl: input.logoUrl || null,
      legalName: input.legalName || null,
      countryCode: input.countryCode?.toUpperCase() || null,
      statusId: status.id,
      createIdempotencyKey: input.idempotencyKey,
    },
  });

  await tx.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId,
      roleId: ownerRole.id,
      membershipStatusId: activeMembership.id,
    },
  });

  await tx.organizationContextPreference.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      organizationId: organization.id,
    },
    update: {
      organizationId: organization.id,
      isActive: true,
    },
  });

  await appendOrganizationAuditService(
    {
      organizationId: organization.id,
      actorUserId: userId,
      action: 'organization.create',
      targetType: 'organization',
      targetId: String(organization.id),
      afterSnapshot: {
        displayName: organization.displayName,
        slug: organization.slug,
      },
    },
    tx,
  );

  const detail = await getOrganizationDetailForUserService(
    userId,
    organization.id,
    tx,
  );

  if (!detail) {
    throw new Error('Organization creation could not be completed.');
  }

  return detail;
}

export async function updateOrganizationForUserService(
  userId: number,
  input: OrganizationUpdateValues,
  tx: DbClient = prisma,
): Promise<OrganizationDetail> {
  const membership = await getActiveOrganizationMembershipService(
    userId,
    input.id,
    tx,
  );

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new Error('Insufficient permission to update organization.');
  }

  const current = await tx.organization.findFirst({
    where: {
      id: input.id,
      isActive: true,
    },
  });

  if (!current) {
    throw new Error('Organization is unavailable.');
  }

  if (current.version !== input.expectedVersion) {
    throw new Error('Organization was changed by another user.');
  }

  if (current.slug !== input.slug) {
    const historical = await tx.organizationSlugHistory.findFirst({
      where: {
        slug: input.slug,
        isActive: true,
      },
    });

    if (historical) {
      throw new Error('This slug has already been used.');
    }

    await tx.organizationSlugHistory.create({
      data: {
        organizationId: current.id,
        slug: current.slug,
      },
    });
  }

  const result = await tx.organization.updateMany({
    where: {
      id: input.id,
      version: input.expectedVersion,
      isActive: true,
    },
    data: {
      displayName: input.displayName,
      slug: input.slug,
      timezone: input.timezone,
      baseCurrency: input.baseCurrency.toUpperCase(),
      logoUrl: input.logoUrl || null,
      legalName: input.legalName || null,
      countryCode: input.countryCode?.toUpperCase() || null,
      version: {
        increment: 1,
      },
    },
  });

  if (result.count !== 1) {
    throw new Error('Organization was changed by another user.');
  }

  await appendOrganizationAuditService(
    {
      organizationId: input.id,
      actorUserId: userId,
      action: 'organization.update',
      targetType: 'organization',
      targetId: String(input.id),
      beforeSnapshot: {
        displayName: current.displayName,
        slug: current.slug,
      },
      afterSnapshot: {
        displayName: input.displayName,
        slug: input.slug,
      },
    },
    tx,
  );

  const detail = await getOrganizationDetailForUserService(
    userId,
    input.id,
    tx,
  );

  if (!detail) {
    throw new Error('Organization update could not be completed.');
  }

  return detail;
}

export async function getMockUsersService(
  tx: DbClient = prisma,
): Promise<readonly MockUserOption[]> {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
    orderBy: {
      displayName: 'asc',
    },
  });

  return users;
}
