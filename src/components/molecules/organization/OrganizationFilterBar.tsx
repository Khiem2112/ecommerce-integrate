'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Combobox, type ComboboxItem, Input } from '@/components/atoms';
import { useDebounce } from '@/hooks';
import type { OrganizationFilters, OrganizationStatusCode } from '@/types';

export type OrganizationFilterBarProps = {
  readonly filters: OrganizationFilters;
  readonly onFilterChange: (filters: Partial<OrganizationFilters>) => void;
  readonly onReset?: () => void;
};

export function OrganizationFilterBar({
  filters,
  onFilterChange,
  onReset,
}: OrganizationFilterBarProps) {
  const t = useTranslations('organizations');
  const [searchInput, setSearchInput] = useState(filters.query ?? '');
  const [prevQuery, setPrevQuery] = useState(filters.query ?? '');
  const debouncedQuery = useDebounce(searchInput, 300);
  const [, startTransition] = useTransition();

  // Sync state when external filter changes
  if ((filters.query ?? '') !== prevQuery) {
    setPrevQuery(filters.query ?? '');
    setSearchInput(filters.query ?? '');
  }

  useEffect(() => {
    if (debouncedQuery === searchInput && debouncedQuery !== (filters.query ?? '')) {
      startTransition(() => {
        onFilterChange({ query: debouncedQuery || undefined, page: 1 });
      });
    }
  }, [debouncedQuery, searchInput, filters.query, onFilterChange]);

  const statusOptions: readonly ComboboxItem[] = useMemo(
    () => [
      { value: '', label: t('allStatuses') },
      {
        value: 'active',
        label: t('statuses.active'),
        dotColor: 'bg-status-success',
      },
      {
        value: 'suspended',
        label: t('statuses.suspended'),
        dotColor: 'bg-status-warning',
      },
      {
        value: 'archived',
        label: t('statuses.archived'),
        dotColor: 'bg-muted',
      },
    ],
    [t],
  );

  const handleStatusChange = (value: string) => {
    onFilterChange({
      status: value === '' ? undefined : (value as OrganizationStatusCode),
      page: 1,
    });
  };

  const hasActiveFilters = Boolean(
    (filters.query && filters.query.length > 0) || filters.status,
  );

  const handleReset = () => {
    setSearchInput('');
    if (onReset) {
      onReset();
    } else {
      onFilterChange({ query: undefined, status: undefined, page: 1 });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input with search icon */}
        <div className="relative w-full sm:max-w-xs">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full pl-8"
          />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        {/* Status filter via Combobox */}
        <div className="w-full sm:w-48">
          <Combobox
            items={statusOptions}
            value={filters.status ?? ''}
            onChange={handleStatusChange}
            size="md"
            searchable={false}
            placeholder={t('allStatuses')}
            ariaLabel={t('status')}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="self-end text-xs text-muted hover:text-foreground sm:self-center"
        >
          {t('allStatuses')}
        </Button>
      )}
    </div>
  );
}
