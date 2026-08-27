'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
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
    container: 'border-violet-500/30 bg-violet-500/10 text-violet-300 ring-violet-500/20',
    dot: 'bg-violet-400',
  },
  secondary: {
    container: 'border-slate-600/40 bg-slate-800/60 text-slate-300 ring-slate-700/20',
    dot: 'bg-slate-400',
  },
  success: {
    container: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  warning: {
    container: 'border-amber-500/30 bg-amber-500/10 text-amber-300 ring-amber-500/20',
    dot: 'bg-amber-400',
  },
  error: {
    container: 'border-rose-500/30 bg-rose-500/10 text-rose-300 ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  info: {
    container: 'border-sky-500/30 bg-sky-500/10 text-sky-300 ring-sky-500/20',
    dot: 'bg-sky-400',
  },
  purple: {
    container: 'border-purple-500/30 bg-purple-500/10 text-purple-300 ring-purple-500/20',
    dot: 'bg-purple-400',
  },
  pink: {
    container: 'border-pink-500/30 bg-pink-500/10 text-pink-300 ring-pink-500/20',
    dot: 'bg-pink-400',
  },
  teal: {
    container: 'border-teal-500/30 bg-teal-500/10 text-teal-300 ring-teal-500/20',
    dot: 'bg-teal-400',
  },
  cyan: {
    container: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 ring-cyan-500/20',
    dot: 'bg-cyan-400',
  },
  emerald: {
    container: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  amber: {
    container: 'border-amber-500/30 bg-amber-500/10 text-amber-300 ring-amber-500/20',
    dot: 'bg-amber-400',
  },
  rose: {
    container: 'border-rose-500/30 bg-rose-500/10 text-rose-300 ring-rose-500/20',
    dot: 'bg-rose-400',
  },
  slate: {
    container: 'border-slate-700/60 bg-slate-800/50 text-slate-400 ring-slate-700/20',
    dot: 'bg-slate-500',
  },
  zinc: {
    container: 'border-zinc-700/60 bg-zinc-800/50 text-zinc-300 ring-zinc-700/20',
    dot: 'bg-zinc-400',
  },
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] leading-tight font-medium',
  sm: 'px-2 py-0.5 text-xs leading-none font-medium',
  md: 'px-2.5 py-1 text-xs leading-normal font-semibold',
};

export function Badge({
  label,
  children,
  variant = 'primary',
  size = 'xs',
  rounded = false,
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
        rounded ? 'rounded-full' : 'rounded-md',
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
