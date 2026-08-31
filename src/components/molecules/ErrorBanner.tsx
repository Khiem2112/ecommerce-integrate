'use client';

import { Button } from '@/components/atoms';
import { cn } from '@/lib/cn';

type ErrorBannerProps = {
  readonly message: string;
  readonly onRetry?: () => void;
  readonly onDismiss?: () => void;
  readonly variant?: 'inline' | 'card';
  readonly className?: string;
};

export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  variant = 'card',
  className,
}: ErrorBannerProps) {
  const isInline = variant === 'inline';

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-2 text-xs text-semantic-error',
        isInline
          ? 'py-1.5'
          : 'rounded-2xl border border-semantic-error/30 bg-semantic-error/10 p-3',
        className,
      )}
    >
      {/* Error icon */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-4 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>

      <span className="min-w-0 flex-1">{message}</span>

      {onRetry && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onRetry}
          className="shrink-0 text-semantic-error hover:bg-semantic-error/10 hover:text-semantic-error"
        >
          Try again
        </Button>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-semantic-error/60 transition hover:bg-semantic-error/10 hover:text-semantic-error"
          aria-label="Dismiss error"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-3"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}
