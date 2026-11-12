import type { RetentionStrategyCatalog } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DbClient } from '@/types';
import { formatRetentionStrategyCatalogForPrompt, parsePositiveIntEnv } from '@/utils/rag';

export type RetentionStrategy = RetentionStrategyCatalog;

export const DEFAULT_STRATEGY_CACHE_TTL_MS = 60_000;

type StrategyCacheEntry = {
  readonly data: readonly RetentionStrategy[];
  readonly expiresAt: number;
};

let strategyCacheEntry: StrategyCacheEntry | null = null;
let strategyCacheGeneration = 0;

function resolveStrategyCacheTtlMs(): number {
  return parsePositiveIntEnv(
    process.env.STRATEGY_CACHE_TTL_MS,
    DEFAULT_STRATEGY_CACHE_TTL_MS,
  );
}

/** Invalidate the in-memory active retention strategy cache. */
export function invalidateRetentionStrategyCache(): void {
  strategyCacheEntry = null;
  strategyCacheGeneration += 1;
}

/** Retrieve the active strategies from the database that the provider may select. */
export async function getActiveRetentionStrategies(
  tx: DbClient = prisma,
): Promise<readonly RetentionStrategy[]> {
  if (tx !== prisma) {
    return tx.retentionStrategyCatalog.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  const now = Date.now();
  if (strategyCacheEntry && strategyCacheEntry.expiresAt > now) {
    return strategyCacheEntry.data;
  }

  const generationAtFetch = strategyCacheGeneration;
  const strategies = await prisma.retentionStrategyCatalog.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  if (generationAtFetch === strategyCacheGeneration) {
    strategyCacheEntry = {
      data: strategies,
      expiresAt: Date.now() + resolveStrategyCacheTtlMs(),
    };
  }

  return strategies;
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
