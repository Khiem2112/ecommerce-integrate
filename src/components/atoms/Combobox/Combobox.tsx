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

export type ComboboxItem = {
  readonly value: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly dotColor?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export type ComboboxProps = {
  readonly items: readonly ComboboxItem[];
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

export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Select an option…',
  label,
  disabled = false,
  className,
  menuClassName,
  size = 'sm',
  searchable = true,
  searchPlaceholder = 'Search…',
  ariaLabel,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const listboxId = useId();

  const selectedItem = useMemo(
    () => items.find((item) => item.value === value),
    [items, value],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(query)),
    );
  }, [items, searchQuery]);

  const handleSelect = useCallback(
    (itemValue: string) => {
      onChange?.(itemValue);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange],
  );

  // Close when clicking outside
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

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Handle escape key
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
          className="mb-1 block text-[11px] font-medium text-slate-400"
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
          'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/90 text-left text-slate-200 shadow-sm transition outline-none focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-500/20 hover:border-slate-600',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          disabled && 'cursor-not-allowed opacity-50',
          isOpen && 'border-violet-500 ring-2 ring-violet-500/20',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {selectedItem?.dotColor && (
            <span
              className={cn('size-2 shrink-0 rounded-full', selectedItem.dotColor)}
              aria-hidden="true"
            />
          )}
          {selectedItem?.icon && (
            <span className="shrink-0 text-slate-400">{selectedItem.icon}</span>
          )}
          <span className={cn('truncate', !selectedItem && 'text-slate-500')}>
            {selectedItem ? selectedItem.label : placeholder}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn(
            'size-4 shrink-0 text-slate-400 transition-transform duration-150',
            isOpen && 'rotate-180 text-violet-400',
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
            'absolute z-50 mt-1 max-h-60 w-full min-w-[10rem] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl shadow-black/40 animate-in fade-in-0 zoom-in-95',
            menuClassName,
          )}
        >
          {searchable && items.length > 5 && (
            <div className="border-b border-slate-800 p-1.5">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-700/80 bg-slate-950 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-violet-500"
              />
            </div>
          )}

          <ul className="max-h-48 overflow-y-auto p-1 text-xs">
            {filteredItems.length === 0 ? (
              <li className="px-3 py-2 text-center text-slate-500">
                No options found
              </li>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.value === value;
                return (
                  <li
                    key={item.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (!item.disabled) handleSelect(item.value);
                    }}
                    className={cn(
                      'flex cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-1.5 transition',
                      isSelected
                        ? 'bg-violet-600/20 font-medium text-violet-200'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      item.disabled &&
                        'cursor-not-allowed opacity-40 hover:bg-transparent',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      {item.dotColor && (
                        <span
                          className={cn('size-2 shrink-0 rounded-full', item.dotColor)}
                          aria-hidden="true"
                        />
                      )}
                      {item.icon && (
                        <span className="shrink-0 text-slate-400">{item.icon}</span>
                      )}
                      <span className="truncate">{item.label}</span>
                      {item.subLabel && (
                        <span className="text-[10px] text-slate-500">
                          {item.subLabel}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-3.5 shrink-0 text-violet-400"
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
