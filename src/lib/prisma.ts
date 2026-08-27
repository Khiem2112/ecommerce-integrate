/**
 * Prisma Client singleton for Next.js.
 * Prevents hot-reload from creating multiple connections in development.
 *
 * Usage: import { prisma } from '@/lib/prisma';
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
