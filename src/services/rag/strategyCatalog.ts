import type { RetentionStrategyCatalog } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DbClient } from '@/types';
import { formatRetentionStrategyCatalogForPrompt } from '@/utils/rag/promptUtils';

export type RetentionStrategy = RetentionStrategyCatalog;

/** Retrieve the active strategies from the database that the provider may select. */
export async function getActiveRetentionStrategies(
  tx: DbClient = prisma,
): Promise<readonly RetentionStrategy[]> {
  return tx.retentionStrategyCatalog.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
}

/** Look up an active retention strategy from the database using its stable catalog code. */
export async function getActiveRetentionStrategyByCode(
  code: RetentionStrategyCatalog['code'],
  tx: DbClient = prisma,
): Promise<RetentionStrategy | null> {
  return tx.retentionStrategyCatalog.findFirst({
    where: { code, isActive: true },
  });
}

export { formatRetentionStrategyCatalogForPrompt };
