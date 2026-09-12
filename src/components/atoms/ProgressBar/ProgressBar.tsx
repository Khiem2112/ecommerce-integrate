'use client';

import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ProgressBarVariant = 'primary' | 'success' | 'warning' | 'error' | 'teal';
export type ProgressBarSize = 'xs' | 'sm' | 'md' | 'lg';

export type ProgressBarProps = HTMLAttributes<HTMLDivElement> & {
  readonly value: number;
  readonly max?: number;
  readonly status?: 'queued' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled' | string;
  readonly variant?: ProgressBarVariant;
  readonly size?: ProgressBarSize;
  readonly indicatorClassName?: string;
};

const SIZE_STYLES: Record<ProgressBarSize, string> = {
  xs: 'h-1.5',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

const VARIANT_STYLES: Record<ProgressBarVariant, string> = {
  primary: 'bg-primary',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  error: 'bg-semantic-error',
  teal: 'bg-teal-500',
};

function resolveVariant(
  variant?: ProgressBarVariant,
  status?: string,
): ProgressBarVariant {
  if (variant) return variant;
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'partial':
      return 'warning';
    case 'running':
      return 'primary';
    case 'queued':
      return 'teal';
    default:
      return 'primary';
  }
}

export function ProgressBar({
  value,
  max = 100,
  status,
  variant,
  size = 'sm',
  className,
  indicatorClassName,
  ...restProps
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const activeVariant = resolveVariant(variant, status);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'w-full overflow-hidden rounded-full border border-hairline bg-surface-lifted',
        SIZE_STYLES[size],
        className,
      )}
      {...restProps}
    >
      <div
        className={cn(
          'h-full transition-all duration-500 ease-out',
          VARIANT_STYLES[activeVariant],
          indicatorClassName,
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
