'use client';

import { useEffect, useState } from 'react';
import { Button, Combobox, DateRangePicker, Input, type ComboboxItem } from '@/components/atoms';
import { useDebounce } from '@/hooks';
import type { SyncBatchListFilter } from '@/types';

const PLATFORM_OPTIONS: readonly ComboboxItem[] = [
  { value: '', label: 'Tất cả kênh' },
  { value: 'lazada', label: 'Lazada' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'tiktok_shop', label: 'TikTok Shop' },
];

const STATUS_OPTIONS: readonly ComboboxItem[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'queued', label: 'Đang xếp hàng' },
  { value: 'running', label: 'Đang chạy' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'partial', label: 'Một phần lỗi' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'cancelled', label: 'Đã hủy' },
];

type SyncBatchFilterBarProps = {
  readonly filters: SyncBatchListFilter;
  readonly onFilterChange: (partial: Partial<SyncBatchListFilter>) => void;
  readonly onReset: () => void;
};

export function SyncBatchFilterBar({ filters, onFilterChange, onReset }: SyncBatchFilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.batchCode ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    onFilterChange({ batchCode: debouncedSearch || undefined });
  }, [debouncedSearch, onFilterChange]);

  useEffect(() => setSearchInput(filters.batchCode ?? ''), [filters.batchCode]);

  return (
    <section className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card" aria-label="Bộ lọc lịch sử đồng bộ">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_190px_280px_auto]">
        <div>
          <label htmlFor="sync-batch-search" className="mb-1.5 block text-xs font-semibold text-foreground">
            Tìm mã đợt
          </label>
          <Input
            id="sync-batch-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ví dụ: sync_..."
          />
        </div>
        <Combobox
          label="Kênh sàn"
          items={PLATFORM_OPTIONS}
          value={filters.platform ?? ''}
          onChange={(value) => onFilterChange({ platform: value || undefined })}
          searchable={false}
        />
        <Combobox
          label="Trạng thái"
          items={STATUS_OPTIONS}
          value={filters.status ?? ''}
          onChange={(value) => onFilterChange({ status: value ? value as SyncBatchListFilter['status'] : undefined })}
          searchable={false}
        />
        <DateRangePicker
          label="Khoảng ngày"
          from={filters.dateFrom ?? ''}
          to={filters.dateTo ?? ''}
          onChange={(range) => onFilterChange({ dateFrom: range.from || undefined, dateTo: range.to || undefined })}
        />
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={onReset} className="w-full xl:w-auto">
            Xóa bộ lọc
          </Button>
        </div>
      </div>
    </section>
  );
}
