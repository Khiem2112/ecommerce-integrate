'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { loginAction } from '@/actions/authenticationActions';
import { Button, Input } from '@/components/atoms';
import {
  ErrorBanner,
  PasswordInput,
  RateLimitCountdown,
} from '@/components/molecules';
import { loginFormSchema, type LoginFormValues } from '@/forms';

export type LoginFormProps = {
  readonly returnUrl?: string;
};

export function LoginForm({ returnUrl }: LoginFormProps) {
  const t = useTranslations('authentication.login');
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
      returnUrl: returnUrl ?? '',
    },
  });

  const passwordValue = watch('password');

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setErrorMessage(null);
    try {
      const response = await loginAction(values);

      if (!response.success || !response.data) {
        setErrorMessage(response.error ?? t('invalidCredentials'));
        return;
      }

      router.push(response.data.redirectUrl);
      router.refresh();
    } catch {
      setErrorMessage(t('invalidCredentials'));
    }
  };

  const isLocked = retryAfterSeconds !== null && retryAfterSeconds > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          {t('subtitle')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {errorMessage && (
          <ErrorBanner
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

      {isLocked && (
        <RateLimitCountdown
          retryAfterSeconds={retryAfterSeconds}
          onTimeout={() => setRetryAfterSeconds(null)}
        />
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="auth-login-email"
          className="block text-xs font-medium text-foreground"
        >
          {t('emailLabel')}
        </label>
        <Input
          id="auth-login-email"
          type="email"
          autoComplete="username"
          placeholder={t('emailPlaceholder')}
          disabled={isSubmitting || isLocked}
          rounded={false}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-[11px] text-semantic-error">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="auth-login-password"
          className="block text-xs font-medium text-foreground"
        >
          {t('passwordLabel')}
        </label>
        <PasswordInput
          id="auth-login-password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          disabled={isSubmitting || isLocked}
          rounded={false}
          value={passwordValue}
          onChange={(e) => setValue('password', e.target.value)}
        />
        {errors.password && (
          <p className="text-[11px] text-semantic-error">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        rounded={false}
        className="w-full mt-2"
        isLoading={isSubmitting}
        disabled={isSubmitting || isLocked}
      >
        {isSubmitting ? t('submitting') : t('submitButton')}
      </Button>
    </form>
    </div>
  );
}
