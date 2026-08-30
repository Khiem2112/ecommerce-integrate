'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'error'
  | 'destructive'
  | 'info'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'zinc';

export type BadgeSize = 'xs' | 'sm' | 'md';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  readonly label?: ReactNode;
  readonly children?: ReactNode;
  readonly variant?: BadgeVariant;
  readonly size?: BadgeSize;
  readonly rounded?: boolean;
  readonly useDot?: boolean;
  readonly dotClassName?: string;
};

const VARIANT_STYLES: Record<BadgeVariant, { container: string; dot: string }> = {
  primary: {
    container: 'border-foreground bg-foreground text-background ring-black/10',
    dot: 'bg-background',
  },
  secondary: {
    container: 'border-hairline bg-foreground/5 text-muted ring-black/5',
    dot: 'bg-muted',
  },
  outline: {
    container: 'border-hairline bg-transparent text-foreground',
    dot: 'bg-foreground',
  },
  success: {
    container: 'border-status-success/25 bg-status-success/10 text-status-success-text ring-status-success/10',
    dot: 'bg-status-success',
  },
  warning: {
    container: 'border-status-warning/25 bg-status-warning/10 text-status-warning ring-status-warning/10',
    dot: 'bg-status-warning',
  },
  error: {
    container: 'border-semantic-error/30 bg-semantic-error/12 text-semantic-error ring-semantic-error/10',
    dot: 'bg-semantic-error',
  },
  destructive: {
    container: 'border-semantic-error/30 bg-semantic-error/12 text-semantic-error ring-semantic-error/10',
    dot: 'bg-semantic-error',
  },
  info: {
    container: 'border-status-info/25 bg-status-info/10 text-status-info ring-status-info/10',
    dot: 'bg-status-info',
  },
  purple: {
    container: 'border-badge-purple/25 bg-badge-purple/10 text-badge-purple-text ring-badge-purple/10',
    dot: 'bg-badge-purple',
  },
  pink: {
    container: 'border-badge-pink/25 bg-badge-pink/10 text-badge-pink-text ring-badge-pink/10',
    dot: 'bg-badge-pink',
  },
  teal: {
    container: 'border-badge-teal/25 bg-badge-teal/10 text-badge-teal-text ring-badge-teal/10',
    dot: 'bg-badge-teal',
  },
  cyan: {
    container: 'border-badge-cyan/25 bg-badge-cyan/10 text-badge-cyan-text ring-badge-cyan/10',
    dot: 'bg-badge-cyan',
  },
  emerald: {
    container: 'border-status-success/25 bg-status-success/10 text-status-success-text ring-status-success/10',
    dot: 'bg-status-success',
  },
  amber: {
    container: 'border-status-warning/25 bg-status-warning/10 text-status-warning ring-status-warning/10',
    dot: 'bg-status-warning',
  },
  rose: {
    container: 'border-semantic-error/30 bg-semantic-error/12 text-semantic-error ring-semantic-error/10',
    dot: 'bg-semantic-error',
  },
  slate: {
    container: 'border-hairline bg-foreground/5 text-muted ring-black/5',
    dot: 'bg-muted',
  },
  zinc: {
    container: 'border-hairline bg-foreground/5 text-muted ring-black/5',
    dot: 'bg-muted',
  },
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  xs: 'px-2 py-0.5 text-[10px] leading-tight font-medium',
  sm: 'px-2.5 py-0.5 text-xs leading-none font-medium',
  md: 'px-3 py-1 text-xs leading-normal font-semibold',
};

export function Badge({
  label,
  children,
  variant = 'primary',
  size = 'xs',
  rounded = true,
  useDot = false,
  dotClassName,
  className,
  ...restProps
}: BadgeProps) {
  const variantConfig = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const content = children ?? label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border tracking-tight',
        variantConfig.container,
        SIZE_STYLES[size],
        rounded ? 'rounded-full' : 'rounded-lg',
        className,
      )}
      {...restProps}
    >
      {useDot && (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', variantConfig.dot, dotClassName)}
          aria-hidden="true"
        />
      )}
      {content}
    </span>
  );
}
