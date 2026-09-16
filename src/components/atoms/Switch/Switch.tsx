'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export type SwitchSize = 'sm' | 'md' | 'lg';

export type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> & {
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly size?: SwitchSize;
};

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      disabled = false,
      className,
      size = 'md',
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const isControlled = controlledChecked !== undefined;
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked);
    const isChecked = isControlled ? Boolean(controlledChecked) : uncontrolledChecked;

    const toggle = React.useCallback(() => {
      if (disabled) return;
      const nextChecked = !isChecked;
      if (!isControlled) {
        setUncontrolledChecked(nextChecked);
      }
      onCheckedChange?.(nextChecked);
    }, [disabled, isChecked, isControlled, onCheckedChange]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        toggle();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e);
      if (!e.defaultPrevented && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        toggle();
      }
    };

    const sizeStyles = {
      sm: {
        track: 'h-5 w-9 p-0.5',
        thumb: 'size-4',
        translate: isChecked ? 'translate-x-4' : 'translate-x-0',
      },
      md: {
        track: 'h-6 w-11 p-0.5',
        thumb: 'size-5',
        translate: isChecked ? 'translate-x-5' : 'translate-x-0',
      },
      lg: {
        track: 'h-7 w-14 p-1',
        thumb: 'size-5',
        translate: isChecked ? 'translate-x-7' : 'translate-x-0',
      },
    }[size];

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? 'checked' : 'unchecked'}
        disabled={disabled}
        ref={ref}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          isChecked ? 'bg-status-success' : 'bg-hairline-strong/80 hover:bg-hairline-strong',
          sizeStyles.track,
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
            sizeStyles.thumb,
            sizeStyles.translate,
          )}
        />
      </button>
    );
  },
);

Switch.displayName = 'Switch';
