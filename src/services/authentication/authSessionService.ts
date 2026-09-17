import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { ActiveSessionContext, DbClient, UserSessionProjection } from '@/types';
import { getActiveOrganizationContextService } from '../organizationContextService';

/**
 * Resolves the authenticated session context for the current request using NextAuth (Auth.js v5)
 * and real-time database validation for organization context & membership.
 * Returns null if no valid session exists or if the user is inactive.
 */
export async function getAuthenticatedSessionContextService(
  requestedOrgIdOrTx?: number | null | DbClient,
  maybeTx?: DbClient,
): Promise<ActiveSessionContext | null> {
  const requestedOrgId =
    typeof requestedOrgIdOrTx === 'number' ? requestedOrgIdOrTx : null;
  const tx: DbClient =
    typeof requestedOrgIdOrTx === 'object' && requestedOrgIdOrTx !== null
      ? requestedOrgIdOrTx
      : (maybeTx ?? prisma);

  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const userId = parseInt(session.user.id, 10);
  if (isNaN(userId)) {
    return null;
  }

  const user = await tx.user.findFirst({
    where: {
      id: userId,
      isActive: true,
    },
  });

  if (!user) {
    return null;
  }

  // Intercept users constrained by mandatory password reset before issuing active context
  if (user.mustChangePassword) {
    const userProjection: UserSessionProjection = {
      id: user.id,
      subjectId: user.subjectId,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      mustChangePassword: true,
      role: null,
      activeOrganizationId: null,
    };

    return {
      user: userProjection,
      computedState: 'restricted_password_change',
      activeOrganization: {
        organizationId: null,
        displayName: null,
        slug: null,
      },
    };
  }

  // Resolve active organization tenant preference from requested parameter or database preference
  const activeOrg = await getActiveOrganizationContextService(
    user.id,
    requestedOrgId,
    tx,
  );

  // Validate active membership and extract role permissions directly from database
  let roleCode: string | null = null;
  if (activeOrg.organizationId) {
    const membership = await tx.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId: activeOrg.organizationId,
        isActive: true,
        membershipStatus: { code: 'active', isActive: true },
        organization: { isActive: true, status: { code: 'active', isActive: true } },
      },
      include: { role: true },
    });
    roleCode = membership?.role?.code ?? null;
  }

  const computedState = activeOrg.organizationId && roleCode ? 'active' : 'context_pending';

  const userProjection: UserSessionProjection = {
    id: user.id,
    subjectId: user.subjectId,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    mustChangePassword: false,
    role: roleCode,
    activeOrganizationId: activeOrg.organizationId,
  };

  return {
    user: userProjection,
    computedState,
    activeOrganization: activeOrg,
  };
}

/**
 * Asserts that the incoming request has a valid authenticated session.
 * Throws an error if unauthenticated or expired.
 */
export async function requireAuthenticatedUserService(
  requestedOrgIdOrTx?: number | null | DbClient,
  maybeTx?: DbClient,
): Promise<ActiveSessionContext> {
  const context = await getAuthenticatedSessionContextService(requestedOrgIdOrTx, maybeTx);

  if (!context) {
    throw new Error('Yêu cầu đăng nhập.');
  }

  if (context.computedState === 'revoked' || context.computedState === 'expired') {
    throw new Error('Phiên làm việc đã hết hạn.');
  }

  return context;
}

/**
 * Asserts that the incoming request is authenticated and has an active Organization context.
 */
export async function requireActiveOrganizationContextService(
  requestedOrgIdOrTx?: number | null | DbClient,
  maybeTx?: DbClient,
): Promise<ActiveSessionContext & { activeOrganizationId: number }> {
  const context = await requireAuthenticatedUserService(requestedOrgIdOrTx, maybeTx);

  if (context.computedState === 'restricted_password_change') {
    throw new Error('Vui lòng hoàn tất đổi mật khẩu trước khi tiếp tục.');
  }

  if (
    context.computedState === 'context_pending' ||
    !context.activeOrganization.organizationId
  ) {
    throw new Error('Chưa chọn tổ chức làm việc.');
  }

  return {
    ...context,
    activeOrganizationId: context.activeOrganization.organizationId,
  };
}

/**
 * Returns the count of active organization memberships for a user.
 * Used during login routing to determine whether to present the organization picker.
 */
export async function getUserActiveMembershipCountService(
  userId: number,
  tx: DbClient = prisma,
): Promise<number> {
  return await tx.organizationMember.count({
    where: {
      userId,
      isActive: true,
      membershipStatus: { code: 'active', isActive: true },
      organization: { isActive: true, status: { code: 'active', isActive: true } },
    },
  });
}
