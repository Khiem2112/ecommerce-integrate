/**
 * Shop Connection Permission Service.
 * Evaluates actor capabilities based on `isAdmin` system flag and organization membership roles.
 * Rule: When `actor.isAdmin === true`, the actor has full administrative access regardless of role.
 */

import type { DbClient, OrganizationRoleCode, ShopConnectionCapabilities } from '@/types';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedSessionContextService } from './authentication/authSessionService';
import { getCurrentMockUserService } from './organizationContextService';

export type ShopConnectionActor = {
  readonly id: number;
  readonly isAdmin: boolean;
};

/**
 * Resolves current actor identity and system administrator status for shop connection operations.
 */
export async function resolveShopConnectionActorService(
  tx: DbClient = prisma,
): Promise<ShopConnectionActor> {
  const authContext = await getAuthenticatedSessionContextService().catch(() => null);
  if (authContext?.user?.id) {
    const dbUser = await tx.user.findUnique({
      where: { id: authContext.user.id },
      select: { id: true, isAdmin: true },
    });
    if (dbUser) {
      return { id: dbUser.id, isAdmin: Boolean(dbUser.isAdmin) };
    }
  }

  const mockUser = await getCurrentMockUserService();
  const dbUser = await tx.user.findUnique({
    where: { id: mockUser.id },
    select: { id: true, isAdmin: true },
  });
  return { id: mockUser.id, isAdmin: Boolean(dbUser?.isAdmin) };
}

/**
 * Evaluates whether an actor can connect, reconnect, disconnect, or relabel shops.
 */
export function canActorManageConnections(
  actor: ShopConnectionActor,
  role?: OrganizationRoleCode,
): boolean {
  if (actor.isAdmin) {
    return true;
  }

  if (!role) {
    return false;
  }

  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'integration_operator'
  );
}

/**
 * Evaluates whether an actor can filter connections across multiple organizations.
 * Only system admins (`isAdmin === true`) receive the multi-org filter.
 */
export function canActorFilterByOrganization(actor: ShopConnectionActor): boolean {
  return actor.isAdmin;
}

/**
 * Evaluates whether an actor can reassign a connection from source organization to target organization.
 * System admins can reassign unconditionally.
 * Organization admins must hold an admin or owner role in both source and target organizations.
 */
export function canActorReassignConnection(
  actor: ShopConnectionActor,
  sourceRole?: OrganizationRoleCode,
  targetRole?: OrganizationRoleCode,
): boolean {
  if (actor.isAdmin) {
    return true;
  }

  if (!sourceRole || !targetRole) {
    return false;
  }

  const isSourceAdmin = sourceRole === 'admin' || sourceRole === 'owner';
  const isTargetAdmin = targetRole === 'admin' || targetRole === 'owner';

  return isSourceAdmin && isTargetAdmin;
}

/**
 * Evaluates whether an actor can view cross-organization audit history and reassignment details.
 */
export function canActorViewCrossOrgAudit(actor: ShopConnectionActor): boolean {
  return actor.isAdmin;
}

/**
 * Computes the full capability set for a specific shop connection and actor.
 */
export function computeShopConnectionCapabilities(
  actor: ShopConnectionActor,
  role?: OrganizationRoleCode,
  connectionStatus?: string,
): ShopConnectionCapabilities {
  const canManage = canActorManageConnections(actor, role);

  return {
    canManage,
    canReconnect: canManage && connectionStatus !== 'disconnecting' && connectionStatus !== 'reassigning',
    canDisconnect: canManage && connectionStatus !== 'disconnected' && connectionStatus !== 'disconnecting',
    canReassign: actor.isAdmin || (role === 'admin' || role === 'owner'),
    canEditLabel: canManage,
  };
}
