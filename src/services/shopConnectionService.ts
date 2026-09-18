/**
 * Shop Connection Management Service.
 * Implements scoped listings, detail views, activity timeline, label updates,
 * safe-boundary disconnect, and atomic reassignment with comprehensive permission checks.
 */

import type {
  DbClient,
  ManageableOrganizationOption,
  OrganizationRoleCode,
  ShopConnectionActivityItem,
  ShopConnectionActivityPage,
  ShopConnectionDetail,
  ShopConnectionFilters,
  ShopConnectionListResult,
  ShopConnectionSummary,
} from '@/types';
import { prisma } from '@/lib/prisma';
import {
  canActorReassignConnection,
  canActorViewCrossOrgAudit,
  computeShopConnectionCapabilities,
  type ShopConnectionActor,
} from './shopConnectionPermissionService';
import { appendShopConnectionAuditService } from './shopConnectionAuditService';
import type { Prisma } from '@prisma/client';

/**
 * Checks for queued or running sync batches associated with a connection.
 */
export async function checkActiveSyncBatchesForConnectionService(
  connectionId: number,
  tx: DbClient = prisma,
): Promise<{ readonly count: number; readonly hasActive: boolean }> {
  const activeBatches = await tx.syncBatch.findMany({
    where: {
      connectionId,
      isActive: true,
      status: { in: ['queued', 'running'] },
    },
    select: { id: true },
  });

  return {
    count: activeBatches.length,
    hasActive: activeBatches.length > 0,
  };
}

/**
 * Lists shop connections scoped to user permissions and filters.
 */
export async function listShopConnectionsForUserService(
  actor: ShopConnectionActor,
  filters: ShopConnectionFilters = {},
  tx: DbClient = prisma,
): Promise<ShopConnectionListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  // Determine allowed organization IDs
  let organizationIdFilter: Prisma.IntFilter | number | undefined = undefined;

  if (actor.isAdmin) {
    if (filters.organizationId) {
      organizationIdFilter = filters.organizationId;
    }
  } else {
    // Normal user: resolve active organization memberships
    const memberships = await tx.organizationMember.findMany({
      where: {
        userId: actor.id,
        isActive: true,
      },
      select: { organizationId: true },
    });

    const userOrgIds = memberships.map((m) => m.organizationId);
    if (userOrgIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    if (filters.organizationId) {
      if (!userOrgIds.includes(filters.organizationId)) {
        return {
          items: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        };
      }
      organizationIdFilter = filters.organizationId;
    } else {
      organizationIdFilter = { in: userOrgIds };
    }
  }

  // Build where clause: default to active records unless explicitly querying disconnected status
  const isQueryingDisconnected = filters.status?.includes('disconnected');
  const where: Prisma.PlatformConnectionWhereInput = {
    ...(organizationIdFilter ? { organizationId: organizationIdFilter } : {}),
    ...(filters.status && filters.status.length > 0
      ? {
        status: { in: filters.status },
        ...(isQueryingDisconnected
          ? {
            OR: [
              { isActive: true },
              { status: 'disconnected', isActive: false },
            ],
          }
          : { isActive: true }),
      }
      : { isActive: true }),
  };

  // Query total and rows
  const [total, rows] = await Promise.all([
    tx.platformConnection.count({ where }),
    tx.platformConnection.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { status: 'asc' }, // Prioritizes attention needed (connected is later alphabetically than reconnect_required)
        { lastVerifiedAt: 'asc' },
        { id: 'desc' },
      ],
      include: {
        platform: true,
        organization: {
          select: {
            id: true,
            displayName: true,
            slug: true,
          },
        },
        _count: {
          select: {
            orders: true,
            syncBatches: true,
          },
        },
      },
    }),
  ]);

  const items: ShopConnectionSummary[] = rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.displayName,
    organizationSlug: row.organization.slug,
    platformId: row.platformId,
    platformCode: row.platform.code,
    platformName: row.platform.name,
    externalShopId: row.externalShopId,
    shopName: row.shopName,
    displayLabel: row.displayLabel,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    lastFailureCode: row.lastFailureCode,
    version: row.version,
    isActive: row.isActive,
    orderCount: row._count.orders,
    syncBatchCount: row._count.syncBatches,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Retrieves full detail and capabilities for a single connection with IDOR protection.
 */
export async function getShopConnectionDetailForUserService(
  actor: ShopConnectionActor,
  connectionId: number,
  tx: DbClient = prisma,
): Promise<ShopConnectionDetail> {
  const row = await tx.platformConnection.findUnique({
    where: { id: connectionId },
    include: {
      platform: true,
      organization: {
        select: {
          id: true,
          displayName: true,
          slug: true,
        },
      },
      _count: {
        select: {
          orders: true,
          syncBatches: true,
        },
      },
    },
  });

  if (!row) {
    throw new Error('Không tìm thấy thông tin kết nối gian hàng.');
  }

  // IDOR protection: non-admins must be active members of the organization
  let roleCode: OrganizationRoleCode | undefined = undefined;
  if (!actor.isAdmin) {
    const membership = await tx.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: row.organizationId,
          userId: actor.id,
        },
      },
      include: { role: true },
    });

    if (!membership || !membership.isActive) {
      throw new Error('Bạn không có quyền truy cập thông tin gian hàng này.');
    }
    roleCode = membership.role.code as OrganizationRoleCode;
  }

  const capabilities = computeShopConnectionCapabilities(actor, roleCode, row.status);

  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.displayName,
    organizationSlug: row.organization.slug,
    platformId: row.platformId,
    platformCode: row.platform.code,
    platformName: row.platform.name,
    externalShopId: row.externalShopId,
    shopName: row.shopName,
    displayLabel: row.displayLabel,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    lastFailureCode: row.lastFailureCode,
    version: row.version,
    isActive: row.isActive,
    orderCount: row._count.orders,
    syncBatchCount: row._count.syncBatches,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    capabilities,
  };
}

/**
 * Lists paginated activity history for a shop connection with cross-organization privacy redaction.
 */
export async function listShopConnectionActivityForUserService(
  actor: ShopConnectionActor,
  connectionId: number,
  cursor?: number,
  limit = 20,
  tx: DbClient = prisma,
): Promise<ShopConnectionActivityPage> {
  // Ensure actor can view the connection
  await getShopConnectionDetailForUserService(actor, connectionId, tx);

  const canViewCrossOrg = canActorViewCrossOrgAudit(actor);

  const take = Math.min(50, Math.max(1, limit));
  const logs = await tx.platformConnectionAuditLog.findMany({
    where: { connectionId },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { id: 'desc' },
    include: {
      actorUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  const hasMore = logs.length > take;
  const slicedLogs = hasMore ? logs.slice(0, take) : logs;
  const nextCursor = hasMore ? slicedLogs[slicedLogs.length - 1]?.id ?? null : null;

  const items: ShopConnectionActivityItem[] = slicedLogs.map((log) => ({
    id: log.id,
    connectionId: log.connectionId,
    authorizationAttemptId: log.authorizationAttemptId,
    actorId: log.actorUserId,
    actorName: log.actorUser?.displayName ?? null,
    action: log.action,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    organizationIdBefore: canViewCrossOrg ? log.organizationIdBefore : null,
    organizationIdAfter: canViewCrossOrg ? log.organizationIdAfter : null,
    metadata: (log.metadata as Record<string, unknown>) ?? null,
    createdAt: log.createdAt.toISOString(),
  }));

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Updates internal display label with optimistic concurrency version checking.
 */
export async function updateShopConnectionLabelForUserService(
  actor: ShopConnectionActor,
  input: {
    readonly connectionId: number;
    readonly displayLabel: string;
    readonly expectedVersion: number;
    readonly idempotencyKey?: string;
  },
  tx: DbClient = prisma,
): Promise<ShopConnectionDetail> {
  const detail = await getShopConnectionDetailForUserService(actor, input.connectionId, tx);

  if (!detail.capabilities.canEditLabel) {
    throw new Error('Bạn không có quyền chỉnh sửa nhãn gian hàng này.');
  }

  // Version check
  const updated = await tx.platformConnection.updateMany({
    where: {
      id: input.connectionId,
      version: input.expectedVersion,
    },
    data: {
      displayLabel: input.displayLabel.trim(),
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new Error('Dữ liệu gian hàng đã thay đổi bởi người dùng khác. Vui lòng tải lại trang.');
  }

  await appendShopConnectionAuditService(
    {
      connectionId: input.connectionId,
      actorUserId: actor.id,
      action: 'connection.label_updated',
      metadata: {
        oldLabel: detail.displayLabel,
        newLabel: input.displayLabel.trim(),
      },
    },
    tx,
  );

  return getShopConnectionDetailForUserService(actor, input.connectionId, tx);
}

/**
 * Requests soft disconnection of a shop connection.
 */
export async function requestShopConnectionDisconnectService(
  actor: ShopConnectionActor,
  input: {
    readonly connectionId: number;
    readonly expectedVersion: number;
    readonly idempotencyKey?: string;
  },
  tx: DbClient = prisma,
): Promise<ShopConnectionDetail> {
  const detail = await getShopConnectionDetailForUserService(actor, input.connectionId, tx);

  if (!detail.capabilities.canDisconnect) {
    throw new Error('Bạn không có quyền ngắt kết nối gian hàng này.');
  }

  const { hasActive } = await checkActiveSyncBatchesForConnectionService(input.connectionId, tx);

  const nextStatus = hasActive ? 'disconnecting' : 'disconnected';
  const now = new Date();

  const updated = await tx.platformConnection.updateMany({
    where: {
      id: input.connectionId,
      version: input.expectedVersion,
    },
    data: {
      status: nextStatus,
      isActive: hasActive ? true : false,
      disconnectedAt: hasActive ? null : now,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new Error('Dữ liệu gian hàng đã thay đổi bởi người dùng khác. Vui lòng thử lại.');
  }

  await appendShopConnectionAuditService(
    {
      connectionId: input.connectionId,
      actorUserId: actor.id,
      action: 'connection.disconnected',
      fromStatus: detail.status,
      toStatus: nextStatus,
      metadata: {
        hasActiveSyncBatches: hasActive,
      },
    },
    tx,
  );

  return getShopConnectionDetailForUserService(actor, input.connectionId, tx);
}

/**
 * Reassigns a connection from source organization to target organization.
 */
export async function requestShopConnectionReassignmentService(
  actor: ShopConnectionActor,
  input: {
    readonly connectionId: number;
    readonly targetOrganizationId: number;
    readonly expectedVersion: number;
    readonly idempotencyKey?: string;
  },
  tx: DbClient = prisma,
): Promise<ShopConnectionDetail> {
  const detail = await getShopConnectionDetailForUserService(actor, input.connectionId, tx);

  if (detail.organizationId === input.targetOrganizationId) {
    throw new Error('Tổ chức đích phải khác tổ chức hiện tại của gian hàng.');
  }

  // Validate target organization
  const targetOrg = await tx.organization.findUnique({
    where: { id: input.targetOrganizationId },
    include: { status: true },
  });

  if (!targetOrg || !targetOrg.isActive || targetOrg.status.code !== 'active') {
    throw new Error('Tổ chức đích không tồn tại hoặc đang tạm ngưng.');
  }

  // Check reassignment permissions
  let sourceRole: OrganizationRoleCode | undefined;
  let targetRole: OrganizationRoleCode | undefined;

  if (!actor.isAdmin) {
    const [sourceMember, targetMember] = await Promise.all([
      tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: detail.organizationId,
            userId: actor.id,
          },
        },
        include: { role: true },
      }),
      tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.targetOrganizationId,
            userId: actor.id,
          },
        },
        include: { role: true },
      }),
    ]);

    sourceRole = sourceMember?.role.code as OrganizationRoleCode;
    targetRole = targetMember?.role.code as OrganizationRoleCode;
  }

  if (!canActorReassignConnection(actor, sourceRole, targetRole)) {
    throw new Error(
      'Bạn cần có quyền quản trị viên (Admin/Owner) ở cả tổ chức nguồn và đích để chuyển gian hàng.',
    );
  }

  // Check active sync batches (for operator notification / safe boundary)
  const { hasActive, count } = await checkActiveSyncBatchesForConnectionService(
    input.connectionId,
    tx,
  );

  // Atomically update organizationId on the same connection record
  const updated = await tx.platformConnection.updateMany({
    where: {
      id: input.connectionId,
      version: input.expectedVersion,
    },
    data: {
      organizationId: input.targetOrganizationId,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new Error('Dữ liệu gian hàng đã thay đổi bởi người dùng khác. Vui lòng thử lại.');
  }

  await appendShopConnectionAuditService(
    {
      connectionId: input.connectionId,
      actorUserId: actor.id,
      organizationIdBefore: detail.organizationId,
      organizationIdAfter: input.targetOrganizationId,
      action: 'connection.reassigned',
      metadata: {
        activeSyncBatchesTransferred: count,
        hasActiveSyncBatches: hasActive,
      },
    },
    tx,
  );

  return getShopConnectionDetailForUserService(actor, input.connectionId, tx);
}

/**
 * Returns list of organizations that the actor can select as filter or target.
 */
export async function listAdminManagedOrganizationsForUserService(
  actor: ShopConnectionActor,
  tx: DbClient = prisma,
): Promise<readonly ManageableOrganizationOption[]> {
  if (actor.isAdmin) {
    const orgs = await tx.organization.findMany({
      where: { isActive: true },
      select: {
        id: true,
        displayName: true,
        slug: true,
      },
      orderBy: { displayName: 'asc' },
    });
    return orgs;
  }

  // Find memberships where role is admin or owner
  const memberships = await tx.organizationMember.findMany({
    where: {
      userId: actor.id,
      isActive: true,
      role: {
        code: { in: ['admin', 'owner'] },
      },
      organization: {
        isActive: true,
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          displayName: true,
          slug: true,
        },
      },
    },
  });

  return memberships.map((m) => m.organization);
}
