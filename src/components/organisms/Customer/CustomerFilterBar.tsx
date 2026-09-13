'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('customers');
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
    { value: '', label: t('filters.allPlatforms') },
    ...(lookups?.platforms.map((p) => ({
      value: String(p.id),
      label: p.name,
    })) ?? []),
  ], [lookups?.platforms, t]);

  const vipTierOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: '', label: t('filters.allVipTiers') },
    ...(lookups?.vipTiers.map((tier) => ({
      value: String(tier.id),
      label: t('filters.vipTierRange', {
        name: tier.name,
        min: tier.minScore,
        max: tier.maxScore,
      }),
    })) ?? []),
  ], [lookups?.vipTiers, t]);

  const sortOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: 'totalSpend_desc', label: t('filters.highestSpend') },
    { value: 'vipScore_desc', label: t('filters.highestVipScore') },
    { value: 'orderCount_desc', label: t('filters.mostOrders') },
    { value: 'avgOrderValue_desc', label: t('filters.highestAov') },
    { value: 'createdAt_desc', label: t('filters.newestCustomers') },
    { value: 'daysSinceLastOrder_asc', label: t('filters.mostRecentPurchase') },
  ], [t]);

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
    <div className="flex flex-col gap-2.5 rounded-lg border border-hairline-strong bg-surface-lifted/55 p-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {/* Search by Platform Buyer ID */}
        <div className="relative w-full sm:max-w-xs">
          <Input
            placeholder={t('filters.searchPlaceholder')}
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
        <div className="w-full sm:w-40">
          <Combobox
            items={platformOptions}
            value={filters.platformId ? String(filters.platformId) : ''}
            onChange={(val) => {
              const parsed = val ? Number(val) : undefined;
              onFilterChange({ platformId: parsed, page: 1 });
            }}
            placeholder={t('filters.allPlatforms')}
            ariaLabel={t('filters.platformAria')}
          />
        </div>

        {/* VIP Tier Dropdown */}
        <div className="w-full sm:w-48">
          <Combobox
            items={vipTierOptions}
            value={filters.vipTierId ? String(filters.vipTierId) : ''}
            onChange={(val) => {
              const parsed = val ? Number(val) : undefined;
              onFilterChange({ vipTierId: parsed, page: 1 });
            }}
            placeholder={t('filters.allVipTiers')}
            ariaLabel={t('filters.vipTierAria')}
          />
        </div>

        {/* Sort Selector */}
        <div className="w-full sm:w-48">
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
            placeholder={t('filters.sortBy')}
            ariaLabel={t('filters.sortAria')}
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
          {t('filters.reset')}
        </Button>
      )}
    </div>
  );
}
