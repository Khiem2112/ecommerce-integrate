'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'ai'
  | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly isLoading?: boolean;
  readonly icon?: ReactNode;
  readonly rightIcon?: ReactNode;
  readonly rounded?: boolean;
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-foreground text-background hover:bg-primary-hover shadow-xs focus-visible:ring-foreground/30',
  secondary:
    'bg-foreground/5 text-foreground hover:bg-foreground/10 border border-hairline focus-visible:ring-foreground/20',
  outline:
    'border border-hairline bg-transparent text-foreground hover:bg-surface-lifted shadow-xs focus-visible:ring-foreground/20',
  ghost:
    'text-muted hover:bg-foreground/6 hover:text-foreground focus-visible:ring-foreground/20',
  destructive:
    'border border-semantic-error/30 bg-semantic-error/10 text-semantic-error hover:bg-semantic-error/20 focus-visible:ring-semantic-error/30 shadow-xs',
  ai:
    'border border-status-warning/30 bg-status-warning/10 text-status-warning hover:bg-status-warning/18 focus-visible:ring-status-warning/30 shadow-xs',
  link:
    'text-foreground underline-offset-4 hover:underline focus-visible:ring-foreground/20 p-0 h-auto',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2.5 text-[11px] gap-1',
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-xs font-medium gap-2',
  lg: 'h-10 px-5 text-sm font-medium gap-2.5',
  icon: 'size-8 p-0 grid place-items-center',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  rightIcon,
  rounded = true,
  disabled,
  className,
  type = 'button',
  ...restProps
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition duration-150 select-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
        rounded ? 'rounded-full' : 'rounded-lg',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
      {...restProps}
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
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children && <span className="inline-flex items-center gap-1.5">{children}</span>}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
