'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useDebounce } from '@/hooks';
import { Button, Input, Combobox, type ComboboxItem } from '@/components/atoms';
import type { CustomerFilterParams, CustomerLookupOptions } from '@/types';

export type CustomerFilterBarProps = {
  readonly filters: CustomerFilterParams;
  readonly lookups?: CustomerLookupOptions;
  readonly onFilterChange: (filters: Partial<CustomerFilterParams>) => void;
  readonly onReset: () => void;
};

export function CustomerFilterBar({
  filters,
  lookups,
  onFilterChange,
  onReset,
}: CustomerFilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.keyword ?? '');
  const [prevKeyword, setPrevKeyword] = useState(filters.keyword ?? '');
  const debouncedKeyword = useDebounce(searchInput, 400);
  const [, startTransition] = useTransition();

  if ((filters.keyword ?? '') !== prevKeyword) {
    setPrevKeyword(filters.keyword ?? '');
    setSearchInput(filters.keyword ?? '');
  }

  useEffect(() => {
    if (debouncedKeyword === searchInput && debouncedKeyword !== (filters.keyword ?? '')) {
      startTransition(() => {
        onFilterChange({ keyword: debouncedKeyword || undefined, page: 1 });
      });
    }
  }, [debouncedKeyword, searchInput, filters.keyword, onFilterChange]);

  const platformOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: '', label: 'Tất cả sàn' },
    ...(lookups?.platforms.map((p) => ({
      value: String(p.id),
      label: p.name,
    })) ?? []),
  ], [lookups?.platforms]);

  const vipTierOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: '', label: 'Tất cả hạng VIP' },
    ...(lookups?.vipTiers.map((t) => ({
      value: String(t.id),
      label: `${t.name} (Điểm: ${t.minScore}-${t.maxScore})`,
    })) ?? []),
  ], [lookups?.vipTiers]);

  const sortOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: 'totalSpend_desc', label: 'Chi tiêu cao nhất' },
    { value: 'vipScore_desc', label: 'Điểm VIP cao nhất' },
    { value: 'orderCount_desc', label: 'Số đơn nhiều nhất' },
    { value: 'avgOrderValue_desc', label: 'AOV cao nhất' },
    { value: 'createdAt_desc', label: 'Khách hàng mới nhất' },
    { value: 'daysSinceLastOrder_asc', label: 'Mua gần đây nhất' },
  ], []);

  const currentSortValue = `${filters.sortBy ?? 'totalSpend'}_${filters.sortOrder ?? 'desc'}`;

  const hasActiveFilters = Boolean(
    filters.keyword ||
    filters.platformId ||
    filters.vipTierId ||
    filters.minVipScore !== undefined ||
    filters.maxVipScore !== undefined ||
    (filters.page && filters.page > 1),
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-card p-3 shadow-card">
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-72">
        {/* Search by Platform Buyer ID */}
        <div className="relative w-full max-w-xs">
          <Input
            placeholder="Tìm theo Buyer ID sàn..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 text-xs font-mono"
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
        <div className="w-40">
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

        {/* VIP Tier Dropdown */}
        <div className="w-48">
          <Combobox
            items={vipTierOptions}
            value={filters.vipTierId ? String(filters.vipTierId) : ''}
            onChange={(val) => {
              const parsed = val ? Number(val) : undefined;
              onFilterChange({ vipTierId: parsed, page: 1 });
            }}
            placeholder="Tất cả hạng VIP"
            ariaLabel="Lọc theo hạng VIP"
          />
        </div>

        {/* Sort Selector */}
        <div className="w-48">
          <Combobox
            items={sortOptions}
            value={currentSortValue}
            onChange={(val) => {
              if (!val) return;
              const [sortBy, sortOrder] = val.split('_') as [
                CustomerFilterParams['sortBy'],
                'asc' | 'desc',
              ];
              onFilterChange({ sortBy, sortOrder, page: 1 });
            }}
            placeholder="Sắp xếp theo"
            ariaLabel="Sắp xếp danh sách khách hàng"
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
