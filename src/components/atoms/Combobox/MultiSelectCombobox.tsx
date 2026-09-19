'use client';

import {
  type JSX,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Tooltip } from '@/components/atoms/Tooltip/Tooltip';
import { cn } from '@/lib/cn';

export type MultiSelectItem = {
  readonly value: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly dotColor?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

export type MultiSelectComboboxProps = {
  readonly items: readonly MultiSelectItem[];
  readonly values: readonly string[];
  readonly onChange: (values: string[]) => void;
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
  readonly clearable?: boolean;
  readonly clearAriaLabel?: string;
  readonly onClear?: () => void;
  readonly badgePlacement?: 'beside' | 'none';
  readonly renderBadge?: (item: MultiSelectItem, onRemove: () => void) => ReactNode;
  readonly emptyMessage?: string;
  readonly countLabel?: (count: number) => string;
};

export function MultiSelectCombobox({
  items,
  values,
  onChange,
  placeholder = 'Select options…',
  label,
  disabled = false,
  className,
  menuClassName,
  size = 'md',
  searchable = true,
  searchPlaceholder = 'Search…',
  ariaLabel,
  placement = 'bottom',
  portaled = true,
  clearable = false,
  clearAriaLabel,
  onClear,
  badgePlacement = 'none',
  renderBadge,
  emptyMessage = 'No options found',
  countLabel,
}: MultiSelectComboboxProps): JSX.Element {
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

  const selectedItems = useMemo(
    () => items.filter((item) => values.includes(item.value)),
    [items, values],
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        (item.subLabel && item.subLabel.toLowerCase().includes(query)),
    );
  }, [items, searchQuery]);

  const handleToggle = useCallback(
    (itemValue: string) => {
      const isSelected = values.includes(itemValue);
      const nextValues = isSelected
        ? values.filter((v) => v !== itemValue)
        : [...values, itemValue];
      onChange(nextValues);
    },
    [onChange, values],
  );

  const handleClearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
      onClear?.();
    },
    [onChange, onClear],
  );

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const menuEl = menuRef.current;
    const estimatedHeight = menuEl ? menuEl.offsetHeight : 240;
    const sideOffset = 4;

    let top = rect.bottom + sideOffset;
    const wouldOverflowBottom = top + estimatedHeight > window.innerHeight - 8;
    const fitsTop = rect.top - estimatedHeight - sideOffset >= 8;

    if (placement === 'top' || (wouldOverflowBottom && fitsTop)) {
      top = rect.top - (menuEl ? menuEl.offsetHeight : estimatedHeight) - sideOffset;
    }

    let left = rect.left;
    const width = Math.max(rect.width, 180);
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

  const triggerText = useMemo(() => {
    if (selectedItems.length === 0) {
      return placeholder;
    }
    if (countLabel) {
      return countLabel(selectedItems.length);
    }
    if (selectedItems.length === 1) {
      return selectedItems[0].label;
    }
    return `${selectedItems.length} selected`;
  }, [selectedItems, placeholder, countLabel]);

  const menuElement = isOpen && (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      aria-multiselectable="true"
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
        'z-[60] max-h-64 min-w-[12rem] overflow-hidden rounded-xl border border-hairline-strong bg-surface-card shadow-elevated animate-in fade-in-0 zoom-in-95',
        portaled ? 'fixed' : cn('absolute w-full', placement === 'top' ? 'mb-0' : 'mt-1'),
        menuClassName,
      )}
    >
      {searchable && items.length > 4 && (
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
          <li className="px-3 py-2 text-center text-muted text-xs">
            {emptyMessage}
          </li>
        ) : (
          filteredOptions.map((option) => {
            const isSelected = values.includes(option.value);
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
                    if (!option.disabled) handleToggle(option.value);
                  }}
                  className={cn(
                    'group flex cursor-pointer select-none items-center justify-between rounded-lg px-2 py-1.5 transition duration-100',
                    isSelected
                      ? 'bg-foreground/8 text-foreground font-medium'
                      : 'text-foreground hover:bg-surface-lifted',
                    option.disabled &&
                      'cursor-not-allowed opacity-40 hover:bg-transparent',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    {/* Checkbox box indicator */}
                    <span
                      className={cn(
                        'flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-hairline-strong bg-surface-card group-hover:border-foreground/50',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <svg
                          className="size-2.5 stroke-[3]"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>

                    {option.dotColor && (
                      <span
                        className={cn('size-2 shrink-0 rounded-full', option.dotColor)}
                        aria-hidden="true"
                      />
                    )}
                    {option.icon && (
                      <span className="shrink-0 text-muted">{option.icon}</span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>

                  {option.subLabel && (
                    <span className="ml-2 shrink-0 text-[11px] text-muted">
                      {option.subLabel}
                    </span>
                  )}
                </li>
              </Tooltip>
            );
          })
        )}
      </ul>
    </div>
  );

  const comboboxContent = (
    <div className="relative min-w-0 w-full" ref={containerRef}>
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
          <svg
            className="size-3.5 shrink-0 text-muted"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z"
              clipRule="evenodd"
            />
          </svg>
          <span className={cn('truncate', selectedItems.length === 0 && 'text-muted')}>
            {triggerText}
          </span>
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {clearable && selectedItems.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearAll}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClearAll(e as unknown as React.MouseEvent);
                }
              }}
              aria-label={clearAriaLabel}
              className="flex size-4 items-center justify-center rounded-full text-muted hover:bg-foreground/10 hover:text-foreground"
            >
              <svg className="size-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2.5 2.5l7 7m0-7l-7 7" />
              </svg>
            </span>
          )}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn(
              'size-3.5 text-muted transition-transform duration-150',
              isOpen && 'rotate-180 text-foreground',
            )}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {portaled && isMounted
        ? menuElement
          ? createPortal(menuElement, document.body)
          : null
        : menuElement}
    </div>
  );

  if (badgePlacement === 'beside') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
        <div className="min-w-0 w-44">{comboboxContent}</div>
        {selectedItems.map((item) => {
          const onRemove = () => handleToggle(item.value);
          if (renderBadge) {
            return <div key={item.value}>{renderBadge(item, onRemove)}</div>;
          }
          return (
            <Badge
              key={item.value}
              size="xs"
              onRemove={onRemove}
              removePlacement="top-right"
            >
              {item.label}
            </Badge>
          );
        })}
      </div>
    );
  }

  return <div className={className}>{comboboxContent}</div>;
}

export { MultiSelectCombobox as MultiSelect };
