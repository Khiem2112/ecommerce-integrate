import type { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/prisma';

export type ActionErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'CONVERSATION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'ANTI_SPAM_QUOTA_EXCEEDED'
  | 'PLATFORM_SEND_FAILED'
  | 'DRAFT_VALIDATION_FAILED'
  | 'SYSTEM_ERROR';

/** Standard Server Action response payload */
export type ActionResponse<T> = {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly code?: ActionErrorCode;
};

/** Database client type supporting both Prisma singleton and active transaction context */
export type DbClient = Prisma.TransactionClient | typeof prisma;
