import { type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type InputSize = 'sm' | 'md';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  readonly size?: InputSize;
  readonly rounded?: boolean;
};

const SIZE_STYLES: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 py-1 text-[11px]',
  md: 'h-9 px-3 py-1.5 text-xs',
};

export function Input({
  className,
  type = 'text',
  size = 'md',
  rounded = true,
  disabled,
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      disabled={disabled}
      className={cn(
        'flex w-full border border-hairline bg-surface-lifted text-foreground shadow-xs transition duration-150',
        'placeholder:text-muted outline-none file:border-0 file:bg-transparent file:text-xs file:font-medium',
        'focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        SIZE_STYLES[size],
        rounded ? 'rounded-full' : 'rounded-xl',
        className,
      )}
      {...props}
    />
  );
}
