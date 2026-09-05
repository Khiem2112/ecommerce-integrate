'use client';

import { cn } from '@/lib/cn';

type SuccessBannerProps = {
  readonly message: string;
  readonly onDismiss?: () => void;
  readonly variant?: 'inline' | 'card';
  readonly className?: string;
};

export function SuccessBanner({
  message,
  onDismiss,
  variant = 'card',
  className,
}: SuccessBannerProps) {
  const isInline = variant === 'inline';

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 text-xs text-status-success-text',
        isInline
          ? 'py-1.5'
          : 'rounded-xl border border-status-success/30 bg-status-success/10 p-3.5',
        className,
      )}
    >
      {/* Success checkmark icon */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-4 shrink-0 text-status-success"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>

      <span className="min-w-0 flex-1">{message}</span>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-status-success-text/60 transition hover:bg-status-success/15 hover:text-status-success-text"
          aria-label="Dismiss message"
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
