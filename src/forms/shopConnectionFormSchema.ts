import { z } from 'zod';
import {
  PLATFORM_CONNECTION_STATUS_CODES,
  SHOP_CONNECTION_HEALTH_STATUS_CODES,
  type ShopConnectionHealthStatusCode,
  SUPPORTED_SHOP_PLATFORM_CODES,
  type SupportedShopPlatformCode,
  SHOP_ENVIRONMENTS,
  type ShopEnvironment,
  SHOP_AUTH_METHODS,
  type ShopAuthMethod,
} from '@/types';

export const shopConnectionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .union([
      z.array(z.enum(SHOP_CONNECTION_HEALTH_STATUS_CODES)),
      z.enum(SHOP_CONNECTION_HEALTH_STATUS_CODES).transform((s) => [s]),
      z.string().transform((val) =>
        val
          .split(',')
          .map((s) => s.trim())
          .filter((s): s is ShopConnectionHealthStatusCode =>
            SHOP_CONNECTION_HEALTH_STATUS_CODES.includes(
              s as ShopConnectionHealthStatusCode,
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
    | ShopConnectionHealthStatusCode
    | readonly ShopConnectionHealthStatusCode[];
  readonly organizationId?: number;
};

export const shopConnectionStatsSchema = z.object({
  organizationId: z.number().int().positive().optional(),
}).strict();

export type ShopConnectionStatsInput = z.infer<typeof shopConnectionStatsSchema>;

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
): z.ZodType<ShopConnectionLabelUpdateValues, ShopConnectionLabelUpdateValues> {
  return z.object({
    connectionId: z.number().int().positive(messages?.invalidConnectionId),
    displayLabel: z
      .string()
      .trim()
      .min(1, messages?.emptyLabel)
      .max(191, messages?.maxLabel),
    expectedVersion: z.number().int().positive(messages?.invalidVersion),
    idempotencyKey: z.string().trim().max(191).optional(),
  }).strict();
}

export const shopConnectionLabelUpdateSchema = getShopConnectionLabelUpdateSchema();

// ============================================================
// Authorization Start Schema & Factory
// ============================================================

export type ShopConnectionStartAuthorizationMessages = {
  readonly invalidPlatform?: string;
  readonly organizationRequired?: string;
  readonly invalidShopDomain?: string;
  readonly sandboxTokenRequired?: string;
};

export type ShopConnectionStartAuthorizationValues = {
  readonly platformCode: SupportedShopPlatformCode;
  readonly organizationId: number;
  readonly connectionId?: number;
  readonly shopDomain?: string;
  readonly idempotencyKey?: string;
  readonly environment?: ShopEnvironment;
  readonly authMethod?: ShopAuthMethod;
  readonly sandboxAccessToken?: string;
  readonly sandboxShopName?: string;
};

export function getShopConnectionStartAuthorizationSchema(
  messages?: ShopConnectionStartAuthorizationMessages,
): z.ZodType<ShopConnectionStartAuthorizationValues, ShopConnectionStartAuthorizationValues> {
  return z
    .object({
      platformCode: z.enum(SUPPORTED_SHOP_PLATFORM_CODES, {
        message: messages?.invalidPlatform,
      }),
      organizationId: z.number().int().positive(messages?.organizationRequired),
      connectionId: z.number().int().positive().optional(),
      shopDomain: z.string().trim().optional(),
      idempotencyKey: z.string().trim().max(191).optional(),
      environment: z.enum(SHOP_ENVIRONMENTS).optional(),
      authMethod: z.enum(SHOP_AUTH_METHODS).optional(),
      sandboxAccessToken: z.string().trim().optional(),
      sandboxShopName: z.string().trim().max(100).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.platformCode === 'shopify') {
        if (!data.shopDomain || data.shopDomain.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages?.invalidShopDomain,
            path: ['shopDomain'],
          });
        } else if (
          !/^[a-zA-Z0-9][a-zA-Z0-9-]*(\.myshopify\.com)?$/.test(data.shopDomain)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages?.invalidShopDomain,
            path: ['shopDomain'],
          });
        }
      } else if (data.environment === 'sandbox' && data.authMethod === 'manual_token') {
        if (data.platformCode === 'lazada' && (!data.sandboxAccessToken || data.sandboxAccessToken.trim() === '')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages?.sandboxTokenRequired,
            path: ['sandboxAccessToken'],
          });
        }
      }
 else if (data.shopDomain && data.shopDomain.trim() !== '') {
        if (
          !/^[a-zA-Z0-9][a-zA-Z0-9-]*(\.myshopify\.com)?$/.test(data.shopDomain)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: messages?.invalidShopDomain,
            path: ['shopDomain'],
          });
        }
      }
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
): z.ZodType<ShopConnectionDisconnectValues, ShopConnectionDisconnectValues> {
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
): z.ZodType<ShopConnectionReassignValues, ShopConnectionReassignValues> {
  return z.object({
    connectionId: z.number().int().positive(messages?.invalidConnectionId),
    targetOrganizationId: z.number().int().positive(messages?.targetOrganizationRequired),
    expectedVersion: z.number().int().positive(messages?.invalidVersion),
    idempotencyKey: z.string().trim().max(191).optional(),
  });
}

export const shopConnectionReassignSchema = getShopConnectionReassignSchema();
