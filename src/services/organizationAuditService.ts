import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DbClient } from '@/types';

type AppendOrganizationAuditInput = {
  readonly organizationId: number;
  readonly actorUserId: number | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string;
  readonly beforeSnapshot?: Prisma.InputJsonValue;
  readonly afterSnapshot?: Prisma.InputJsonValue;
  readonly correlationId?: string;
};

export async function appendOrganizationAuditService(
  input: AppendOrganizationAuditInput,
  tx: DbClient = prisma,
): Promise<void> {
  await tx.organizationAuditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      correlationId: input.correlationId,
    },
  });
}
