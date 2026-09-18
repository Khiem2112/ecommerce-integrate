'use client';

import {
  createContext,
  useContext,
  useId,
  type FieldsetHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

// ============================================================
// Context
// ============================================================

type RadioGroupContextValue = {
  readonly name: string;
  readonly value?: string;
  readonly onChange?: (val: string) => void;
  readonly disabled?: boolean;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext(): RadioGroupContextValue | null {
  return useContext(RadioGroupContext);
}

// ============================================================
// RadioGroup (Root Fieldset)
// ============================================================

export type RadioGroupProps = Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> & {
  readonly name?: string;
  readonly value?: string;
  readonly onChange?: (val: string) => void;
  readonly label?: ReactNode;
  readonly hideLegend?: boolean;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
};

export function RadioGroup({
  name: propName,
  value,
  onChange,
  label,
  hideLegend = false,
  error,
  disabled = false,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const generatedId = useId();
  const name = propName ?? generatedId;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      <fieldset
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn('border-none p-0 m-0 space-y-1.5', className)}
        {...props}
      >
        {label && (
          <legend
            className={cn(
              'text-xs font-semibold text-foreground',
              hideLegend && 'sr-only',
            )}
          >
            {label}
          </legend>
        )}
        {children}
        {error && (
          <p id={errorId} className="text-xs text-semantic-error">
            {error}
          </p>
        )}
      </fieldset>
    </RadioGroupContext.Provider>
  );
}

// ============================================================
// SelectionCard (Radio choice item styled as interactive card)
// ============================================================

export type SelectionCardProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value'
> & {
  readonly value: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly checked?: boolean;
  readonly onChange?: (val: string) => void;
  readonly containerClassName?: string;
};

export function SelectionCard({
  value,
  title,
  description,
  icon,
  checked: controlledChecked,
  onChange: individualOnChange,
  disabled: individualDisabled,
  containerClassName,
  className,
  id: customId,
  ...inputProps
}: SelectionCardProps) {
  const group = useRadioGroupContext();
  const generatedId = useId();
  const inputId = customId ?? `${group?.name ?? 'choice'}-${value}-${generatedId}`;

  const isChecked = controlledChecked !== undefined ? controlledChecked : group?.value === value;
  const isDisabled = Boolean(individualDisabled || group?.disabled);

  const handleChange = () => {
    if (isDisabled) return;
    individualOnChange?.(value);
    group?.onChange?.(value);
  };

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'relative flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer select-none',
        'focus-within:ring-2 focus-within:ring-foreground/20 focus-within:outline-none',
        isChecked
          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
          : 'border-hairline bg-surface-card text-muted hover:border-hairline-strong hover:text-foreground',
        isDisabled && 'cursor-not-allowed opacity-50 hover:border-hairline',
        containerClassName,
      )}
    >
      <input
        id={inputId}
        type="radio"
        name={group?.name}
        value={value}
        checked={isChecked}
        disabled={isDisabled}
        onChange={handleChange}
        className={cn('sr-only', className)}
        {...inputProps}
      />
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-lifted font-bold text-xs text-foreground',
            isChecked && 'bg-primary text-background',
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        {description && (
          <p className="text-xs text-muted truncate">{description}</p>
        )}
      </div>
    </label>
  );
}
