'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input, type InputProps } from '@/components/atoms';
import { cn } from '@/lib/cn';

export type PasswordInputProps = Omit<InputProps, 'type'> & {
  readonly error?: string;
};

export function PasswordInput({
  className,
  disabled,
  error,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const t = useTranslations('authentication.login');

  return (
    <div className="relative w-full">
      <Input
        type={showPassword ? 'text' : 'password'}
        disabled={disabled}
        className={cn(
          'pr-10',
          error && 'border-semantic-error focus-visible:border-semantic-error focus-visible:ring-semantic-error/20',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {showPassword ? (
          <svg
            aria-hidden="true"
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" x2="22" y1="2" y2="22" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
