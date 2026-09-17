import type { OrganizationRoleCode, UserAccessCapabilities } from '@/types';

const ROLES_BELOW_ADMIN: readonly OrganizationRoleCode[] = [
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
];

const ROLES_ASSIGNABLE_BY_OWNER: readonly OrganizationRoleCode[] = [
  'admin',
  ...ROLES_BELOW_ADMIN,
];

/**
 * Returns true if the actor has administrative privileges in the Organization.
 */
export function canActorManageUsers(actorRole: OrganizationRoleCode): boolean {
  return actorRole === 'owner' || actorRole === 'admin';
}

/**
 * Returns the list of roles the actor is permitted to assign.
 */
export function getAllowedRolesToAssign(
  actorRole: OrganizationRoleCode,
): readonly OrganizationRoleCode[] {
  if (actorRole === 'owner') {
    return ROLES_ASSIGNABLE_BY_OWNER;
  }
  if (actorRole === 'admin') {
    return ROLES_BELOW_ADMIN;
  }
  return [];
}

/**
 * Validates whether the actor is allowed to assign a specific role.
 */
export function canActorAssignRole(
  actorRole: OrganizationRoleCode,
  roleToAssign: OrganizationRoleCode,
): boolean {
  const allowed = getAllowedRolesToAssign(actorRole);
  return allowed.includes(roleToAssign);
}

/**
 * Validates whether the actor can perform mutations (profile update, role change, remove) on a target user.
 */
export function canActorManageTarget(
  actorRole: OrganizationRoleCode,
  actorUserId: number,
  targetRole: OrganizationRoleCode,
  targetUserId: number,
): boolean {
  // Self-action in Users management module is blocked in V1
  if (actorUserId === targetUserId) {
    return false;
  }

  // Owner profile / role cannot be mutated in V1
  if (targetRole === 'owner') {
    return false;
  }

  if (actorRole === 'owner') {
    return true;
  }

  if (actorRole === 'admin') {
    // Admin can only manage roles strictly below admin (cannot manage Owner or other Admins)
    return ROLES_BELOW_ADMIN.includes(targetRole);
  }

  return false;
}

/**
 * Validates whether the actor can reset the password for a target user.
 */
export function canActorResetPassword(
  actorRole: OrganizationRoleCode,
  actorUserId: number,
  targetRole: OrganizationRoleCode,
  targetUserId: number,
): boolean {
  return canActorManageTarget(actorRole, actorUserId, targetRole, targetUserId);
}

/**
 * Validates whether the actor can view sensitive fields (loginEmail, contactEmail) of a target user.
 */
export function canActorViewSensitiveDetails(
  actorRole: OrganizationRoleCode,
  actorUserId: number,
  targetRole: OrganizationRoleCode,
  targetUserId: number,
): boolean {
  if (actorUserId === targetUserId) {
    return true;
  }

  if (actorRole === 'owner') {
    return true;
  }

  if (actorRole === 'admin') {
    // Admin cannot view restricted management data of Owner or other Admins
    return ROLES_BELOW_ADMIN.includes(targetRole);
  }

  return false;
}

/**
 * Validates whether the actor can view the audit history of a target user.
 */
export function canActorViewAudit(
  actorRole: OrganizationRoleCode,
  actorUserId: number,
  targetRole: OrganizationRoleCode,
  targetUserId: number,
): boolean {
  return canActorViewSensitiveDetails(actorRole, actorUserId, targetRole, targetUserId);
}

/**
 * Computes all capabilities for an actor viewing/managing a target user in an Organization.
 */
export function computeUserCapabilities(
  actorRole: OrganizationRoleCode,
  actorUserId: number,
  targetRole: OrganizationRoleCode,
  targetUserId: number,
): UserAccessCapabilities {
  const canManage = canActorManageTarget(actorRole, actorUserId, targetRole, targetUserId);
  const canViewSensitive = canActorViewSensitiveDetails(
    actorRole,
    actorUserId,
    targetRole,
    targetUserId,
  );
  const canViewAuditLog = canActorViewAudit(
    actorRole,
    actorUserId,
    targetRole,
    targetUserId,
  );

  return {
    canEditProfile: canManage,
    canChangeRole: canManage,
    canResetPassword: canManage,
    canRemove: canManage,
    canViewLoginEmail: canViewSensitive,
    canViewContactEmail: canViewSensitive,
    canViewAudit: canViewAuditLog,
    allowedRolesToAssign: getAllowedRolesToAssign(actorRole),
  };
}
