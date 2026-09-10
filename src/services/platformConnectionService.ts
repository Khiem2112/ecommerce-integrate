/**
 * Resolves the single shop connection for a platform (MVP: one shop per platform).
 */

import type { PlatformConnection } from '@prisma/client';
import type { DbClient } from '@/types';

export async function ensurePlatformConnectionService(
  platformId: number,
  tx: DbClient,
): Promise<PlatformConnection> {
  const existing = await tx.platformConnection.findUnique({
    where: { platformId },
  });
  if (existing) {
    return existing;
  }

  return tx.platformConnection.create({
    data: {
      platformId,
      isActive: true,
    },
  });
}
