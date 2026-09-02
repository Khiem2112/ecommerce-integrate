'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useDebounce } from '@/hooks';
import { Button, Input, Combobox, type ComboboxItem } from '@/components/atoms';
import type { OrderFilterParams, OrderLookupOptions } from '@/types';

export type OrderFilterBarProps = {
  readonly filters: OrderFilterParams;
  readonly lookups?: OrderLookupOptions;
  readonly onFilterChange: (filters: Partial<OrderFilterParams>) => void;
  readonly onReset: () => void;
};

export function OrderFilterBar({
  filters,
  lookups,
  onFilterChange,
  onReset,
}: OrderFilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.keyword ?? '');
  const [prevKeyword, setPrevKeyword] = useState(filters.keyword ?? '');
  const debouncedKeyword = useDebounce(searchInput, 400);
  const [, startTransition] = useTransition();

  if ((filters.keyword ?? '') !== prevKeyword) {
    setPrevKeyword(filters.keyword ?? '');
    setSearchInput(filters.keyword ?? '');
  }

  useEffect(() => {
    if (debouncedKeyword !== (filters.keyword ?? '')) {
      startTransition(() => {
        onFilterChange({ keyword: debouncedKeyword || undefined, page: 1 });
      });
    }
  }, [debouncedKeyword, filters.keyword, onFilterChange]);

  const platformOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: '', label: 'Tất cả sàn' },
    ...(lookups?.platforms.map((p) => ({
      value: String(p.id),
      label: p.name,
    })) ?? []),
  ], [lookups?.platforms]);

  const statusOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: '', label: 'Tất cả trạng thái' },
    ...(lookups?.statuses.map((s) => ({
      value: String(s.id),
      label: s.name,
    })) ?? []),
  ], [lookups?.statuses]);

  const hasActiveFilters = Boolean(
    filters.keyword ||
    filters.platformId ||
    filters.statusId ||
    (filters.page && filters.page > 1),
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-card p-3 shadow-card">
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-72">
        {/* Search by Order ID / Customer */}
        <div className="relative w-full max-w-xs">
          <Input
            placeholder="Tìm theo mã đơn hoặc người mua..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 text-xs"
          />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
          </svg>
        </div>

        {/* Platform Dropdown */}
        <div className="w-44">
          <Combobox
            items={platformOptions}
            value={filters.platformId ? String(filters.platformId) : ''}
            onChange={(val) => {
              const parsed = val ? Number(val) : undefined;
              onFilterChange({ platformId: parsed, page: 1 });
            }}
            placeholder="Tất cả sàn"
            ariaLabel="Lọc theo sàn thương mại"
          />
        </div>

        {/* Status Dropdown */}
        <div className="w-48">
          <Combobox
            items={statusOptions}
            value={filters.statusId ? String(filters.statusId) : ''}
            onChange={(val) => {
              const parsed = val ? Number(val) : undefined;
              onFilterChange({ statusId: parsed, page: 1 });
            }}
            placeholder="Tất cả trạng thái"
            ariaLabel="Lọc theo trạng thái đơn hàng"
          />
        </div>
      </div>

      {/* Reset Filter Button */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchInput('');
            onReset();
          }}
          className="text-xs text-muted hover:text-foreground"
        >
          <svg aria-hidden="true" className="mr-1 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Đặt lại bộ lọc
        </Button>
      )}
    </div>
  );
}
