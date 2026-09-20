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
// RadioGroupItem (Shadcn-styled individual radio choice)
// ============================================================

export type RadioGroupItemProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  readonly value: string;
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly checked?: boolean;
  readonly onChange?: (val: string) => void;
  readonly containerClassName?: string;
};

export function RadioGroupItem({
  value,
  label,
  description,
  checked: controlledChecked,
  onChange: individualOnChange,
  disabled: individualDisabled,
  containerClassName,
  className,
  id: customId,
  ...inputProps
}: RadioGroupItemProps) {
  const group = useRadioGroupContext();
  const generatedId = useId();
  const inputId = customId ?? `${group?.name ?? 'radio'}-${value}-${generatedId}`;

  const isChecked =
    controlledChecked !== undefined ? controlledChecked : group?.value === value;
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
        'group flex items-start gap-2 cursor-pointer select-none text-left',
        isDisabled && 'cursor-not-allowed opacity-50',
        containerClassName,
      )}
    >
      <div className="relative flex items-center justify-center shrink-0 mt-0.5">
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
        <div
          className={cn(
            'aspect-square size-3.5 rounded-full border border-hairline-strong bg-background shadow-xs transition-all flex items-center justify-center',
            'group-hover:border-foreground/60',
            isChecked && 'border-primary ring-1 ring-primary/40 bg-primary/10',
            'focus-within:ring-2 focus-within:ring-primary/30',
          )}
        >
          {isChecked && (
            <span className="size-1.5 rounded-full bg-primary animate-in zoom-in-75 duration-100" />
          )}
        </div>
      </div>
      {(label || description) && (
        <div className="min-w-0 flex-1 leading-tight">
          {label && (
            <span
              className={cn(
                'text-xs font-medium transition-colors block',
                isChecked ? 'text-foreground' : 'text-muted group-hover:text-foreground',
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
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
  readonly children?: ReactNode;
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
  children,
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
    <div
      role="radio"
      aria-checked={isChecked}
      tabIndex={isDisabled ? -1 : 0}
      onClick={handleChange}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleChange();
        }
      }}
      className={cn(
        'relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer select-none',
        'focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:outline-none',
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
      <div className="flex items-center gap-2.5 w-full">
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
      </div>
      {children && (
        <div
          className="w-full mt-2 pt-2 border-t border-hairline/60"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
