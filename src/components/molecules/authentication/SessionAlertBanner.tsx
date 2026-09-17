'use client';

import { Button } from '@/components/atoms';
import { cn } from '@/lib/cn';

export type SessionAlertBannerProps = {
  readonly type?: 'warning' | 'error' | 'info';
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly className?: string;
};

export function SessionAlertBanner({
  type = 'warning',
  title,
  description,
  actionLabel,
  onAction,
  className,
}: SessionAlertBannerProps) {
  const styles = {
    warning: {
      container: 'border-status-warning/30 bg-status-warning/10 text-status-warning',
      icon: (
        <svg
          aria-hidden="true"
          className="size-5 shrink-0 text-status-warning"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    error: {
      container: 'border-semantic-error/30 bg-semantic-error/10 text-semantic-error',
      icon: (
        <svg
          aria-hidden="true"
          className="size-5 shrink-0 text-semantic-error"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
    info: {
      container: 'border-status-info/30 bg-status-info/10 text-status-info',
      icon: (
        <svg
          aria-hidden="true"
          className="size-5 shrink-0 text-status-info"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
  }[type];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border p-4 text-xs',
        styles.container,
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {styles.icon}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight text-foreground">{title}</p>
          <p className="mt-1 leading-normal text-muted">{description}</p>
        </div>
      </div>

      {actionLabel && onAction && (
        <Button
          size="xs"
          variant="outline"
          onClick={onAction}
          className="shrink-0"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
