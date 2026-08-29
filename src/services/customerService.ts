/**
 * Customer Service — data access layer for customer profile and evidence records.
 * Supports transaction client injection for atomic multi-service operations.
 */

import { prisma } from '@/lib/prisma';
import type { DbClient, CustomerWithRelations, CustomerEvidenceRecord } from '@/types';

/** Fetch full customer with VIP tier and platform */
export async function getCustomerById(
  id: number,
  tx: DbClient = prisma,
): Promise<CustomerWithRelations | null> {
  return tx.customer.findUnique({
    where: { id },
    include: {
      vipTier: true,
      platform: true,
    },
  });
}

/** Fetch evidence-backed facts for a customer (Layer 3 memory) */
export async function getCustomerEvidences(
  customerId: number,
  minConfidence: number = 0.5,
  tx: DbClient = prisma,
): Promise<CustomerEvidenceRecord[]> {
  return tx.customerEvidence.findMany({
    where: {
      customerId,
      isActive: true,
      confidence: { gte: minConfidence },
    },
    orderBy: { lastObserved: 'desc' },
  });
}
