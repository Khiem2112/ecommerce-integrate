'use client';

'use client';

import { useTranslations } from 'next-intl';
import { Button, Combobox, DateRangePicker, Input, type ComboboxItem } from '@/components/atoms';
import type { SyncBatchListFilter } from '@/types';

type SyncBatchFilterBarProps = {
  readonly filters: SyncBatchListFilter;
  readonly onFilterChange: (partial: Partial<SyncBatchListFilter>) => void;
  readonly onReset: () => void;
};

export function SyncBatchFilterBar({ filters, onFilterChange, onReset }: SyncBatchFilterBarProps) {
  const t = useTranslations('integrations.filterBar');
  const platformOptions: readonly ComboboxItem[] = [
    { value: '', label: t('allChannels') },
    { value: 'lazada', label: 'Lazada' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'tiktok_shop', label: 'TikTok Shop' },
  ];
  const statusOptions: readonly ComboboxItem[] = [
    { value: '', label: t('allStatuses') },
    { value: 'queued', label: t('queued') },
    { value: 'running', label: t('running') },
    { value: 'completed', label: t('completed') },
    { value: 'partial', label: t('partial') },
    { value: 'failed', label: t('failed') },
    { value: 'cancelled', label: t('cancelled') },
  ];
  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card" aria-label={t('filterSectionAria')}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_190px_280px_auto]">
        <div>
          <label htmlFor="sync-batch-search" className="mb-1.5 block text-xs font-semibold text-foreground">
            {t('searchBatchTitle')}
          </label>
          <Input
            id="sync-batch-search"
            value={filters.batchCode ?? ''}
            onChange={(event) => onFilterChange({ batchCode: event.target.value || undefined })}
            placeholder={t('searchBatchPlaceholder')}
          />
        </div>
        <Combobox
          label={t('channelLabel')}
          items={platformOptions}
          value={filters.platform ?? ''}
          onChange={(value) => onFilterChange({ platform: value || undefined })}
          searchable={false}
        />
        <Combobox
          label={t('statusLabel')}
          items={statusOptions}
          value={filters.status ?? ''}
          onChange={(value) => onFilterChange({ status: value ? value as SyncBatchListFilter['status'] : undefined })}
          searchable={false}
        />
        <DateRangePicker
          label={t('dateRangeLabel')}
          from={filters.dateFrom ?? ''}
          to={filters.dateTo ?? ''}
          onChange={(range) => onFilterChange({ dateFrom: range.from || undefined, dateTo: range.to || undefined })}
        />
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={onReset} className="w-full xl:w-auto">
            {t('clearFilter')}
          </Button>
        </div>
      </div>
    </section>
  );
}
