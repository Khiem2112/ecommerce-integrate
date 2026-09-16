'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useToast } from '@/hooks/useToast';
import type { ToastItem, ToastVariant } from '@/atoms/toastAtoms';

export type ToastProps = {
  readonly toast: ToastItem;
  readonly className?: string;
};

const VARIANT_CONTAINER_STYLES: Record<ToastVariant, string> = {
  default: 'border-hairline bg-surface-card text-foreground shadow-elevated',
  warning: 'border-status-warning/40 bg-surface-card text-foreground shadow-elevated ring-1 ring-status-warning/20',
  error: 'border-semantic-error/40 bg-surface-card text-foreground shadow-elevated ring-1 ring-semantic-error/20',
  destructive: 'border-semantic-error/40 bg-surface-card text-foreground shadow-elevated ring-1 ring-semantic-error/20',
  success: 'border-status-success/40 bg-surface-card text-foreground shadow-elevated ring-1 ring-status-success/20',
  info: 'border-status-info/40 bg-surface-card text-foreground shadow-elevated ring-1 ring-status-info/20',
};

const VARIANT_ICON_WRAPPER_STYLES: Record<ToastVariant, string> = {
  default: 'bg-surface-lifted text-muted',
  warning: 'bg-status-warning/12 text-status-warning',
  error: 'bg-semantic-error/12 text-semantic-error',
  destructive: 'bg-semantic-error/12 text-semantic-error',
  success: 'bg-status-success/12 text-status-success',
  info: 'bg-status-info/12 text-status-info',
};

function ToastIcon({ variant }: { readonly variant: ToastVariant }) {
  switch (variant) {
    case 'warning':
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'error':
    case 'destructive':
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'success':
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'info':
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .247.25v3.5a.75.75 0 0 0 1.5 0v-3.5A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg
          aria-hidden="true"
          className="size-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6ZM10 18a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" />
        </svg>
      );
  }
}

export function Toast({ toast, className }: ToastProps) {
  const t = useTranslations('common');
  const { dismiss } = useToast();
  const variant = toast.variant ?? 'default';

  const isAlert = variant === 'warning' || variant === 'error' || variant === 'destructive';

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={variant === 'error' || variant === 'destructive' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 animate-in slide-in-from-bottom-2 fade-in-50',
        VARIANT_CONTAINER_STYLES[variant],
        className,
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-lg',
          VARIANT_ICON_WRAPPER_STYLES[variant],
        )}
      >
        <ToastIcon variant={variant} />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && (
          <h4 className="text-xs font-semibold leading-tight text-foreground">
            {toast.title}
          </h4>
        )}
        {toast.description && (
          <p
            className={cn(
              'text-xs text-muted leading-relaxed',
              toast.title && 'mt-1',
            )}
          >
            {toast.description}
          </p>
        )}

        {toast.action && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={toast.action.onClick}
              className="inline-flex items-center justify-center rounded-lg border border-hairline bg-surface-lifted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface-strong focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      {toast.dismissible && (
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          aria-label={t('close')}
          className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-surface-lifted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <svg
            aria-hidden="true"
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
