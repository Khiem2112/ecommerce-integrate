/**
 * Customer domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma } from '@prisma/client';
import type { PaginationMeta } from './order';

/** Customer with VIP tier and platform relations included */
export type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: {
    vipTier: true;
    platform: true;
  };
}> & {
  _count?: {
    orders: number;
    conversations: number;
    evidences: number;
  };
};

/** Evidence-backed fact about a customer (Layer 3 memory) */
export type CustomerEvidenceRecord = Prisma.CustomerEvidenceGetPayload<object>;

/** Full customer 360 profile with orders, conversations, and evidences */
export type CustomerFullDetail = Prisma.CustomerGetPayload<{
  include: {
    vipTier: true;
    platform: true;
    orders: {
      include: {
        currentStatus: true;
        platform: true;
        items: {
          include: { category: true };
        };
      };
      orderBy: { createdAt: 'desc' };
    };
    conversations: {
      include: {
        status: true;
        intent: true;
        assignedAgent: true;
        escalationStatus: true;
      };
      orderBy: { startedAt: 'desc' };
    };
    evidences: {
      orderBy: { lastObserved: 'desc' };
    };
  };
}>;

/** Filter parameters for querying customer directory */
export type CustomerFilterParams = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly keyword?: string;
  readonly platformId?: number;
  readonly vipTierId?: number;
  readonly minVipScore?: number;
  readonly maxVipScore?: number;
  readonly sortBy?: 'vipScore' | 'totalSpend' | 'orderCount' | 'createdAt' | 'daysSinceLastOrder' | 'avgOrderValue';
  readonly sortOrder?: 'asc' | 'desc';
};

/** Paginated response for customer directory */
export type CustomerListResponse = {
  readonly items: readonly CustomerWithRelations[];
  readonly pagination: PaginationMeta;
};

/** Lookup options for customer filters and forms */
export type CustomerLookupOptions = {
  readonly platforms: readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
  }[];
  readonly vipTiers: readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
    readonly minScore: number;
    readonly maxScore: number;
    readonly priority: number;
  }[];
};

/** Input payload for customer profile updates */
export type CustomerUpdateInput = {
  readonly id: number;
  readonly preferredLanguage?: string | null;
  readonly consentStatus?: string;
  readonly frequentCategories?: readonly string[] | null;
  readonly updatedAt?: string;
};
