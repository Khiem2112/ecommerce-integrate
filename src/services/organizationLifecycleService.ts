import { prisma } from '@/lib/prisma';
import type { DbClient, OrganizationStatusCode } from '@/types';
import { appendOrganizationAuditService } from './organizationAuditService';
import { getActiveOrganizationMembershipService } from './organizationMembershipService';

type ChangeOrganizationLifecycleInput = {
  readonly organizationId: number;
  readonly targetStatus: OrganizationStatusCode;
  readonly expectedVersion: number;
  readonly confirmation?: string;
};

export async function changeOrganizationLifecycleService(
  actorUserId: number,
  input: ChangeOrganizationLifecycleInput,
  tx: DbClient = prisma,
): Promise<void> {
  const membership = await getActiveOrganizationMembershipService(
    actorUserId,
    input.organizationId,
    tx,
  );

  if (membership.role !== 'owner') {
    throw new Error('Only an owner can change organization lifecycle.');
  }

  const organization = await tx.organization.findFirst({
    where: {
      id: input.organizationId,
      isActive: true,
    },
    include: {
      status: true,
      _count: {
        select: {
          connections: {
            where: {
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!organization) {
    throw new Error('Organization is unavailable.');
  }

  if (organization.version !== input.expectedVersion) {
    throw new Error('Organization was changed by another user.');
  }

  if (
    input.targetStatus === 'archived' &&
    input.confirmation !== organization.displayName
  ) {
    throw new Error('Organization name confirmation does not match.');
  }

  const target = await tx.organizationStatus.findFirst({
    where: {
      code: input.targetStatus,
      isActive: true,
    },
  });

  if (!target) {
    throw new Error('Organization status is unavailable.');
  }

  await tx.organization.update({
    where: {
      id: organization.id,
    },
    data: {
      statusId: target.id,
      version: {
        increment: 1,
      },
    },
  });

  await appendOrganizationAuditService(
    {
      organizationId: organization.id,
      actorUserId,
      action: `lifecycle.${input.targetStatus}`,
      targetType: 'organization',
      targetId: String(organization.id),
      beforeSnapshot: {
        status: organization.status.code,
      },
      afterSnapshot: {
        status: target.code,
        affectedShopCount: organization._count.connections,
      },
    },
    tx,
  );
}
