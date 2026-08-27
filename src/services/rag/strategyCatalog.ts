import type { RetentionStrategyCatalog } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type RetentionStrategy = RetentionStrategyCatalog;

/** Retrieve the active strategies from the database that the provider may select. */
export async function getActiveRetentionStrategies(): Promise<readonly RetentionStrategy[]> {
  return prisma.retentionStrategyCatalog.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
}

/** Look up an active retention strategy from the database using its stable catalog code. */
export async function getActiveRetentionStrategyByCode(
  code: RetentionStrategyCatalog['code'],
): Promise<RetentionStrategy | null> {
  return prisma.retentionStrategyCatalog.findFirst({
    where: { code, isActive: true },
  });
}

/** Format database-owned strategy metadata for internal LLM provider instructions. */
export function formatRetentionStrategyCatalogForPrompt(
  strategies: readonly RetentionStrategy[],
): string {
  return strategies.map((strategy) => (
    `- ${strategy.code}: ${strategy.name}. Tone: ${strategy.tone}. Focus: ${strategy.retentionFocus}. Guidance: ${strategy.selectionGuidance}`
  )).join('\n');
}
