'use client';

import { useCallback, useState } from 'react';
import { Button, Select } from '@/components/atoms';

export type PaginationProps = {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (size: number) => void;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const [jumpInput, setJumpInput] = useState('');
  const safeTotalPages = Math.max(1, totalPages);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="text-xs text-muted">
        Hiển thị{' '}
        <span className="font-medium text-foreground">{from}</span>
        {' - '}
        <span className="font-medium text-foreground">{to}</span>
        {' trên tổng số '}
        <span className="font-medium text-foreground">{total}</span> đơn hàng
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span id="pagination-page-size-label">Dòng / trang:</span>
            <span className="w-16">
              <Select
                value={String(pageSize)}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                size="sm"
                className="h-7 text-xs"
                aria-labelledby="pagination-page-size-label"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="h-7 px-2 text-xs"
          >
            Trước
          </Button>
          <span className="px-2 text-xs font-medium text-foreground">
            {page} / {safeTotalPages}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= safeTotalPages}
            className="h-7 px-2 text-xs"
          >
            Sau
          </Button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <span>Đến trang:</span>
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
            aria-label="Nhảy đến trang"
          />
        </label>
      </div>
    </div>
  );
}
