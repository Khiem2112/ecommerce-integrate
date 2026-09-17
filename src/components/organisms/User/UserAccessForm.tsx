'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Button, Combobox, Input, type ComboboxItem } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import {
  getUserProvisionSchema,
  type UserProvisionValues,
} from '@/forms';
import { useDirtyWarning, useProvisionUserAccess, useUpdateUserAccess } from '@/hooks';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type {
  OrganizationRoleCode,
  UserAccessDetail,
  UserProvisioningResult,
} from '@/types';
import { TemporaryCredentialHandoff } from './TemporaryCredentialHandoff';

export type UserAccessFormProps = {
  readonly mode: 'create' | 'edit';
  readonly initialDetail?: UserAccessDetail;
  readonly activeOrgName?: string;
  readonly allowedRoles?: readonly OrganizationRoleCode[];
  readonly embedded?: boolean;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
};

type FormValues = {
  email: string;
  displayName: string;
  contactEmail?: string | null;
  role: OrganizationRoleCode;
  customPassword?: string | null;
};

const DEFAULT_ALLOWED_ROLES: readonly OrganizationRoleCode[] = [
  'admin',
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
];

export function UserAccessForm({
  mode,
  initialDetail,
  activeOrgName,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  embedded = false,
  onSuccess,
  onCancel,
}: UserAccessFormProps) {
  const t = useTranslations('users');
  const tForm = useTranslations('users.form');
  const tRoles = useTranslations('users.roles');
  const tOutcomes = useTranslations('users.outcomes');
  const effectiveOrgName = activeOrgName ?? t('currentOrg');
  const router = useRouter();

  const [isManualPassword, setIsManualPassword] = useState(false);
  const [provisionResult, setProvisionResult] = useState<UserProvisioningResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = mode === 'edit';

  const defaultRole: OrganizationRoleCode =
    initialDetail?.role ?? (allowedRoles.includes('viewer') ? 'viewer' : allowedRoles[0] ?? 'viewer');

  const schema = useMemo(() => {
    const base = getUserProvisionSchema({
      emailRequired: t('errors.emailRequired'),
      invalidEmail: t('errors.invalidEmail'),
      displayNameRequired: t('errors.displayNameRequired'),
      invalidContactEmail: t('errors.invalidContactEmail'),
      minPasswordLength: t('errors.minPasswordLength'),
    }).omit({ idempotencyKey: true });

    return base.refine(
      (data) => {
        if (!isEdit && isManualPassword) {
          return Boolean(data.customPassword && data.customPassword.trim().length >= 8);
        }
        return true;
      },
      {
        message: t('errors.minPasswordLength'),
        path: ['customPassword'],
      },
    );
  }, [t, isEdit, isManualPassword]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: initialDetail?.loginEmail ?? '',
      displayName: initialDetail?.displayName ?? '',
      contactEmail: initialDetail?.contactEmail ?? '',
      role: defaultRole,
      customPassword: '',
    },
    mode: 'onBlur',
  });

  useDirtyWarning(isDirty && !provisionResult);

  const selectedRole = watch('role');

  const roleItems: readonly ComboboxItem[] = useMemo(
    () =>
      allowedRoles.map((role) => ({
        value: role,
        label: tRoles(role),
      })),
    [allowedRoles, tRoles],
  );

  const provisionMutation = useProvisionUserAccess();
  const updateMutation = useUpdateUserAccess();

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null);
    try {
      if (isEdit && initialDetail) {
        await updateMutation.mutateAsync({
          userId: initialDetail.userId,
          expectedVersion: initialDetail.version,
          displayName: values.displayName.trim(),
          contactEmail: values.contactEmail?.trim() || null,
          role: values.role,
          idempotencyKey: crypto.randomUUID(),
        });
        onSuccess?.();
        if (!embedded) {
          router.push(`/users/${initialDetail.userId}`);
        }
      } else {
        const payload: UserProvisionValues = {
          email: values.email.trim(),
          displayName: values.displayName.trim(),
          contactEmail: values.contactEmail?.trim() || null,
          role: values.role,
          customPassword:
            isManualPassword && values.customPassword?.trim()
              ? values.customPassword.trim()
              : null,
          idempotencyKey: crypto.randomUUID(),
        };

        const result = await provisionMutation.mutateAsync(payload);
        setProvisionResult(result);
        onSuccess?.();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t('errors.saveFailed'),
      );
    }
  };

  // If provision succeeded with temporary password, show credential handoff surface
  if (provisionResult?.outcome === 'created' && provisionResult.temporaryPassword) {
    return (
      <TemporaryCredentialHandoff
        password={provisionResult.temporaryPassword}
        userId={provisionResult.userId}
        onClose={() => {
          if (onCancel) {
            setProvisionResult(null);
            onCancel();
          } else {
            router.push(`/users/${provisionResult.userId}`);
          }
        }}
      />
    );
  }

  // If provision succeeded for existing user (attached or restored or already active)
  if (provisionResult) {
    const outcomeMessage =
      provisionResult.outcome === 'attached'
        ? tOutcomes('attached')
        : provisionResult.outcome === 'restored'
          ? tOutcomes('restored')
          : tOutcomes('alreadyActive');

    return (
      <div className="rounded-2xl border border-semantic-success/30 bg-semantic-success/5 p-6 shadow-card space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-semantic-success/15 text-semantic-success">
            <svg
              aria-hidden="true"
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {tOutcomes('created')}
            </h3>
            <p className="mt-1 text-sm text-muted">{outcomeMessage}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Link href={`/users/${provisionResult.userId}`}>
            <Button type="button" variant="outline" size="md">
              {t('handoff.finishAndGoToDetail')}
            </Button>
          </Link>
          {onCancel ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setProvisionResult(null);
                onCancel();
              }}
            >
              {t('handoff.finishAndGoToDirectory')}
            </Button>
          ) : (
            <Link href="/users">
              <Button type="button" variant="primary" size="md">
                {t('handoff.finishAndGoToDirectory')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn(
        'space-y-6',
        !embedded && 'rounded-2xl border border-hairline bg-surface-card p-6 shadow-card max-w-2xl',
      )}
    >
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? tForm('editTitle') : tForm('newTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isEdit ? tForm('editDescription') : tForm('newDescription')}
          </p>
        </div>
      )}

      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Target Organization (Locked) */}
      <div className="space-y-1.5">
        <label
          htmlFor="target-org-field"
          className="text-xs font-semibold text-muted uppercase tracking-wider block"
        >
          {tForm('targetOrg')}
        </label>
        <div
          id="target-org-field"
          className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-lifted/60 px-3.5 py-2.5 text-sm font-medium text-foreground"
        >
          <svg
            aria-hidden="true"
            className="size-4 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{effectiveOrgName}</span>
        </div>
      </div>

      {/* Login Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="user-login-email"
          className="text-xs font-semibold text-foreground block"
        >
          {tForm('loginEmailLabel')}{' '}
          {!isEdit && <span className="text-semantic-error">*</span>}
        </label>
        <Input
          id="user-login-email"
          type="email"
          placeholder={tForm('loginEmailPlaceholder')}
          {...register('email')}
          disabled={isEdit}
          className={errors.email ? 'border-semantic-error' : ''}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'user-login-email-error' : 'user-login-email-hint'}
        />
        {errors.email ? (
          <p id="user-login-email-error" className="text-xs text-semantic-error" role="alert">
            {errors.email.message}
          </p>
        ) : (
          <p id="user-login-email-hint" className="text-xs text-muted">
            {tForm('loginEmailHint')}
          </p>
        )}
      </div>

      {/* Organization Display Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="user-display-name"
          className="text-xs font-semibold text-foreground block"
        >
          {tForm('displayNameLabel')}{' '}
          <span className="text-semantic-error">*</span>
        </label>
        <Input
          id="user-display-name"
          type="text"
          placeholder={tForm('displayNamePlaceholder')}
          {...register('displayName')}
          className={errors.displayName ? 'border-semantic-error' : ''}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? 'user-display-name-error' : undefined}
        />
        {errors.displayName && (
          <p id="user-display-name-error" className="text-xs text-semantic-error" role="alert">
            {errors.displayName.message}
          </p>
        )}
      </div>

      {/* Contact Email (Optional) */}
      <div className="space-y-1.5">
        <label
          htmlFor="user-contact-email"
          className="text-xs font-semibold text-foreground block"
        >
          {tForm('contactEmailLabel')}
        </label>
        <Input
          id="user-contact-email"
          type="email"
          placeholder={tForm('contactEmailPlaceholder')}
          {...register('contactEmail')}
          className={errors.contactEmail ? 'border-semantic-error' : ''}
          aria-invalid={Boolean(errors.contactEmail)}
          aria-describedby={errors.contactEmail ? 'user-contact-email-error' : 'user-contact-email-hint'}
        />
        {errors.contactEmail ? (
          <p id="user-contact-email-error" className="text-xs text-semantic-error" role="alert">
            {errors.contactEmail.message}
          </p>
        ) : (
          <p id="user-contact-email-hint" className="text-xs text-muted">
            {tForm('contactEmailHint')}
          </p>
        )}
      </div>

      {/* Role selection */}
      <div className="space-y-1.5">
        <label
          htmlFor="user-role-selector"
          className="text-xs font-semibold text-foreground block"
        >
          {tForm('roleLabel')} <span className="text-semantic-error">*</span>
        </label>
        <div id="user-role-selector">
          <Combobox
            items={roleItems}
            value={selectedRole}
            onChange={(val) => setValue('role', val as OrganizationRoleCode, { shouldDirty: true, shouldValidate: true })}
            placeholder={tForm('roleLabel')}
            searchable={false}
            size="md"
            ariaLabel={tForm('roleLabel')}
          />
        </div>
        {errors.role && (
          <p className="text-xs text-semantic-error" role="alert">
            {errors.role.message}
          </p>
        )}
      </div>

      {/* Password configuration (only for create mode) */}
      {!isEdit && (
        <div className="rounded-xl border border-hairline bg-surface-lifted/40 p-4 space-y-3">
          <span className="text-xs font-semibold text-foreground block">
            {tForm('passwordSection')}
          </span>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
              <input
                type="radio"
                name="passwordMode"
                checked={!isManualPassword}
                onChange={() => {
                  setIsManualPassword(false);
                  setValue('customPassword', '', { shouldValidate: true });
                }}
                className="accent-primary"
              />
              <span>{tForm('autoPassword')}</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
              <input
                type="radio"
                name="passwordMode"
                checked={isManualPassword}
                onChange={() => setIsManualPassword(true)}
                className="accent-primary"
              />
              <span>{tForm('manualPassword')}</span>
            </label>
          </div>

          {isManualPassword && (
            <div className="pt-1.5 space-y-1">
              <label
                htmlFor="user-custom-password"
                className="text-xs font-medium text-foreground block"
              >
                {tForm('customPasswordLabel')}{' '}
                <span className="text-semantic-error">*</span>
              </label>
              <Input
                id="user-custom-password"
                type="text"
                placeholder={tForm('customPasswordPlaceholder')}
                {...register('customPassword')}
                className={cn('font-mono text-sm', errors.customPassword && 'border-semantic-error')}
                aria-invalid={Boolean(errors.customPassword)}
                aria-describedby={errors.customPassword ? 'user-custom-password-error' : undefined}
              />
              {errors.customPassword && (
                <p id="user-custom-password-error" className="text-xs text-semantic-error" role="alert">
                  {errors.customPassword.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form Submit & Cancel Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting || provisionMutation.isPending || updateMutation.isPending}
          >
            {tForm('cancel')}
          </Button>
        ) : (
          <Link href="/users">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || provisionMutation.isPending || updateMutation.isPending}
            >
              {tForm('cancel')}
            </Button>
          </Link>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || provisionMutation.isPending || updateMutation.isPending}
        >
          {isSubmitting || provisionMutation.isPending || updateMutation.isPending
            ? tForm('saving')
            : isEdit
              ? tForm('submitUpdate')
              : tForm('submitAdd')}
        </Button>
      </div>
    </form>
  );
}
