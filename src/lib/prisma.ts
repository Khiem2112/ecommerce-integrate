/**
 * Prisma Client singleton for Next.js.
 * Prevents hot-reload from creating multiple connections in development.
 *
 * Usage: import { prisma } from '@/lib/prisma';
 */

import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Executes a database operation within a transaction if client is a root PrismaClient,
 * or runs directly on the scoped transaction client.
 */
export async function runWithTx<T>(
  client: Prisma.TransactionClient | PrismaClient,
  fn: (txClient: Prisma.TransactionClient | PrismaClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in client && typeof client.$transaction === 'function') {
    return await (client as PrismaClient).$transaction(fn);
  }
  return await fn(client);
}

