import { type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type SelectSize = 'sm' | 'md';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  readonly size?: SelectSize;
  readonly rounded?: boolean;
};

const SIZE_STYLES: Record<SelectSize, string> = {
  sm: 'h-8 pl-3 pr-8 py-1 text-[11px]',
  md: 'h-9 pl-3.5 pr-9 py-1.5 text-xs',
};

export function Select({
  className,
  size = 'md',
  rounded = false,
  disabled,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative inline-block w-full">
      <select
        disabled={disabled}
        className={cn(
          'flex w-full appearance-none border border-hairline bg-surface-lifted text-foreground shadow-xs transition duration-150',
          'cursor-pointer outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10',
          'disabled:cursor-not-allowed disabled:opacity-50',
          SIZE_STYLES[size],
          rounded ? 'rounded-full' : 'rounded-lg',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted">
        <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}
