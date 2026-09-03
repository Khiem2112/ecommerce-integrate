/**
 * Catalog & Master Data Service — Data access layer for platform, VIP tier, status, and category catalogs.
 * Supports transaction client injection (`tx`) for atomic operations.
 * Enforces Single Responsibility Principle (SRP) with pure atomic catalog lookups.
 */

import { prisma } from '@/lib/prisma';
import type { DbClient } from '@/types';

/**
 * Fetch all active e-commerce platforms (Lazada, Shopify, TikTok Shop, Synthetic).
 */
export async function getPlatformsService(
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
  }[]
> {
  return tx.platformCatalog.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { id: 'asc' },
  });
}

/**
 * Fetch all active VIP tier classifications with score ranges and priorities.
 */
export async function getVipTiersService(
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
    readonly minScore: number;
    readonly maxScore: number;
    readonly priority: number;
  }[]
> {
  return tx.vipTierCatalog.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      minScore: true,
      maxScore: true,
      priority: true,
    },
    orderBy: { priority: 'desc' },
  });
}

/**
 * Fetch all active product categories.
 */
export async function getCategoriesService(
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
    readonly parentId: number | null;
  }[]
> {
  return tx.categoryCatalog.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, parentId: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Fetch all active order statuses.
 */
export async function getOrderStatusesService(
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
    readonly isFinal: boolean;
    readonly sortOrder: number;
  }[]
> {
  return tx.orderStatus.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, isFinal: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Fetch all active conversation resolution statuses.
 */
export async function getConversationStatusesService(
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
    readonly isFinal: boolean;
    readonly sortOrder: number;
  }[]
> {
  return tx.conversationStatus.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, isFinal: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Fetch all active escalation statuses.
 */
export async function getEscalationStatusesService(
  tx: DbClient = prisma,
): Promise<
  readonly {
    readonly id: number;
    readonly code: string;
    readonly name: string;
  }[]
> {
  return tx.escalationStatus.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { id: 'asc' },
  });
}
