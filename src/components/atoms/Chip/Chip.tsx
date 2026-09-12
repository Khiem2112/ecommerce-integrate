'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ChipVariant = 'default' | 'success' | 'warning' | 'error' | 'muted' | 'info';
export type ChipSize = 'sm' | 'md';

export type ChipProps = HTMLAttributes<HTMLDivElement> & {
  readonly label?: ReactNode;
  readonly value?: ReactNode;
  readonly prefix?: string;
  readonly variant?: ChipVariant;
  readonly size?: ChipSize;
  readonly children?: ReactNode;
};

const VALUE_VARIANT_STYLES: Record<ChipVariant, string> = {
  default: 'text-foreground',
  success: 'text-status-success',
  warning: 'text-status-warning',
  error: 'text-semantic-error',
  muted: 'text-muted',
  info: 'text-status-info',
};

const SIZE_STYLES: Record<ChipSize, { container: string; label: string; value: string }> = {
  sm: {
    container: 'p-2',
    label: 'text-[10px]',
    value: 'text-xs',
  },
  md: {
    container: 'p-2.5',
    label: 'text-xs',
    value: 'text-sm',
  },
};

export function Chip({
  label,
  value,
  prefix,
  variant = 'default',
  size = 'sm',
  children,
  className,
  ...restProps
}: ChipProps) {
  const sizeConfig = SIZE_STYLES[size];

  return (
    <div
      className={cn(
        'rounded-lg border border-hairline bg-surface-card text-center transition-colors',
        sizeConfig.container,
        className,
      )}
      {...restProps}
    >
      {label !== undefined && (
        <span className={cn('block font-medium text-muted', sizeConfig.label)}>
          {label}
        </span>
      )}
      {value !== undefined ? (
        <span
          className={cn(
            'font-mono font-bold leading-tight',
            sizeConfig.value,
            VALUE_VARIANT_STYLES[variant],
          )}
        >
          {prefix}
          {value}
        </span>
      ) : (
        children
      )}
    </div>
  );
}
