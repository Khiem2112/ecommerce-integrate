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
import { createPortal } from 'react-dom';
import { Tooltip } from '@/components/atoms/Tooltip/Tooltip';
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
  readonly placement?: 'bottom' | 'top';
  readonly portaled?: boolean;
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
  placement = 'bottom',
  portaled = true,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const listboxId = useId();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // Close menu if trigger scrolled completely out of viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const menuEl = menuRef.current;
    const estimatedHeight = menuEl ? menuEl.offsetHeight : 240;
    const sideOffset = 4;

    let top = rect.bottom + sideOffset;
    // Check if overflowing bottom or if placement is explicitly 'top'
    const wouldOverflowBottom = top + estimatedHeight > window.innerHeight - 8;
    const fitsTop = rect.top - estimatedHeight - sideOffset >= 8;

    if (placement === 'top' || (wouldOverflowBottom && fitsTop)) {
      top = rect.top - (menuEl ? menuEl.offsetHeight : estimatedHeight) - sideOffset;
    }

    let left = rect.left;
    const width = Math.max(rect.width, 160);
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }

    setCoords({
      top,
      left: Math.max(8, left),
      width,
    });
  }, [placement]);

  useEffect(() => {
    if (!isOpen || !portaled) {
      setCoords(null);
      return;
    }

    updateCoords();

    const rafId = requestAnimationFrame(() => {
      updateCoords();
    });

    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      updateCoords();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, portaled, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
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

  const menuElement = isOpen && (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      data-combobox-portal="true"
      data-portal-menu="true"
      style={
        portaled
          ? {
              position: 'fixed',
              top: coords ? `${coords.top}px` : undefined,
              left: coords ? `${coords.left}px` : undefined,
              width: coords ? `${coords.width}px` : undefined,
              visibility: coords ? 'visible' : 'hidden',
            }
          : placement === 'top'
            ? { bottom: 'calc(100% + 4px)', top: 'auto' }
            : undefined
      }
      className={cn(
        'z-[60] max-h-60 min-w-[10rem] overflow-hidden rounded-xl border border-hairline-strong bg-surface-card shadow-elevated animate-in fade-in-0 zoom-in-95',
        portaled ? 'fixed' : cn('absolute w-full', placement === 'top' ? 'mb-0' : 'mt-1'),
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
            className="w-full rounded-lg border border-hairline-strong bg-surface-lifted px-2.5 py-1 text-xs text-foreground placeholder:text-muted outline-none focus:border-foreground"
          />
        </div>
      )}

      <ul
        className={cn(
          'max-h-48 overflow-y-auto p-1 custom-scrollbar',
          size === 'sm' ? 'text-xs' : 'text-sm',
        )}
      >
        {filteredOptions.length === 0 ? (
          <li className="px-3 py-2 text-center text-muted">
            No options found
          </li>
        ) : (
          filteredOptions.map((option) => {
            const isSelected = option.value === value;
            const tooltipText = option.subLabel
              ? `${option.label} (${option.subLabel})`
              : option.label;

            return (
              <Tooltip
                key={option.value}
                content={tooltipText}
                side="top"
                className="z-[70]"
              >
                <li
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!option.disabled) handleSelect(option.value);
                  }}
                  className={cn(
                    'flex cursor-pointer select-none items-center justify-between rounded-lg px-2.5 py-1.5 transition duration-100',
                    isSelected
                      ? 'bg-foreground/10 font-bold text-foreground'
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
                      <span className="text-[11px] text-muted">
                        {option.subLabel}
                      </span>
                    )}
                  </span>
                </li>
              </Tooltip>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div className={cn('relative min-w-0 w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={buttonId}
          className="mb-1 block text-xs font-medium text-muted"
        >
          {label}
        </label>
      )}

      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel ?? label ?? placeholder}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-full border border-hairline-strong bg-surface-card/65 text-left text-foreground transition duration-150 outline-none hover:bg-surface-card focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10',
          size === 'sm' ? 'h-8 px-2.5 py-1 text-xs' : 'h-9 px-3 py-1.5 text-sm',
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

      {portaled && isMounted
        ? menuElement
          ? createPortal(menuElement, document.body)
          : null
        : menuElement}
    </div>
  );
}
