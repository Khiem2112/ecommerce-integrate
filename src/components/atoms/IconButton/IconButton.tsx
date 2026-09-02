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
  ghost: 'text-muted hover:bg-foreground/6 hover:text-foreground focus-visible:ring-foreground/20',
  subtle: 'bg-surface-card text-foreground hover:bg-background border border-hairline shadow-xs focus-visible:ring-foreground/20',
  secondary: 'bg-foreground/5 text-foreground hover:bg-foreground/10 border border-hairline focus-visible:ring-foreground/20',
  primary: 'bg-foreground text-background hover:bg-primary-hover shadow-xs focus-visible:ring-foreground/30',
  outline: 'border border-hairline bg-transparent text-foreground hover:bg-surface-card shadow-xs focus-visible:ring-foreground/20',
  ai: 'border border-status-warning/30 bg-status-warning/10 text-status-warning hover:bg-status-warning/18 focus-visible:ring-status-warning/30 shadow-xs',
};

const SIZE_STYLES: Record<IconButtonSize, string> = {
  xs: 'size-6 p-0.5 text-xs rounded-full',
  sm: 'size-8 p-1.5 text-sm rounded-full',
  md: 'size-9 p-2 text-base rounded-full',
  lg: 'size-10 p-2.5 text-lg rounded-full',
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
        'inline-grid place-items-center transition duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 select-none cursor-pointer',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        isActive && 'bg-foreground text-background shadow-xs ring-1 ring-foreground/30',
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
