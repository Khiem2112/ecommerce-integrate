/**
 * User Access Management Domain Types.
 * Scoped strictly to the active Organization tenant.
 * Derives Prisma query relation payloads and browser-safe DTOs from `@prisma/client`.
 */

import type {
  Prisma,
  Organization,
  OrganizationMember,
  User,
  OrganizationAuditLog,
} from '@prisma/client';
import type { OrganizationRoleCode } from './organization';

export const USER_ACCESS_STATUS_CODES = ['active', 'removed'] as const;
export type UserAccessStatusCode = (typeof USER_ACCESS_STATUS_CODES)[number];

// ============================================================
// Prisma-Derived Relation Query Payload Types
// ============================================================

/** Prisma query payload for user access list/summary queries */
export type UserAccessMemberPayload = Prisma.OrganizationMemberGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        email: true;
        avatarUrl: true;
      };
    };
    role: true;
    membershipStatus: true;
  };
}>;

/** Prisma query payload for full user access detail queries */
export type UserAccessDetailPayload = Prisma.OrganizationMemberGetPayload<{
  include: {
    organization: {
      select: {
        id: true;
        displayName: true;
      };
    };
    user: {
      select: {
        id: true;
        email: true;
        avatarUrl: true;
      };
    };
    role: true;
    membershipStatus: true;
  };
}>;

/** Prisma query payload for user access audit log entries */
export type UserAccessAuditPayload = Prisma.OrganizationAuditLogGetPayload<{
  include: {
    actor: {
      select: {
        displayName: true;
      };
    };
  };
}>;

// ============================================================
// Browser-Safe DTOs (Derived directly from Prisma Models)
// ============================================================

export type UserAccessCapabilities = {
  readonly canEditProfile: boolean;
  readonly canChangeRole: boolean;
  readonly canResetPassword: boolean;
  readonly canRemove: boolean;
  readonly canViewLoginEmail: boolean;
  readonly canViewContactEmail: boolean;
  readonly canViewAudit: boolean;
  readonly allowedRolesToAssign: readonly OrganizationRoleCode[];
};

export type UserAccessSummary = Readonly<
  Pick<
    OrganizationMember,
    | 'organizationId'
    | 'userId'
    | 'displayName'
    | 'contactEmail'
    | 'version'
  >
> & {
  readonly membershipId: OrganizationMember['id'];
  readonly loginEmail: User['email'] | null;
  readonly avatarUrl: User['avatarUrl'];
  readonly role: OrganizationRoleCode;
  readonly membershipStatus: UserAccessStatusCode;
  readonly updatedAt: string;
  readonly isCurrentUser: boolean;
  readonly canEdit: boolean;
  readonly canResetPassword: boolean;
  readonly canRemove: boolean;
};

export type UserAccessDetail = Readonly<
  Pick<
    OrganizationMember,
    | 'organizationId'
    | 'userId'
    | 'displayName'
    | 'contactEmail'
    | 'version'
  >
> & {
  readonly membershipId: OrganizationMember['id'];
  readonly organizationDisplayName: Organization['displayName'];
  readonly loginEmail: User['email'] | null;
  readonly avatarUrl: User['avatarUrl'];
  readonly role: OrganizationRoleCode;
  readonly membershipStatus: UserAccessStatusCode;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isCurrentUser: boolean;
  readonly capabilities: UserAccessCapabilities;
};

export type UserAccessFilters = {
  readonly q?: string;
  readonly role?: OrganizationRoleCode;
  readonly status?: UserAccessStatusCode;
  readonly sort?: string;
  readonly page?: number;
  readonly limit?: number;
};

export type UserAccessFilterValues = UserAccessFilters;

export type UserAccessListResult = {
  readonly items: readonly UserAccessSummary[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly activeCount: number;
  readonly removedCount: number;
  readonly canProvision: boolean;
};

export type UserProvisioningOutcome =
  | 'created'
  | 'attached'
  | 'restored'
  | 'already_active';

export type UserProvisioningResult = {
  readonly outcome: UserProvisioningOutcome;
  readonly userId: User['id'];
  readonly membershipId: OrganizationMember['id'];
  readonly temporaryPassword?: string;
  readonly mustChangePassword?: User['mustChangePassword'];
  readonly message?: string;
};

export type PasswordResetResult = {
  readonly userId: User['id'];
  readonly displayName: User['displayName'];
  readonly temporaryPassword: string;
  readonly mustChangePassword: User['mustChangePassword'];
};

export type MembershipRemovalResult = {
  readonly userId: User['id'];
  readonly organizationId: Organization['id'];
  readonly status: 'removed';
  readonly targetMustRelog: boolean;
};

export type UserAccessAuditEvent = Readonly<
  Pick<OrganizationAuditLog, 'id' | 'action'>
> & {
  readonly actorDisplayName: User['displayName'] | null;
  readonly createdAt: string;
  readonly details: Record<string, unknown>;
};

export type UserAccessHistoryResult = {
  readonly items: readonly UserAccessAuditEvent[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
};
