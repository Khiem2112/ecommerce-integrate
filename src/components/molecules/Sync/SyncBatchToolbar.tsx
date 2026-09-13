'use client';

/**
 * Toolbar for Sync Batch Detail View (Phase 1.5).
 * Contains a search input, a Combobox filter for change types, and expand/collapse actions.
 */

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Combobox, type ComboboxItem, Button } from '@/components/atoms';

export type SyncBatchToolbarProps = {
  readonly searchInput: string;
  readonly onSearchInputChange: (val: string) => void;
  readonly filterType: string;
  readonly onFilterChange: (val: string) => void;
  readonly onExpandAll: () => void;
  readonly onCollapseAll: () => void;
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
};

export function SyncBatchToolbar({
  searchInput,
  onSearchInputChange,
  filterType,
  onFilterChange,
  onExpandAll,
  onCollapseAll,
  onRefresh,
  isRefreshing = false,
}: SyncBatchToolbarProps) {
  const t = useTranslations('integrations.toolbar');

  const changeTypeOptions: readonly ComboboxItem[] = useMemo(() => [
    { value: 'all', label: t('allChanges') },
    { value: 'created', label: t('createdOnly'), dotColor: '#149e61' },
    { value: 'updated', label: t('updatedOnly'), dotColor: '#3860BE' },
    { value: 'itemsOnly', label: t('itemsOnly'), dotColor: '#6366f1' },
  ], [t]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-hairline p-3.5 rounded-xl shadow-card">
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <svg
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            className="w-full h-8.5 rounded-full border border-hairline bg-surface-lifted pl-9 pr-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
        </div>

        {/* Change Type Filter via Combobox */}
        <div className="w-48">
          <Combobox
            items={changeTypeOptions}
            value={filterType}
            onChange={onFilterChange}
            placeholder={t('changeType')}
            size="sm"
            searchable={false}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="xs" onClick={onExpandAll} className="text-xs">
          {t('expandAll')}
        </Button>
        <span className="text-hairline">|</span>
        <Button variant="ghost" size="xs" onClick={onCollapseAll} className="text-xs">
          {t('collapseAll')}
        </Button>

        {onRefresh && (
          <Button
            variant="outline"
            size="xs"
            isLoading={isRefreshing}
            onClick={onRefresh}
            icon={
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
          >
            {t('refresh')}
          </Button>
        )}
      </div>
    </div>
  );
}
