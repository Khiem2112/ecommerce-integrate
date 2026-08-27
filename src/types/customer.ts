/**
 * Customer domain types.
 * Derives from Prisma-generated types via `prisma generate`.
 */

import type { Prisma } from '@prisma/client';

/** Customer with VIP tier and platform relations included */
type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: { vipTier: true; platform: true };
}>;

/** Evidence-backed fact about a customer (Layer 3 memory) */
type CustomerEvidenceRecord = Prisma.CustomerEvidenceGetPayload<object>;

/** Complete customer data bundle: profile + relations + evidences */
type CustomerWithDetails = CustomerWithRelations & {
  readonly evidences: readonly CustomerEvidenceRecord[];
};

export type {
  CustomerWithRelations,
  CustomerEvidenceRecord,
  CustomerWithDetails,
};
