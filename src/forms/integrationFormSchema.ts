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

export const syncBatchListFilterSchema = z.object({
  platform: z.string().trim().optional(),
  status: z.enum(['queued', 'running', 'completed', 'partial', 'failed', 'cancelled']).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  batchCode: z.string().trim().max(191).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const syncBatchIdSchema = z.number().int().positive();

export const syncOrdersQuerySchema = z.object({
  batchId: syncBatchIdSchema,
  changeType: z.enum(['created', 'updated', 'unchanged', 'failed']).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const syncOrderDiffQuerySchema = z.object({
  batchId: syncBatchIdSchema,
  externalOrderId: z.string().trim().min(1).max(191),
});

export const retrySelectedSyncOrdersSchema = z.object({
  batchId: syncBatchIdSchema,
  externalOrderIds: z.array(z.string().trim().min(1).max(191)).min(1).max(100),
});

export type PlatformInput = z.infer<typeof platformSchema>;
export type SyncParamsInput = z.infer<typeof syncParamsSchema>;
export type RefreshOrderInput = z.infer<typeof refreshOrderSchema>;
export type BatchCodeInput = z.infer<typeof batchCodeSchema>;
export type SyncChangeQueryInput = z.infer<typeof syncChangeQuerySchema>;
export type SyncBatchListFilterInput = z.infer<typeof syncBatchListFilterSchema>;
export type SyncOrdersQueryInput = z.infer<typeof syncOrdersQuerySchema>;
export type SyncOrderDiffQueryInput = z.infer<typeof syncOrderDiffQuerySchema>;
export type RetrySelectedSyncOrdersInput = z.infer<typeof retrySelectedSyncOrdersSchema>;
