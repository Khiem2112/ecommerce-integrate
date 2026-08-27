/**
 * Customer Service — data access layer for customer domain.
 * Returns Prisma-derived types directly. No manual field mapping needed.
 */

import { prisma } from '@/lib/prisma';
import type { CustomerWithRelations, CustomerEvidenceRecord } from '@/types';

/** Fetch full customer with VIP tier and platform */
export async function getCustomerById(id: number): Promise<CustomerWithRelations | null> {
  return prisma.customer.findUnique({
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
): Promise<CustomerEvidenceRecord[]> {
  return prisma.customerEvidence.findMany({
    where: {
      customerId,
      isActive: true,
      confidence: { gte: minConfidence },
    },
    orderBy: { lastObserved: 'desc' },
  });
}
