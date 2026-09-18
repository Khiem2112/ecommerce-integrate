/**
 * Shop Connection Domain Types.
 * Strictly derives Prisma relation payloads and browser-safe DTOs from `@prisma/client`.
 * Guarantees zero credential exposure to client DTOs and audit logs.
 */

import type {
  Prisma,
  PlatformConnection,
  PlatformAuthorizationAttempt,
} from '@prisma/client';
import {
  PlatformConnectionStatusCode,
  PlatformAuthorizationAttemptStatusCode,
} from '@prisma/client';

export {
  PlatformConnectionStatusCode,
  PlatformAuthorizationAttemptStatusCode,
};

export const SUPPORTED_SHOP_PLATFORM_CODES = ['lazada', 'shopify'] as const;
export type SupportedShopPlatformCode = (typeof SUPPORTED_SHOP_PLATFORM_CODES)[number];

export const PLATFORM_CONNECTION_STATUS_CODES = [
  'connected',
  'reconnect_required',
  'disconnecting',
  'reassigning',
  'disconnected',
] as const;

export const PLATFORM_AUTHORIZATION_ATTEMPT_STATUS_CODES = [
  'authorizing',
  'validating',
  'failed',
  'cancelled',
  'completed',
] as const;

export type LazadaTokenResponse = {
  readonly code?: string;
  readonly message?: string;
  readonly account?: string;
  readonly account_id?: string;
  readonly account_platform_user_id?: string;
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly refresh_expires_in?: number;
  readonly country_user_info?: readonly {
    readonly country?: string;
    readonly user_id?: string;
    readonly seller_id?: string;
    readonly short_code?: string;
  }[];
};

export type ShopifyTokenResponse = {
  readonly access_token?: string;
  readonly scope?: string;
};

// ============================================================
// Prisma-Derived Relation Query Payload Types
// ============================================================

export type ShopConnectionSummaryPayload = Prisma.PlatformConnectionGetPayload<{
  include: {
    platform: true;
    organization: {
      select: {
        id: true;
        displayName: true;
        slug: true;
      };
    };
    _count: {
      select: {
        orders: true;
        syncBatches: true;
      };
    };
  };
}>;

export type ShopConnectionDetailPayload = Prisma.PlatformConnectionGetPayload<{
  include: {
    platform: true;
    organization: {
      select: {
        id: true;
        displayName: true;
        slug: true;
      };
    };
    authorizationAttempts: {
      orderBy: { createdAt: 'desc' };
      take: 5;
    };
    _count: {
      select: {
        orders: true;
        syncBatches: true;
      };
    };
  };
}>;

export type ShopConnectionAuditLogPayload = Prisma.PlatformConnectionAuditLogGetPayload<{
  include: {
    actorUser: {
      select: {
        id: true;
        displayName: true;
        email: true;
      };
    };
  };
}>;

// ============================================================
// Browser-Safe DTOs
// ============================================================

export type ShopConnectionCapabilities = {
  readonly canManage: boolean;
  readonly canReconnect: boolean;
  readonly canDisconnect: boolean;
  readonly canReassign: boolean;
  readonly canEditLabel: boolean;
};

export type ShopConnectionSummary = Readonly<
  Pick<
    PlatformConnection,
    | 'id'
    | 'organizationId'
    | 'platformId'
    | 'externalShopId'
    | 'shopName'
    | 'displayLabel'
    | 'version'
    | 'isActive'
  >
> & {
  readonly status: PlatformConnectionStatusCode;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly platformCode: string;
  readonly platformName: string;
  readonly lastSyncedAt: string | null;
  readonly lastVerifiedAt: string | null;
  readonly lastFailureCode: string | null;
  readonly orderCount: number;
  readonly syncBatchCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ShopConnectionDetail = ShopConnectionSummary & {
  readonly capabilities: ShopConnectionCapabilities;
};

export type ShopConnectionListResult = {
  readonly items: readonly ShopConnectionSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

export type ShopConnectionFilters = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: PlatformConnectionStatusCode[];
  readonly organizationId?: number;
};
export type ShopConnectionFilterValues = ShopConnectionFilters;

export type ShopConnectionActivityItem = {
  readonly id: number;
  readonly connectionId: number | null;
  readonly authorizationAttemptId: number | null;
  readonly actorId: number | null;
  readonly actorName: string | null;
  readonly action: string;
  readonly fromStatus: PlatformConnectionStatusCode | null;
  readonly toStatus: PlatformConnectionStatusCode | null;
  readonly organizationIdBefore: number | null;
  readonly organizationIdAfter: number | null;
  readonly organizationNameBefore?: string | null;
  readonly organizationNameAfter?: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
};

export type ShopConnectionActivityPage = {
  readonly items: readonly ShopConnectionActivityItem[];
  readonly nextCursor: number | null;
  readonly hasMore: boolean;
};

export type AuthorizationStartResult = {
  readonly attemptId: number;
  readonly authorizationUrl: string;
  readonly expiresAt: string;
};

export type AuthorizationAttemptDetail = Readonly<
  Pick<
    PlatformAuthorizationAttempt,
    | 'id'
    | 'organizationId'
    | 'platformId'
    | 'connectionId'
    | 'actorUserId'
    | 'status'
    | 'failureCode'
    | 'failureReason'
  >
> & {
  readonly completedAt: string | null;
  readonly createdAt: string;
};

export type ManageableOrganizationOption = {
  readonly id: number;
  readonly displayName: string;
  readonly slug: string;
};
