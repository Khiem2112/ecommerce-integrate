import { z } from 'zod';

/**
 * Zod validation schemas for channel integrations and synchronization actions.
 */

export const platformSchema = z
  .enum(['lazada', 'shopify', 'tiktok_shop', 'mock'])
  .default('lazada');

export const syncParamsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  updateAfter: z.coerce.date().optional(),
  updateBefore: z.coerce.date().optional(),
  seed: z.string().optional(),
});

export const refreshOrderSchema = z.union([
  z.string().min(1, 'Mã đơn hàng không được để trống').transform((val) => ({ externalOrderId: val })),
  z.object({
    externalOrderId: z.string().min(1, 'Mã đơn hàng không được để trống'),
  }),
]);

export const batchCodeSchema = z.string().min(1, 'Mã đợt đồng bộ không được để trống');

export const syncChangeQuerySchema = z.object({
  batchCode: z.string().optional(),
  externalOrderId: z.string().optional(),
  externalItemId: z.string().optional(),
  entityType: z.enum(['order', 'order_item']).optional(),
  changeType: z.enum(['created', 'updated', 'inactivated']).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export type PlatformInput = z.infer<typeof platformSchema>;
export type SyncParamsInput = z.infer<typeof syncParamsSchema>;
export type RefreshOrderInput = z.infer<typeof refreshOrderSchema>;
export type BatchCodeInput = z.infer<typeof batchCodeSchema>;
export type SyncChangeQueryInput = z.infer<typeof syncChangeQuerySchema>;
