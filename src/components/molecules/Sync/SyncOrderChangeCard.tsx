'use client';

/**
 * Reusable Order Change Card Component for Synchronization Audit (Phase 1.5).
 * Renders an accordion card representing an order's changes (Header diff + Nested child item changes).
 */

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/atoms';
import { SyncFieldDiffTable } from './SyncFieldDiffTable';
import { SyncItemChangeList } from './SyncItemChangeList';
import { cn } from '@/lib/cn';
import type { SyncOrderChangeGroup } from '@/types';

export type SyncOrderChangeCardProps = {
  readonly group: SyncOrderChangeGroup;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly showInternalLink?: boolean;
};

export function SyncOrderChangeCard({
  group,
  isExpanded,
  onToggle,
  showInternalLink = true,
}: SyncOrderChangeCardProps) {
  const { externalOrderId, orderChange, itemChanges } = group;
  const hasHeaderDiffs = orderChange?.changes && Object.keys(orderChange.changes).length > 0;

  return (
    <div className="rounded-xl border border-hairline bg-surface-card shadow-card overflow-hidden transition-all duration-200">
      {/* Order Header Accordion Trigger */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 p-4 transition cursor-pointer select-none',
          isExpanded ? 'bg-surface-lifted/40 border-b border-hairline' : 'hover:bg-surface-lifted/20',
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={isExpanded ? 'Thu gọn đơn hàng' : 'Mở rộng đơn hàng'}
            className="size-6 flex items-center justify-center rounded-md border border-hairline bg-surface-card text-muted hover:text-foreground transition"
          >
            <svg
              aria-hidden="true"
              className={cn('size-3.5 transition-transform duration-200', isExpanded && 'rotate-90')}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-sm text-foreground">
                {externalOrderId}
              </span>

              {orderChange ? (
                <Badge
                  variant={
                    orderChange.changeType === 'created'
                      ? 'success'
                      : orderChange.changeType === 'updated'
                        ? 'info'
                        : 'warning'
                  }
                  size="xs"
                >
                  {orderChange.changeType === 'created'
                    ? 'Tạo mới đơn hàng'
                    : orderChange.changeType === 'updated'
                      ? 'Cập nhật đơn hàng'
                      : 'Vô hiệu hóa'}
                </Badge>
              ) : (
                <Badge variant="secondary" size="xs">
                  Đơn hàng không đổi
                </Badge>
              )}

              {itemChanges.length > 0 && (
                <Badge variant="purple" size="xs">
                  {itemChanges.length} sản phẩm thay đổi
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {showInternalLink && orderChange?.internalId && (
            <Link
              href={`/orders/${orderChange.internalId}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-info hover:underline"
            >
              <span>Mở đơn #{orderChange.internalId}</span>
              <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Expanded Details Body */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Order Header Diffs (Before → After) */}
          {hasHeaderDiffs && orderChange?.changes ? (
            <SyncFieldDiffTable
              diffs={orderChange.changes}
              title="Thay đổi thông tin đơn hàng (Header Diff)"
            />
          ) : orderChange?.changeType === 'created' ? (
            <div className="rounded-lg bg-status-success/10 border border-status-success/20 p-3 text-xs text-status-success font-medium flex items-center gap-2">
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>Đơn hàng mới được nạp đầy đủ từ Lazada và khởi tạo trong cơ sở dữ liệu.</span>
            </div>
          ) : null}

          {/* Nested Child Line Items */}
          {itemChanges.length > 0 && (
            <SyncItemChangeList items={itemChanges} />
          )}
        </div>
      )}
    </div>
  );
}
