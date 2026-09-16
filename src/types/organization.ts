/**
 * Organization Domain Types.
 * Derives Prisma query relation payloads and browser-safe DTOs from `@prisma/client`.
 */

import type {
  Prisma,
  Organization,
  OrganizationMember as PrismaOrganizationMember,
  User,
  PlatformConnection,
} from '@prisma/client';

export const ORGANIZATION_STATUS_CODES = [
  'active',
  'suspended',
  'archived',
] as const;

export const ORGANIZATION_ROLE_CODES = [
  'owner',
  'admin',
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
] as const;

export type OrganizationStatusCode = (typeof ORGANIZATION_STATUS_CODES)[number];
export type OrganizationRoleCode = (typeof ORGANIZATION_ROLE_CODES)[number];

// ============================================================
// Prisma-Derived Relation Query Payload Types
// ============================================================

/** Prisma query payload for organization list and summary queries */
export type OrganizationSummaryPayload = Prisma.OrganizationGetPayload<{
  include: {
    status: true;
    connections: {
      include: {
        platform: true;
      };
    };
    _count: {
      select: {
        members: true;
        connections: true;
      };
    };
  };
}>;

/** Prisma query payload for full organization detail queries */
export type OrganizationDetailPayload = Prisma.OrganizationGetPayload<{
  include: {
    status: true;
    members: {
      include: {
        user: true;
        role: true;
        membershipStatus: true;
      };
    };
    connections: {
      include: {
        platform: true;
      };
    };
    _count: {
      select: {
        members: true;
        connections: true;
      };
    };
  };
}>;

// ============================================================
// Browser-Safe DTOs (Derived directly from Prisma Models)
// ============================================================

export type OrganizationFilters = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly query?: string;
  readonly status?: OrganizationStatusCode;
};

export type OrganizationConnection = Readonly<
  Pick<PlatformConnection, 'id' | 'shopName'>
> & {
  readonly platformName: string;
  readonly lastSyncedAt: string | null;
};

export type OrganizationSummary = Readonly<
  Pick<
    Organization,
    | 'id'
    | 'displayName'
    | 'slug'
    | 'logoUrl'
    | 'timezone'
    | 'baseCurrency'
    | 'version'
  >
> & {
  readonly status: OrganizationStatusCode;
  readonly role: OrganizationRoleCode;
  readonly memberCount: number;
  readonly shopCount: number;
  readonly connections: readonly OrganizationConnection[];
  readonly updatedAt: string;
};

export type OrganizationMember = Readonly<
  Pick<PrismaOrganizationMember, 'id' | 'userId'>
> &
  Readonly<Pick<User, 'displayName' | 'email' | 'avatarUrl'>> & {
    readonly role: OrganizationRoleCode;
    readonly membershipStatus: 'active' | 'invited' | 'removed';
    readonly isCurrentUser: boolean;
  };

export type OrganizationDetail = OrganizationSummary &
  Readonly<Pick<Organization, 'legalName' | 'countryCode'>> & {
    readonly members: readonly OrganizationMember[];
    readonly canManage: boolean;
    readonly canManageLifecycle: boolean;
    readonly isActiveContext: boolean;
  };

export type OrganizationListResult = {
  readonly items: readonly OrganizationSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
};

export type ActiveOrganizationContext = {
  readonly organizationId: Organization['id'] | null;
  readonly displayName: Organization['displayName'] | null;
  readonly slug: Organization['slug'] | null;
};

export type MockUserOption = Readonly<Pick<User, 'id' | 'displayName' | 'email'>>;
