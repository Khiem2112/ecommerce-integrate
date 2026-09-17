import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  DbClient,
  OrganizationRoleCode,
  UserAccessAuditPayload,
  UserAccessDetail,
  UserAccessDetailPayload,
  UserAccessFilters,
  UserAccessHistoryResult,
  UserAccessListResult,
  UserAccessMemberPayload,
  UserAccessStatusCode,
  UserAccessSummary,
} from '@/types';
import {
  canActorManageTarget,
  canActorManageUsers,
  canActorViewAudit,
  canActorViewSensitiveDetails,
  computeUserCapabilities,
} from './userAccessPermissionService';

type PrismaWhere = Prisma.OrganizationMemberWhereInput;
type PrismaOrderBy =
  | Prisma.OrganizationMemberOrderByWithRelationInput
  | Prisma.OrganizationMemberOrderByWithRelationInput[];

async function getActorActiveRole(
  actorUserId: number,
  organizationId: number,
  tx: DbClient,
): Promise<OrganizationRoleCode> {
  const membership = await tx.organizationMember.findFirst({
    where: {
      userId: actorUserId,
      organizationId,
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
    throw new Error('Không có quyền truy cập tổ chức làm việc.');
  }

  return membership.role.code as OrganizationRoleCode;
}

export async function listUsersForActiveOrganizationService(
  actorUserId: number,
  activeOrgId: number,
  filters: UserAccessFilters = {},
  tx: DbClient = prisma,
): Promise<UserAccessListResult> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);
  const isManager = canActorManageUsers(actorRole);

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: PrismaWhere = {
    organizationId: activeOrgId,
  };

  // Non-managers can only see active members
  if (isManager && filters.status === 'removed') {
    where.membershipStatus = { code: 'removed' };
  } else {
    where.membershipStatus = { code: 'active' };
    where.isActive = true;
  }

  if (filters.role) {
    where.role = { code: filters.role };
  }

  if (filters.q) {
    const query = filters.q.trim();
    if (isManager) {
      where.OR = [
        { displayName: { contains: query } },
        { contactEmail: { contains: query } },
        { user: { email: { contains: query } } },
      ];
    } else {
      where.displayName = { contains: query };
    }
  }

  // Parse sorting parameter with safe allowlist
  let orderBy: PrismaOrderBy = [{ displayName: 'asc' }, { id: 'asc' }];
  if (filters.sort) {
    const [field, direction] = filters.sort.split(':');
    const sortDir = direction === 'desc' ? 'desc' : 'asc';

    if (field === 'displayName') {
      orderBy = [{ displayName: sortDir }, { id: 'asc' }];
    } else if (field === 'role') {
      orderBy = [{ role: { sortOrder: sortDir } }, { displayName: 'asc' }];
    } else if (field === 'status') {
      orderBy = [{ membershipStatus: { sortOrder: sortDir } }, { displayName: 'asc' }];
    } else if (field === 'updatedAt') {
      orderBy = [{ updatedAt: sortDir }, { id: 'asc' }];
    }
  }

  const [members, total, activeCount, removedCount]: [
    UserAccessMemberPayload[],
    number,
    number,
    number,
  ] = await Promise.all([
    tx.organizationMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            avatarUrl: true,
          },
        },
        role: true,
        membershipStatus: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    tx.organizationMember.count({ where }),
    tx.organizationMember.count({
      where: {
        organizationId: activeOrgId,
        membershipStatus: { code: 'active' },
        isActive: true,
      },
    }),
    tx.organizationMember.count({
      where: {
        organizationId: activeOrgId,
        membershipStatus: { code: 'removed' },
      },
    }),
  ]);

  const items: UserAccessSummary[] = members.map((m) => {
    const targetRole = m.role.code as OrganizationRoleCode;
    const isCurrentUser = m.userId === actorUserId;
    const canViewSensitive = canActorViewSensitiveDetails(
      actorRole,
      actorUserId,
      targetRole,
      m.userId,
    );
    const canManageTargetUser = canActorManageTarget(
      actorRole,
      actorUserId,
      targetRole,
      m.userId,
    );

    return {
      userId: m.userId,
      membershipId: m.id,
      organizationId: m.organizationId,
      displayName: m.displayName,
      loginEmail: canViewSensitive ? m.user.email : null,
      contactEmail: canViewSensitive ? m.contactEmail : null,
      avatarUrl: m.user.avatarUrl,
      role: targetRole,
      membershipStatus: m.membershipStatus.code as UserAccessStatusCode,
      version: m.version,
      updatedAt: m.updatedAt.toISOString(),
      isCurrentUser,
      canEdit: canManageTargetUser,
      canResetPassword: canManageTargetUser,
      canRemove: canManageTargetUser && m.membershipStatus.code === 'active',
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    activeCount,
    removedCount,
    canProvision: isManager,
  };
}

export async function getUserAccessDetailService(
  actorUserId: number,
  activeOrgId: number,
  targetUserId: number,
  tx: DbClient = prisma,
): Promise<UserAccessDetail | null> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);

  const member: UserAccessDetailPayload | null =
    await tx.organizationMember.findFirst({
    where: {
      userId: targetUserId,
      organizationId: activeOrgId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          avatarUrl: true,
        },
      },
      role: true,
      membershipStatus: true,
      organization: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (!member) {
    return null;
  }

  const targetRole = member.role.code as OrganizationRoleCode;
  const isCurrentUser = member.userId === actorUserId;
  const capabilities = computeUserCapabilities(
    actorRole,
    actorUserId,
    targetRole,
    member.userId,
  );

  return {
    userId: member.userId,
    membershipId: member.id,
    organizationId: member.organizationId,
    organizationDisplayName: member.organization.displayName,
    displayName: member.displayName,
    loginEmail: capabilities.canViewLoginEmail ? member.user.email : null,
    contactEmail: capabilities.canViewContactEmail ? member.contactEmail : null,
    avatarUrl: member.user.avatarUrl,
    role: targetRole,
    membershipStatus: member.membershipStatus.code as UserAccessStatusCode,
    version: member.version,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    isCurrentUser,
    capabilities,
  };
}

export async function listUserAccessHistoryService(
  actorUserId: number,
  activeOrgId: number,
  targetUserId: number,
  page = 1,
  limit = 20,
  tx: DbClient = prisma,
): Promise<UserAccessHistoryResult> {
  const actorRole = await getActorActiveRole(actorUserId, activeOrgId, tx);

  const targetMember = await tx.organizationMember.findFirst({
    where: {
      userId: targetUserId,
      organizationId: activeOrgId,
    },
    include: {
      role: true,
    },
  });

  if (!targetMember) {
    throw new Error('Không tìm thấy thành viên trong tổ chức.');
  }

  const targetRole = targetMember.role.code as OrganizationRoleCode;
  if (!canActorViewAudit(actorRole, actorUserId, targetRole, targetUserId)) {
    throw new Error('Không có quyền xem lịch sử quản lý thành viên này.');
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const where = {
    organizationId: activeOrgId,
    targetType: { in: ['user_access', 'organization_member', 'user'] },
    targetId: String(targetUserId),
  };

  const [logs, total]: [UserAccessAuditPayload[], number] =
    await Promise.all([
    tx.organizationAuditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    tx.organizationAuditLog.count({ where }),
  ]);

  return {
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      actorDisplayName: log.actor?.displayName ?? null,
      createdAt: log.createdAt.toISOString(),
      details: (log.afterSnapshot as Record<string, unknown>) ?? {},
    })),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}
