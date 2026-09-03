/**
 * Customer Service — data access layer for customer profile and evidence records.
 * Supports transaction client injection for atomic multi-service operations.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  DbClient,
  CustomerWithRelations,
  CustomerEvidenceRecord,
  CustomerFullDetail,
  CustomerFilterParams,
  CustomerListResponse,
  CustomerUpdateInput,
} from '@/types';

/** Shared Prisma include for standard customer queries */
const CUSTOMER_INCLUDE = {
  vipTier: true,
  platform: true,
  _count: {
    select: {
      orders: true,
      conversations: true,
      evidences: true,
    },
  },
} as const;

/** Full detail include for Customer 360 Dossier */
const CUSTOMER_360_INCLUDE = {
  vipTier: true,
  platform: true,
  orders: {
    where: { isActive: true },
    include: {
      currentStatus: true,
      platform: true,
      items: {
        where: { isActive: true },
        include: { category: true },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  conversations: {
    where: { isActive: true },
    include: {
      status: true,
      intent: true,
      assignedAgent: true,
      escalationStatus: true,
    },
    orderBy: { startedAt: 'desc' as const },
  },
  evidences: {
    where: { isActive: true },
    orderBy: { lastObserved: 'desc' as const },
  },
} as const;

/**
 * Fetch full customer with VIP tier and platform (Existing helper for workspace/copilot).
 */
export async function getCustomerById(
  id: number,
  tx: DbClient = prisma,
): Promise<CustomerWithRelations | null> {
  return tx.customer.findFirst({
    where: { id, isActive: true },
    include: {
      vipTier: true,
      platform: true,
    },
  });
}

/** Fetch evidence-backed facts for a customer (Layer 3 memory) */
export async function getCustomerEvidences(
  customerId: number,
  minConfidence: number = 0.5,
  tx: DbClient = prisma,
): Promise<CustomerEvidenceRecord[]> {
  return tx.customerEvidence.findMany({
    where: {
      customerId,
      isActive: true,
      confidence: { gte: minConfidence },
    },
    orderBy: { lastObserved: 'desc' },
  });
}

/**
 * Fetch paginated customers with keyword search, platform, VIP tier, and score filtering.
 */
export async function getCustomersPaginatedService(
  filters: CustomerFilterParams = {},
  tx: DbClient = prisma,
): Promise<CustomerListResponse> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 10));
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.CustomerWhereInput = {
    isActive: true,
  };

  if (filters.platformId) {
    whereClause.platformId = filters.platformId;
  }

  if (filters.vipTierId) {
    whereClause.vipTierId = filters.vipTierId;
  }

  if (filters.minVipScore !== undefined || filters.maxVipScore !== undefined) {
    whereClause.vipScore = {};
    if (filters.minVipScore !== undefined) {
      whereClause.vipScore.gte = filters.minVipScore;
    }
    if (filters.maxVipScore !== undefined) {
      whereClause.vipScore.lte = filters.maxVipScore;
    }
  }

  if (filters.keyword && filters.keyword.trim() !== '') {
    const kw = filters.keyword.trim();
    whereClause.platformBuyerId = { contains: kw };
  }

  const orderBy: Prisma.CustomerOrderByWithRelationInput = filters.sortBy
    ? { [filters.sortBy]: filters.sortOrder ?? 'desc' }
    : { totalSpend: 'desc' };

  const [items, total] = await Promise.all([
    tx.customer.findMany({
      where: whereClause,
      include: CUSTOMER_INCLUDE,
      orderBy,
      skip,
      take: pageSize,
    }),
    tx.customer.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    items: items as unknown as readonly CustomerWithRelations[],
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

/**
 * Fetch full 360-degree customer dossier with orders, conversations, and evidences.
 */
export async function getCustomerDetailService(
  id: number,
  tx: DbClient = prisma,
): Promise<CustomerFullDetail | null> {
  return tx.customer.findFirst({
    where: { id, isActive: true },
    include: CUSTOMER_360_INCLUDE,
  }) as Promise<CustomerFullDetail | null>;
}

/**
 * Update customer profile details (Consent, Preferred language, Frequent categories).
 * Enforces Optimistic Concurrency Control (OCC).
 */
export async function updateCustomerService(
  data: CustomerUpdateInput,
  tx: DbClient = prisma,
): Promise<CustomerWithRelations> {
  const existing = await tx.customer.findUnique({
    where: { id: data.id },
  });

  if (!existing || !existing.isActive) {
    throw new Error('Khách hàng không tồn tại hoặc đã bị vô hiệu hóa.');
  }

  // OCC Check
  if (data.updatedAt) {
    const clientDate = new Date(data.updatedAt);
    if (Number.isNaN(clientDate.getTime())) {
      throw new Error('Dữ liệu thời gian cập nhật không hợp lệ.');
    }
    const currentUpdatedAt = existing.updatedAt.toISOString();
    const clientUpdatedAt = clientDate.toISOString();
    if (currentUpdatedAt !== clientUpdatedAt) {
      throw new Error(
        'Hồ sơ khách hàng đã được thay đổi bởi một tác vụ khác. Vui lòng làm mới trang và thử lại.',
      );
    }
  }

  const updatePayload: Prisma.CustomerUpdateInput = {};

  if (data.preferredLanguage !== undefined) {
    updatePayload.preferredLanguage = data.preferredLanguage;
  }

  if (data.consentStatus !== undefined) {
    updatePayload.consentStatus = data.consentStatus;
  }

  if (data.frequentCategories !== undefined) {
    updatePayload.frequentCategories = data.frequentCategories
      ? (data.frequentCategories as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull;
  }

  const updated = await tx.customer.update({
    where: { id: data.id },
    data: updatePayload,
    include: CUSTOMER_INCLUDE,
  });

  return updated as unknown as CustomerWithRelations;
}

/**
 * Fetch lightweight customer list for dropdown selects.
 */
export async function getCustomerLookupListService(
  limit: number = 100,
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly platformBuyerId: string;
    readonly platform: { readonly name: string };
    readonly vipTier: { readonly name: string; readonly code: string };
  }[]
> {
  return tx.customer.findMany({
    where: { isActive: true },
    select: {
      id: true,
      platformBuyerId: true,
      platform: { select: { name: true } },
      vipTier: { select: { name: true, code: true } },
    },
    orderBy: { id: 'asc' },
    take: limit,
  });
}

