'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Combobox, type ComboboxItem } from '@/components/atoms';
import { cn } from '@/lib/cn';

export type PaginationProps = {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (size: number) => void;
  readonly itemLabel?: string;
  readonly className?: string;
};

const DEFAULT_PAGE_SIZE_ITEMS: readonly ComboboxItem[] = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '50', label: '50' },
];

/** Chevron-left icon */
function ChevronLeft() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Chevron-right icon */
function ChevronRight() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Build the list of page numbers to render, with ellipsis gaps.
 * Example for page=5, totalPages=20, siblings=1:
 *   [1, '…', 4, 5, 6, '…', 20]
 */
function getPageRange(
  current: number,
  total: number,
  siblings: number = 1,
): readonly (number | '…')[] {
  // If total pages fit within the max visible slots, show all
  const totalSlots = siblings * 2 + 5; // first + last + current + 2 siblings + 2 ellipses
  if (total <= totalSlots) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblings, 1);
  const rightSibling = Math.min(current + siblings, total);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    // Near start: show first few pages + ellipsis + last
    const leftCount = siblings * 2 + 3;
    const leftRange = Array.from({ length: leftCount }, (_, i) => i + 1);
    return [...leftRange, '…', total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    // Near end: first + ellipsis + last few pages
    const rightCount = siblings * 2 + 3;
    const rightRange = Array.from(
      { length: rightCount },
      (_, i) => total - rightCount + 1 + i,
    );
    return [1, '…', ...rightRange];
  }

  // Middle: first + ellipsis + siblings + ellipsis + last
  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, '…', ...middleRange, '…', total];
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel,
  className,
}: PaginationProps) {
  const t = useTranslations('pagination');
  const [jumpInput, setJumpInput] = useState('');
  const safeTotalPages = Math.max(1, totalPages);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageSizeItems = useMemo(() => {
    const hasCurrent = DEFAULT_PAGE_SIZE_ITEMS.some(
      (item) => item.value === String(pageSize),
    );
    if (hasCurrent) return DEFAULT_PAGE_SIZE_ITEMS;
    return [
      ...DEFAULT_PAGE_SIZE_ITEMS,
      { value: String(pageSize), label: String(pageSize) },
    ].sort((a, b) => Number(a.value) - Number(b.value));
  }, [pageSize]);

  const handleJump = useCallback(() => {
    if (!jumpInput.trim()) {
      return;
    }

    const target = Number.parseInt(jumpInput, 10);
    if (!Number.isNaN(target)) {
      const clamped = Math.min(Math.max(target, 1), safeTotalPages);
      onPageChange(clamped);
    }

    setJumpInput('');
  }, [jumpInput, onPageChange, safeTotalPages]);

  const pageRange = useMemo(
    () => getPageRange(page, safeTotalPages),
    [page, safeTotalPages],
  );

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-1', className)}>
      {/* Row count summary */}
      <div className="text-xs text-muted">
        {t('summary', {
          from,
          to,
          total,
          itemLabel: itemLabel ?? t('orders'),
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Page size selector — Combobox atom */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>{t('rowsPerPage')}</span>
            <span className="w-[4.5rem]">
              <Combobox
                items={pageSizeItems}
                value={String(pageSize)}
                onChange={(val) => onPageSizeChange(Number(val))}
                size="sm"
                searchable={false}
                ariaLabel={t('rowsPerPageAria')}
                placement="top"
                menuClassName="min-w-[4.5rem]"
              />
            </span>
          </div>
        )}

        {safeTotalPages > 1 && (
          <>
            {/* Prev / Page numbers / Next */}
            <div className="flex items-center gap-0.5">
              {/* Previous button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label={t('previousPage')}
                className="size-7"
              >
                <ChevronLeft />
              </Button>

              {/* Page number buttons */}
              {pageRange.map((item, index) =>
                item === '…' ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex size-7 select-none items-center justify-center text-xs text-muted"
                    aria-hidden="true"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPageChange(item)}
                    disabled={item === page}
                    aria-label={t('page', { page: item })}
                    aria-current={item === page ? 'page' : undefined}
                    className={cn(
                      'flex size-7 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition duration-150 select-none',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
                      item === page
                        ? 'bg-foreground text-background'
                        : 'text-muted hover:bg-foreground/8 hover:text-foreground',
                    )}
                  >
                    {item}
                  </button>
                ),
              )}

              {/* Next button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= safeTotalPages}
                aria-label={t('nextPage')}
                className="size-7"
              >
                <ChevronRight />
              </Button>
            </div>

            {/* Jump to page */}
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <span>{t('goToPage')}</span>
              <input
                type="number"
                min={1}
                max={safeTotalPages}
                value={jumpInput}
                onChange={(event) => setJumpInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleJump();
                  }
                }}
                onBlur={handleJump}
                className="h-7 w-16 rounded-lg border border-hairline bg-surface-card px-2 text-center text-xs text-foreground outline-none transition focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10"
                placeholder={String(page)}
                aria-label={t('jumpToPage')}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
