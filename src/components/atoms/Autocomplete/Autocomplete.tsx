'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';

export type AutocompleteOption = {
  readonly value: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly dotColor?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export type AutocompleteProps = {
  readonly options: readonly AutocompleteOption[];
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly menuClassName?: string;
  readonly size?: 'sm' | 'md';
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly ariaLabel?: string;
};

export function Autocomplete({
  options,
  value,
  onChange,
  placeholder = 'Select an option…',
  label,
  disabled = false,
  className,
  menuClassName,
  size,
  searchable = true,
  searchPlaceholder = 'Search…',
  ariaLabel,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((item) => item.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(query)),
    );
  }, [options, searchQuery]);

  const handleSelect = useCallback(
    (itemValue: string) => {
      onChange?.(itemValue);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={buttonId}
          className="mb-1 block text-[11px] font-medium text-muted"
        >
          {label}
        </label>
      )}

      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel ?? label ?? placeholder}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1.5 rounded-full border border-hairline bg-surface-card text-left text-foreground shadow-xs transition duration-150 outline-none hover:border-foreground/30 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10 cursor-pointer',
          size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
          disabled && 'cursor-not-allowed opacity-50',
          isOpen && 'border-foreground ring-2 ring-foreground/10',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {selectedOption?.dotColor && (
            <span
              className={cn('size-1.5 shrink-0 rounded-full', selectedOption.dotColor)}
              aria-hidden="true"
            />
          )}
          {selectedOption?.icon && (
            <span className="shrink-0 text-muted">{selectedOption.icon}</span>
          )}
          <span className={cn('truncate', !selectedOption && 'text-muted')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn(
            'size-3.5 shrink-0 text-muted transition-transform duration-150',
            isOpen && 'rotate-180 text-foreground',
          )}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute z-50 mt-1 max-h-60 w-full min-w-[10rem] overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-xl shadow-black/8 animate-in fade-in-0 zoom-in-95',
            menuClassName,
          )}
        >
          {searchable && options.length > 5 && (
            <div className="border-b border-hairline p-1.5">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-full border border-hairline bg-surface-lifted px-2.5 py-1 text-[11px] text-foreground placeholder:text-muted outline-none focus:border-foreground"
              />
            </div>
          )}

          <ul
            className={cn(
              'max-h-48 overflow-y-auto p-1 custom-scrollbar',
              size === 'sm' ? 'text-[11px]' : 'text-xs',
            )}
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-center text-muted">
                No options found
              </li>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (!option.disabled) handleSelect(option.value);
                    }}
                    className={cn(
                      'flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-1.5 transition duration-100',
                      isSelected
                        ? 'bg-foreground/8 font-medium text-foreground'
                        : 'text-foreground hover:bg-surface-lifted',
                      option.disabled &&
                      'cursor-not-allowed opacity-40 hover:bg-transparent',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      {option.dotColor && (
                        <span
                          className={cn('size-1.5 shrink-0 rounded-full', option.dotColor)}
                          aria-hidden="true"
                        />
                      )}
                      {option.icon && (
                        <span className="shrink-0 text-muted">{option.icon}</span>
                      )}
                      <span className="truncate">{option.label}</span>
                      {option.subLabel && (
                        <span className="text-[10px] text-muted">
                          {option.subLabel}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-3.5 shrink-0 text-foreground"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
