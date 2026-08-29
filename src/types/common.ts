import type { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/prisma';

/** Standard Server Action response payload */
export type ActionResponse<T> = {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
};

/** Database client type supporting both Prisma singleton and active transaction context */
export type DbClient = Prisma.TransactionClient | typeof prisma;
