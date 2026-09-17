import { prisma } from '@/lib/prisma';
import type { DbClient, OrganizationRoleCode } from '@/types';
import { appendOrganizationAuditService } from './organizationAuditService';

type MembershipInput = {
  readonly organizationId: number;
  readonly userId: number;
  readonly operation: 'add' | 'change_role' | 'remove';
  readonly role?: OrganizationRoleCode;
};

type ActiveMembershipResult = {
  readonly id: number;
  readonly role: OrganizationRoleCode;
};

export async function getActiveOrganizationMembershipService(
  userId: number,
  organizationId: number,
  tx: DbClient = prisma,
): Promise<ActiveMembershipResult> {
  const membership = await tx.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
    },
    select: {
      id: true,
      role: {
        select: {
          code: true,
        },
      },
    },
  });

  if (!membership) {
    throw new Error('Organization membership is unavailable.');
  }

  return {
    id: membership.id,
    role: membership.role.code as OrganizationRoleCode,
  };
}

function canManageMembers(role: OrganizationRoleCode): boolean {
  return role === 'owner' || role === 'admin';
}

async function ensureNotLastOwner(
  organizationId: number,
  targetUserId: number,
  tx: DbClient,
): Promise<void> {
  const target = await tx.organizationMember.findFirst({
    where: {
      organizationId,
      userId: targetUserId,
      isActive: true,
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
    },
    include: {
      role: true,
    },
  });

  if (!target || target.role.code !== 'owner') {
    return;
  }

  const owners = await tx.organizationMember.count({
    where: {
      organizationId,
      isActive: true,
      role: {
        code: 'owner',
        isActive: true,
      },
      membershipStatus: {
        code: 'active',
        isActive: true,
      },
    },
  });

  if (owners <= 1) {
    throw new Error('The last owner cannot be removed or demoted.');
  }
}

export async function mutateOrganizationMembershipService(
  actorUserId: number,
  input: MembershipInput,
  tx: DbClient = prisma,
): Promise<void> {
  const actor = await getActiveOrganizationMembershipService(
    actorUserId,
    input.organizationId,
    tx,
  );

  if (!canManageMembers(actor.role)) {
    throw new Error('Insufficient permission to manage members.');
  }

  const target = await tx.organizationMember.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
    },
    include: {
      role: true,
    },
  });

  if (actor.role === 'admin' && target?.role.code === 'owner') {
    throw new Error('Admins cannot change an owner membership.');
  }

  if (input.operation === 'add') {
    if (!input.role || input.role === 'owner') {
      throw new Error('A new member must receive a non-owner role.');
    }

    const [user, role, activeStatus] = await Promise.all([
      tx.user.findFirst({
        where: {
          id: input.userId,
          isActive: true,
        },
      }),
      tx.organizationRoleCatalog.findFirst({
        where: {
          code: input.role,
          isActive: true,
        },
      }),
      tx.organizationMembershipStatus.findFirst({
        where: {
          code: 'active',
          isActive: true,
        },
      }),
    ]);

    if (!user || !role || !activeStatus) {
      throw new Error('Member data is unavailable.');
    }

    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      create: {
        organizationId: input.organizationId,
        userId: input.userId,
        roleId: role.id,
        membershipStatusId: activeStatus.id,
        displayName: user.displayName,
      },
      update: {
        roleId: role.id,
        membershipStatusId: activeStatus.id,
        isActive: true,
      },
    });
  } else if (input.operation === 'change_role') {
    if (!target || !input.role) {
      throw new Error('Member role data is unavailable.');
    }

    if (input.role === 'owner' && actor.role !== 'owner') {
      throw new Error('Only owners can assign the owner role.');
    }

    if (target.role.code === 'owner' && input.role !== 'owner') {
      await ensureNotLastOwner(input.organizationId, input.userId, tx);
    }

    const role = await tx.organizationRoleCatalog.findFirst({
      where: {
        code: input.role,
        isActive: true,
      },
    });

    if (!role) {
      throw new Error('Role is unavailable.');
    }

    await tx.organizationMember.update({
      where: {
        id: target.id,
      },
      data: {
        roleId: role.id,
      },
    });
  } else {
    if (!target) {
      throw new Error('Member is unavailable.');
    }

    await ensureNotLastOwner(input.organizationId, input.userId, tx);

    const removedStatus = await tx.organizationMembershipStatus.findFirst({
      where: {
        code: 'removed',
        isActive: true,
      },
    });

    if (!removedStatus) {
      throw new Error('Membership status is unavailable.');
    }

    await tx.organizationMember.update({
      where: {
        id: target.id,
      },
      data: {
        membershipStatusId: removedStatus.id,
        isActive: false,
      },
    });
  }

  await appendOrganizationAuditService(
    {
      organizationId: input.organizationId,
      actorUserId,
      action: `membership.${input.operation}`,
      targetType: 'user',
      targetId: String(input.userId),
      afterSnapshot: {
        role: input.role ?? null,
      },
    },
    tx,
  );
}
