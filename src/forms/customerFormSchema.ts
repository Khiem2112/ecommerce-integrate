import { z } from 'zod';

export const customerFilterSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    keyword: z.string().optional(),
    platformId: z.coerce.number().int().positive().optional(),
    vipTierId: z.coerce.number().int().positive().optional(),
    minVipScore: z.coerce.number().min(0).max(100).optional(),
    maxVipScore: z.coerce.number().min(0).max(100).optional(),
    sortBy: z
      .enum(['vipScore', 'totalSpend', 'orderCount', 'createdAt', 'daysSinceLastOrder', 'avgOrderValue'])
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .refine(
    (data) =>
      data.minVipScore === undefined ||
      data.maxVipScore === undefined ||
      data.minVipScore <= data.maxVipScore,
    {
      message: 'Điểm VIP tối thiểu không được lớn hơn điểm VIP tối đa.',
      path: ['minVipScore'],
    },
  );

export const customerUpdateSchema = z.object({
  id: z.number().int().positive('Mã khách hàng không hợp lệ'),
  preferredLanguage: z.string().max(10, 'Mã ngôn ngữ không vượt quá 10 ký tự').nullable().optional(),
  consentStatus: z.enum(['granted', 'revoked']).optional(),
  frequentCategories: z.array(z.string()).nullable().optional(),
  updatedAt: z.string().optional(),
});

export const getCustomerSchema = z.object({
  id: z.number().int().positive('Mã khách hàng không hợp lệ'),
});

export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
export type CustomerUpdateFormValues = z.infer<typeof customerUpdateSchema>;
export type GetCustomerInput = z.infer<typeof getCustomerSchema>;
