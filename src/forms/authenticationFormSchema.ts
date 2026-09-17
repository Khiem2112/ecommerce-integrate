import { z } from 'zod';
import { AUTH_CONFIG } from '@/config/authentication';

export type LoginValidationMessages = {
  readonly emailRequired?: string;
  readonly invalidEmail?: string;
  readonly passwordRequired?: string;
};

export type PasswordValidationMessages = {
  readonly minLength?: string;
  readonly mismatch?: string;
  readonly sameAsCurrent?: string;
  readonly currentRequired?: string;
};

export function getLoginFormSchema(messages?: LoginValidationMessages) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, messages?.emailRequired ?? 'authentication.login.errors.emailRequired')
      .email(messages?.invalidEmail ?? 'authentication.login.errors.invalidEmail'),
    password: z
      .string()
      .min(1, messages?.passwordRequired ?? 'authentication.login.errors.passwordRequired')
      .max(AUTH_CONFIG.PASSWORD_POLICY.MAX_LENGTH),
    returnUrl: z.string().trim().max(500).optional(),
  });
}

export function getMandatoryPasswordChangeSchema(messages?: PasswordValidationMessages) {
  const minLengthMsg =
    messages?.minLength ?? 'authentication.changePassword.errors.minLength';
  const mismatchMsg =
    messages?.mismatch ?? 'authentication.changePassword.errors.mismatch';

  return z
    .object({
      newPassword: z
        .string()
        .min(AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH, minLengthMsg)
        .max(AUTH_CONFIG.PASSWORD_POLICY.MAX_LENGTH),
      confirmation: z
        .string()
        .min(AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH, minLengthMsg)
        .max(AUTH_CONFIG.PASSWORD_POLICY.MAX_LENGTH),
    })
    .refine((data) => data.newPassword === data.confirmation, {
      message: mismatchMsg,
      path: ['confirmation'],
    });
}

export function getVoluntaryPasswordChangeSchema(messages?: PasswordValidationMessages) {
  const minLengthMsg =
    messages?.minLength ?? 'authentication.changePassword.errors.minLength';
  const mismatchMsg =
    messages?.mismatch ?? 'authentication.changePassword.errors.mismatch';
  const sameAsCurrentMsg =
    messages?.sameAsCurrent ?? 'authentication.changePassword.errors.sameAsCurrent';
  const currentRequiredMsg =
    messages?.currentRequired ?? 'authentication.changePassword.errors.currentRequired';

  return z
    .object({
      currentPassword: z.string().min(1, currentRequiredMsg),
      newPassword: z
        .string()
        .min(AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH, minLengthMsg)
        .max(AUTH_CONFIG.PASSWORD_POLICY.MAX_LENGTH),
      confirmation: z
        .string()
        .min(AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH, minLengthMsg)
        .max(AUTH_CONFIG.PASSWORD_POLICY.MAX_LENGTH),
    })
    .refine((data) => data.newPassword === data.confirmation, {
      message: mismatchMsg,
      path: ['confirmation'],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: sameAsCurrentMsg,
      path: ['newPassword'],
    });
}

export const loginFormSchema = getLoginFormSchema();
export const mandatoryPasswordChangeSchema = getMandatoryPasswordChangeSchema();
export const voluntaryPasswordChangeSchema = getVoluntaryPasswordChangeSchema();

export const selectOrganizationSchema = z.object({
  organizationId: z.number().int().positive(),
  returnUrl: z.string().trim().max(500).optional(),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type MandatoryPasswordChangeValues = z.infer<
  typeof mandatoryPasswordChangeSchema
>;
export type VoluntaryPasswordChangeValues = z.infer<
  typeof voluntaryPasswordChangeSchema
>;
export type SelectOrganizationValues = z.infer<typeof selectOrganizationSchema>;

