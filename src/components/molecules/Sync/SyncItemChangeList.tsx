'use client';

/**
 * Reusable Item Changes List Component for Synchronization Audit (Phase 1.5).
 * Renders nested child items of an order that were created, updated, or inactivated.
 */

import React from 'react';
import { Badge } from '@/components/atoms';
import { SyncFieldDiffTable } from './SyncFieldDiffTable';
import { cn } from '@/lib/cn';
import type { SyncChangeRecord } from '@/types';

export type SyncItemChangeListProps = {
  readonly items: readonly SyncChangeRecord[];
  readonly className?: string;
  readonly showHeader?: boolean;
};

export function SyncItemChangeList({
  items,
  className,
  showHeader = true,
}: SyncItemChangeListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showHeader && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
            Mặt hàng con thay đổi ({items.length})
          </span>
          <span className="text-[11px] text-muted">
            (Đối soát authoritative theo externalItemId)
          </span>
        </div>
      )}

      <div className="border-l-2 border-hairline pl-4 space-y-3">
        {items.map((itemRecord) => {
          const isCreated = itemRecord.changeType === 'created';
          const isUpdated = itemRecord.changeType === 'updated';
          const hasDiffs = itemRecord.changes && Object.keys(itemRecord.changes).length > 0;

          return (
            <div
              key={itemRecord.id}
              className="rounded-lg border border-hairline bg-surface-lifted/50 p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground">
                    [{itemRecord.entityId}]
                  </span>
                  <Badge
                    variant={isCreated ? 'success' : isUpdated ? 'info' : 'warning'}
                    size="xs"
                  >
                    {isCreated
                      ? '+Thêm mặt hàng'
                      : isUpdated
                        ? '~Cập nhật mặt hàng'
                        : '!Vô hiệu hóa'}
                  </Badge>
                </div>

                <span className="text-[11px] text-muted font-mono">
                  {new Date(itemRecord.createdAt).toLocaleTimeString('vi-VN')}
                </span>
              </div>

              {hasDiffs && itemRecord.changes ? (
                <SyncFieldDiffTable diffs={itemRecord.changes} size="sm" />
              ) : isCreated ? (
                <p className="text-xs text-muted">
                  Mặt hàng mới được thêm vào đơn từ dữ liệu Lazada GetOrderItems.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
