/**
 * Platform Adapter Utility — Pure and stateless functions to bridge
 * the normalized `connection.platform` data into backward-compatible DTOs.
 */

import type { PlatformCatalog } from '@prisma/client';

export type HasPlatformConnection = {
  connection: {
    platformId: number;
    platform: PlatformCatalog;
    [key: string]: unknown;
  };
};

export type WithPlatformDto<T> = T & {
  platformId: number;
  platform: PlatformCatalog;
};

/**
 * Pure utility to map an entity containing a `connection.platform` relation
 * into a backward-compatible DTO containing top-level `platformId` and `platform`.
 */
export function withPlatform<T extends HasPlatformConnection>(entity: T): WithPlatformDto<T> {
  return {
    ...entity,
    platformId: entity.connection.platformId,
    platform: entity.connection.platform,
  };
}

/**
 * Pure utility to map a list of entities with `connection.platform`.
 */
export function withPlatforms<T extends HasPlatformConnection>(
  entities: readonly T[],
): WithPlatformDto<T>[] {
  return entities.map(withPlatform);
}

/**
 * Pure utility to map an order entity, attaching both top-level `platformId`/`platform`
 * and nested customer `platformId`/`platform` if the customer relation is present.
 */
export function withOrderPlatform<
  T extends HasPlatformConnection & {
    customer?: (HasPlatformConnection & Record<string, unknown>) | null;
  },
>(order: T): WithPlatformDto<T> {
  return {
    ...order,
    platformId: order.connection.platformId,
    platform: order.connection.platform,
    ...(order.customer
      ? {
          customer: {
            ...order.customer,
            platformId: order.customer.connection.platformId,
            platform: order.customer.connection.platform,
          },
        }
      : {}),
  };
}
