import { z } from 'zod';
import { ORGANIZATION_ROLE_CODES, ORGANIZATION_STATUS_CODES } from '@/types';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organizationFormSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(63).regex(slugPattern),
  timezone: z.string().trim().min(1).max(64),
  baseCurrency: z.string().trim().length(3),
  logoUrl: z.union([z.string().url(), z.literal('')]).optional(),
  legalName: z.string().trim().max(191).optional(),
  countryCode: z.string().trim().length(2).optional(),
});

export const organizationCreateSchema = organizationFormSchema.extend({
  idempotencyKey: z.string().trim().min(1).max(191).optional(),
});

export const organizationUpdateSchema = organizationFormSchema.extend({
  id: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
});

export const organizationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().trim().max(120).optional(),
  status: z.enum(ORGANIZATION_STATUS_CODES).optional(),
});

export const organizationMemberSchema = z.object({
  organizationId: z.number().int().positive(),
  userId: z.number().int().positive(),
  operation: z.enum(['add', 'change_role', 'remove']),
  role: z.enum(ORGANIZATION_ROLE_CODES).optional(),
});

export const organizationLifecycleSchema = z.object({
  organizationId: z.number().int().positive(),
  targetStatus: z.enum(ORGANIZATION_STATUS_CODES),
  expectedVersion: z.number().int().positive(),
  confirmation: z.string().trim().max(120).optional(),
});

export const organizationIdSchema = z.object({
  id: z.number().int().positive(),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
export type OrganizationCreateValues = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdateValues = z.infer<typeof organizationUpdateSchema>;
export type OrganizationMemberValues = z.infer<typeof organizationMemberSchema>;
export type OrganizationLifecycleValues = z.infer<typeof organizationLifecycleSchema>;
