'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  changeMandatoryPasswordAction,
  changePasswordAction,
} from '@/actions/authenticationActions';
import { Button } from '@/components/atoms';
import {
  ErrorBanner,
  PasswordInput,
  PasswordPolicyChecklist,
  SuccessBanner,
} from '@/components/molecules';
import { AUTH_CONFIG } from '@/config/authentication';
import {
  getMandatoryPasswordChangeSchema,
  getVoluntaryPasswordChangeSchema,
  type MandatoryPasswordChangeValues,
  type VoluntaryPasswordChangeValues,
} from '@/forms';
import { useToast } from '@/hooks';

export type PasswordChangeFormProps = {
  readonly mode?: 'mandatory' | 'voluntary';
  readonly onSuccess?: () => void;
};

function MandatoryPasswordChangeSubForm({
  onSuccess,
}: {
  readonly onSuccess?: () => void;
}) {
  const t = useTranslations('authentication.changePassword');
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      getMandatoryPasswordChangeSchema({
        minLength: t('errors.minLength', {
          min: AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH,
        }),
        mismatch: t('errors.mismatch'),
      }),
    [t],
  );

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MandatoryPasswordChangeValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      newPassword: '',
      confirmation: '',
    },
  });

  const newPassword = watch('newPassword');
  const confirmation = watch('confirmation');

  const onSubmit = async (values: MandatoryPasswordChangeValues): Promise<void> => {
    setErrorMessage(null);
    try {
      const res = await changeMandatoryPasswordAction(values);
      if (!res.success) {
        setErrorMessage(res.error ?? t('failedNotice'));
        return;
      }
      onSuccess?.();
      router.push('/conversations');
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('failedNotice'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('mandatoryTitle')}
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          {t('mandatorySubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="auth-mandatory-new-password"
          className="block text-xs font-medium text-foreground"
        >
          {t('newPasswordLabel')}
        </label>
        <PasswordInput
          id="auth-mandatory-new-password"
          autoComplete="new-password"
          placeholder={t('newPasswordPlaceholder')}
          disabled={isSubmitting}
          rounded={false}
          value={newPassword}
          onChange={(e) => setValue('newPassword', e.target.value)}
        />
        {errors.newPassword && (
          <p className="text-[11px] text-semantic-error">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="auth-mandatory-confirm-password"
          className="block text-xs font-medium text-foreground"
        >
          {t('confirmationLabel')}
        </label>
        <PasswordInput
          id="auth-mandatory-confirm-password"
          autoComplete="new-password"
          placeholder={t('confirmationPlaceholder')}
          disabled={isSubmitting}
          rounded={false}
          value={confirmation}
          onChange={(e) => setValue('confirmation', e.target.value)}
        />
        {errors.confirmation && (
          <p className="text-[11px] text-semantic-error">
            {errors.confirmation.message}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-surface-lifted/40 p-3">
        <PasswordPolicyChecklist
          password={newPassword}
          confirmation={confirmation}
          isVoluntary={false}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        rounded={false}
        className="w-full mt-2"
        isLoading={isSubmitting}
      >
        {isSubmitting ? t('submitting') : t('submitButton')}
      </Button>
    </form>
    </div>
  );
}

function VoluntaryPasswordChangeSubForm({
  onSuccess,
}: {
  readonly onSuccess?: () => void;
}) {
  const t = useTranslations('authentication.changePassword');
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      getVoluntaryPasswordChangeSchema({
        minLength: t('errors.minLength', {
          min: AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH,
        }),
        mismatch: t('errors.mismatch'),
        sameAsCurrent: t('errors.sameAsCurrent'),
        currentRequired: t('errors.currentRequired'),
      }),
    [t],
  );

  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VoluntaryPasswordChangeValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmation: '',
    },
  });

  const currentPassword = watch('currentPassword');
  const newPassword = watch('newPassword');
  const confirmation = watch('confirmation');

  const onSubmit = async (values: VoluntaryPasswordChangeValues): Promise<void> => {
    setErrorMessage(null);
    try {
      const res = await changePasswordAction(values);
      if (!res.success) {
        setErrorMessage(res.error ?? t('invalidCurrentPassword'));
        return;
      }
      toast.success(t('successNotice'));
      reset();
      onSuccess?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('failedNotice'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="auth-voluntary-current-password"
          className="block text-xs font-medium text-foreground"
        >
          {t('currentPasswordLabel')}
        </label>
        <PasswordInput
          id="auth-voluntary-current-password"
          autoComplete="current-password"
          placeholder={t('currentPasswordPlaceholder')}
          disabled={isSubmitting}
          rounded={false}
          value={currentPassword}
          onChange={(e) => setValue('currentPassword', e.target.value)}
        />
        {errors.currentPassword && (
          <p className="text-[11px] text-semantic-error">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="auth-voluntary-new-password"
          className="block text-xs font-medium text-foreground"
        >
          {t('newPasswordLabel')}
        </label>
        <PasswordInput
          id="auth-voluntary-new-password"
          autoComplete="new-password"
          placeholder={t('newPasswordPlaceholder')}
          disabled={isSubmitting}
          rounded={false}
          value={newPassword}
          onChange={(e) => setValue('newPassword', e.target.value)}
        />
        {errors.newPassword && (
          <p className="text-[11px] text-semantic-error">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="auth-voluntary-confirm-password"
          className="block text-xs font-medium text-foreground"
        >
          {t('confirmationLabel')}
        </label>
        <PasswordInput
          id="auth-voluntary-confirm-password"
          autoComplete="new-password"
          placeholder={t('confirmationPlaceholder')}
          disabled={isSubmitting}
          rounded={false}
          value={confirmation}
          onChange={(e) => setValue('confirmation', e.target.value)}
        />
        {errors.confirmation && (
          <p className="text-[11px] text-semantic-error">
            {errors.confirmation.message}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-surface-lifted/40 p-3">
        <PasswordPolicyChecklist
          password={newPassword}
          confirmation={confirmation}
          currentPassword={currentPassword}
          isVoluntary={true}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        rounded={false}
        className="w-full mt-2"
        isLoading={isSubmitting}
      >
        {isSubmitting ? t('submitting') : t('submitButton')}
      </Button>
    </form>
  );
}

export function PasswordChangeForm({
  mode = 'voluntary',
  onSuccess,
}: PasswordChangeFormProps) {
  if (mode === 'mandatory') {
    return <MandatoryPasswordChangeSubForm onSuccess={onSuccess} />;
  }
  return <VoluntaryPasswordChangeSubForm onSuccess={onSuccess} />;
}
