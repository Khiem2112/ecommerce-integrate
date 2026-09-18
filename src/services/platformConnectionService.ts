/**
 * Platform Connection Resolution Service.
 * Resolves concrete shop connections without creating silent empty placeholders.
 */

import type { PlatformConnection } from '@prisma/client';
import type { DbClient } from '@/types';
import { getCurrentOrganizationIdService } from './organizationContextService';

/**
 * Resolves an active shop connection by its explicit connection ID.
 */
export async function resolvePlatformConnectionByIdService(
  connectionId: number,
  tx: DbClient,
): Promise<PlatformConnection> {
  const connection = await tx.platformConnection.findFirst({
    where: { id: connectionId, isActive: true },
  });

  if (!connection) {
    throw new Error(`Không tìm thấy kết nối gian hàng khả dụng (ID: ${connectionId}).`);
  }

  return connection;
}

/**
 * Finds an active connection for an organization and platform if it exists.
 */
export async function findActivePlatformConnectionService(
  organizationId: number,
  platformId: number,
  tx: DbClient,
): Promise<PlatformConnection | null> {
  return tx.platformConnection.findFirst({
    where: { organizationId, platformId, isActive: true },
  });
}

/**
 * Resolves existing active platform connection for current organization context.
 * Strictly avoids silent auto-creation of placeholder connections.
 */
export async function ensurePlatformConnectionService(
  platformId: number,
  tx: DbClient,
  preferredConnectionId?: number,
): Promise<PlatformConnection> {
  if (preferredConnectionId && preferredConnectionId > 0) {
    return resolvePlatformConnectionByIdService(preferredConnectionId, tx);
  }

  const organizationId = await getCurrentOrganizationIdService(tx);
  const existing = await tx.platformConnection.findFirst({
    where: { organizationId, platformId, isActive: true },
  });

  if (!existing) {
    throw new Error(
      'Không tìm thấy kết nối gian hàng đang hoạt động cho nền tảng này. Vui lòng kết nối gian hàng tại mục Quản lý gian hàng trước.',
    );
  }

  return existing;
}
