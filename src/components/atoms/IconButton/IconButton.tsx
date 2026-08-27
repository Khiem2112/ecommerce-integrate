'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type IconButtonVariant = 'ghost' | 'primary' | 'secondary' | 'outline' | 'subtle' | 'ai';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly icon?: ReactNode;
  readonly children?: ReactNode;
  readonly variant?: IconButtonVariant;
  readonly size?: IconButtonSize;
  readonly ariaLabel: string;
  readonly tooltip?: string;
  readonly isActive?: boolean;
  readonly isLoading?: boolean;
};

const VARIANT_STYLES: Record<IconButtonVariant, string> = {
  ghost: 'text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-violet-400',
  subtle: 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/70 hover:text-white border border-slate-700/50 focus-visible:ring-violet-400',
  secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 focus-visible:ring-violet-400 border border-slate-700',
  primary: 'bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-950/40 focus-visible:ring-violet-300',
  outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:ring-violet-400',
  ai: 'border border-violet-400/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/25 hover:text-violet-100 hover:border-violet-400/60 focus-visible:ring-violet-400 shadow-sm',
};

const SIZE_STYLES: Record<IconButtonSize, string> = {
  xs: 'size-6 p-0.5 text-xs rounded',
  sm: 'size-8 p-1.5 text-sm rounded-md',
  md: 'size-9 p-2 text-base rounded-lg',
  lg: 'size-10 p-2.5 text-lg rounded-lg',
};

export function IconButton({
  icon,
  children,
  variant = 'ghost',
  size = 'sm',
  ariaLabel,
  tooltip,
  isActive = false,
  isLoading = false,
  disabled,
  className,
  ...buttonProps
}: IconButtonProps) {
  const content = icon ?? children;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={tooltip ?? ariaLabel}
      disabled={disabled || isLoading}
      className={cn(
        'inline-grid place-items-center transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 select-none',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        isActive && 'bg-violet-600/30 text-violet-200 border-violet-500/50 ring-1 ring-violet-500/30',
        className,
      )}
      {...buttonProps}
    >
      {isLoading ? (
        <svg
          aria-hidden="true"
          className="size-3.5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        content
      )}
    </button>
  );
}
