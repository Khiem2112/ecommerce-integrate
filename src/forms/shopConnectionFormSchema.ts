import { z } from 'zod';
import {
  PLATFORM_CONNECTION_STATUS_CODES,
  SUPPORTED_SHOP_PLATFORM_CODES,
  type SupportedShopPlatformCode,
} from '@/types';

export const shopConnectionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .union([
      z.array(z.enum(PLATFORM_CONNECTION_STATUS_CODES)),
      z.enum(PLATFORM_CONNECTION_STATUS_CODES).transform((s) => [s]),
      z.string().transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter((s): s is (typeof PLATFORM_CONNECTION_STATUS_CODES)[number] =>
            PLATFORM_CONNECTION_STATUS_CODES.includes(
              s as (typeof PLATFORM_CONNECTION_STATUS_CODES)[number],
            ),
          ),
      ),
    ])
    .optional(),
  organizationId: z.coerce.number().int().positive().optional(),
});

export type ShopConnectionFilterValues = z.infer<typeof shopConnectionFilterSchema>;
export type ShopConnectionFilterInput = {
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?:
    | (typeof PLATFORM_CONNECTION_STATUS_CODES)[number]
    | readonly (typeof PLATFORM_CONNECTION_STATUS_CODES)[number][];
  readonly organizationId?: number;
};

// ============================================================
// Label Update Schema & Factory
// ============================================================

export type ShopConnectionLabelUpdateMessages = {
  readonly invalidConnectionId?: string;
  readonly emptyLabel?: string;
  readonly maxLabel?: string;
  readonly invalidVersion?: string;
};

export type ShopConnectionLabelUpdateValues = {
  readonly connectionId: number;
  readonly displayLabel: string;
  readonly expectedVersion: number;
  readonly idempotencyKey?: string;
};

export function getShopConnectionLabelUpdateSchema(
  messages?: ShopConnectionLabelUpdateMessages,
): z.ZodType<ShopConnectionLabelUpdateValues, any> {
  return z.object({
    connectionId: z.number().int().positive(messages?.invalidConnectionId),
    displayLabel: z
      .string()
      .trim()
      .min(1, messages?.emptyLabel)
      .max(191, messages?.maxLabel),
    expectedVersion: z.number().int().positive(messages?.invalidVersion),
    idempotencyKey: z.string().trim().max(191).optional(),
  });
}

export const shopConnectionLabelUpdateSchema = getShopConnectionLabelUpdateSchema();

// ============================================================
// Authorization Start Schema & Factory
// ============================================================

export type ShopConnectionStartAuthorizationMessages = {
  readonly invalidPlatform?: string;
  readonly organizationRequired?: string;
  readonly invalidShopDomain?: string;
};

export type ShopConnectionStartAuthorizationValues = {
  readonly platformCode: SupportedShopPlatformCode;
  readonly organizationId: number;
  readonly connectionId?: number;
  readonly shopDomain?: string;
  readonly idempotencyKey?: string;
};

export function getShopConnectionStartAuthorizationSchema(
  messages?: ShopConnectionStartAuthorizationMessages,
): z.ZodType<ShopConnectionStartAuthorizationValues, any> {
  return z.object({
    platformCode: z.enum(SUPPORTED_SHOP_PLATFORM_CODES, {
      message: messages?.invalidPlatform,
    }),
    organizationId: z.number().int().positive(messages?.organizationRequired),
    connectionId: z.number().int().positive().optional(),
    shopDomain: z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.myshopify\.com)?$/,
        messages?.invalidShopDomain,
      )
      .optional(),
    idempotencyKey: z.string().trim().max(191).optional(),
  });
}

export const shopConnectionStartAuthorizationSchema =
  getShopConnectionStartAuthorizationSchema();

// ============================================================
// Disconnect Schema & Factory
// ============================================================

export type ShopConnectionDisconnectMessages = {
  readonly invalidConnectionId?: string;
  readonly invalidVersion?: string;
};

export type ShopConnectionDisconnectValues = {
  readonly connectionId: number;
  readonly expectedVersion: number;
  readonly idempotencyKey?: string;
};

export function getShopConnectionDisconnectSchema(
  messages?: ShopConnectionDisconnectMessages,
): z.ZodType<ShopConnectionDisconnectValues, any> {
  return z.object({
    connectionId: z.number().int().positive(messages?.invalidConnectionId),
    expectedVersion: z.number().int().positive(messages?.invalidVersion),
    idempotencyKey: z.string().trim().max(191).optional(),
  });
}

export const shopConnectionDisconnectSchema = getShopConnectionDisconnectSchema();

// ============================================================
// Reassign Schema & Factory
// ============================================================

export type ShopConnectionReassignMessages = {
  readonly invalidConnectionId?: string;
  readonly targetOrganizationRequired?: string;
  readonly invalidVersion?: string;
};

export type ShopConnectionReassignValues = {
  readonly connectionId: number;
  readonly targetOrganizationId: number;
  readonly expectedVersion: number;
  readonly idempotencyKey?: string;
};

export function getShopConnectionReassignSchema(
  messages?: ShopConnectionReassignMessages,
): z.ZodType<ShopConnectionReassignValues, any> {
  return z.object({
    connectionId: z.number().int().positive(messages?.invalidConnectionId),
    targetOrganizationId: z.number().int().positive(messages?.targetOrganizationRequired),
    expectedVersion: z.number().int().positive(messages?.invalidVersion),
    idempotencyKey: z.string().trim().max(191).optional(),
  });
}

export const shopConnectionReassignSchema = getShopConnectionReassignSchema();
