/**
 * Resolves the single shop connection for a platform (MVP: one shop per platform).
 */

import type { PlatformConnection } from '@prisma/client';
import type { DbClient } from '@/types';
import { getCurrentOrganizationIdService } from './organizationContextService';

export async function ensurePlatformConnectionService(
  platformId: number,
  tx: DbClient,
): Promise<PlatformConnection> {
  const organizationId = await getCurrentOrganizationIdService(tx);
  const existing = await tx.platformConnection.findFirst({
    where: { organizationId, platformId, isActive: true },
  });
  if (existing) {
    return existing;
  }

  return tx.platformConnection.create({
    data: {
      organizationId,
      platformId,
      isActive: true,
    },
  });
}
