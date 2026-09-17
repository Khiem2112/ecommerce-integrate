import type { ActiveOrganizationContext } from './organization';

/**
 * Computed session status without requiring a dedicated catalog status table.
 */
export type ComputedSessionState =
  | 'revoked'
  | 'expired'
  | 'restricted_password_change'
  | 'context_pending'
  | 'active';

/**
 * Safe, minimal user projection for client-side serialization and React Context.
 * Never leaks password hashes or session secrets.
 */
export type UserSessionProjection = {
  readonly id: number;
  readonly subjectId: string;
  readonly displayName: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly mustChangePassword: boolean;
  readonly role?: string | null;
  readonly activeOrganizationId?: number | null;
};

/**
 * Server-side session projection.
 */
export type SessionProjection = {
  readonly id: number;
  readonly userId: number;
  readonly sessionFamilyId: string;
  readonly rotationCounter: number;
  readonly lastActivityAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
  readonly isActive: boolean;
};

/**
 * Full verified session context for layouts and protected Server Actions.
 */
export type ActiveSessionContext = {
  readonly user: UserSessionProjection;
  readonly session?: SessionProjection | null;
  readonly computedState: ComputedSessionState;
  readonly activeOrganization: ActiveOrganizationContext;
};


/**
 * Result returned upon successful login.
 */
export type LoginResult = {
  readonly redirectUrl: string;
  readonly user: UserSessionProjection;
  readonly computedState: ComputedSessionState;
};

/**
 * Outcome of rate limit checks.
 */
export type RateLimitStatus = {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
};

/**
 * Request metadata captured for session traceability.
 */
export type RequestMetadata = {
  readonly ipFingerprint?: string;
  readonly userAgentSummary?: string;
};
