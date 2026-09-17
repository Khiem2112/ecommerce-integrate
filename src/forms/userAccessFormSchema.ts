import { z } from 'zod';
import { ORGANIZATION_ROLE_CODES, USER_ACCESS_STATUS_CODES } from '@/types';

export const userAccessFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(ORGANIZATION_ROLE_CODES).optional(),
  status: z.enum(USER_ACCESS_STATUS_CODES).optional(),
  sort: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type UserProvisionValidationMessages = {
  readonly emailRequired?: string;
  readonly invalidEmail?: string;
  readonly displayNameRequired?: string;
  readonly invalidContactEmail?: string;
  readonly minPasswordLength?: string;
};

export function getUserProvisionSchema(messages?: UserProvisionValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages?.emailRequired ?? 'Login email is required')
      .email(messages?.invalidEmail ?? 'Invalid email address')
      .max(254),
    displayName: z
      .string()
      .trim()
      .min(1, messages?.displayNameRequired ?? 'Display name is required')
      .max(120),
    contactEmail: z
      .union([
        z.string().trim().email(messages?.invalidContactEmail ?? 'Invalid contact email').max(254),
        z.literal(''),
      ])
      .optional()
      .nullable(),
    role: z.enum(ORGANIZATION_ROLE_CODES),
    customPassword: z
      .union([
        z.string().min(8, messages?.minPasswordLength ?? 'Password must be at least 8 characters').max(128),
        z.literal(''),
      ])
      .optional()
      .nullable(),
    idempotencyKey: z.string().trim().min(1).max(191),
  });
}

export const userProvisionSchema = getUserProvisionSchema();

export const userUpdateSchema = z.object({
  userId: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(120),
  contactEmail: z
    .union([z.string().trim().email().max(254), z.literal('')])
    .optional()
    .nullable(),
  role: z.enum(ORGANIZATION_ROLE_CODES),
  idempotencyKey: z.string().trim().min(1).max(191),
});

export const userResetPasswordSchema = z.object({
  userId: z.number().int().positive(),
  customPassword: z
    .union([z.string().min(8).max(128), z.literal('')])
    .optional()
    .nullable(),
  idempotencyKey: z.string().trim().min(1).max(191),
});

export const userRemoveSchema = z.object({
  userId: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(1).max(191),
});

export type UserAccessFilterValues = z.input<typeof userAccessFilterSchema>;
export type UserAccessFilterParsed = z.output<typeof userAccessFilterSchema>;
export type UserProvisionValues = z.infer<typeof userProvisionSchema>;
export type UserUpdateValues = z.infer<typeof userUpdateSchema>;
export type UserResetPasswordValues = z.infer<typeof userResetPasswordSchema>;
export type UserRemoveValues = z.infer<typeof userRemoveSchema>;
