'use client';

/**
 * Order Synchronization Audit History Tab for Order Detail Page (Phase 1.5).
 * Displays authoritative reconciliation timeline and field-level diffs from Lazada.
 * Reuses SyncFieldDiffTable molecule for consistent before/after representation.
 */

import React from 'react';
import { useSyncChangesByEntity } from '@/hooks';
import { Badge } from '@/components/atoms';
import { SyncFieldDiffTable } from '@/components/molecules';
import type { SyncChangeRecord } from '@/types';

export type OrderSyncHistoryTabProps = {
  readonly platformOrderId: string;
};

export function OrderSyncHistoryTab({ platformOrderId }: OrderSyncHistoryTabProps) {
  const { data, isLoading } = useSyncChangesByEntity({
    externalOrderId: platformOrderId,
    pageSize: 50,
  });

  const changes = (data?.changes ?? []) as readonly SyncChangeRecord[];

  if (isLoading) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-6 space-y-4 animate-pulse">
        <div className="h-5 w-48 bg-surface-lifted rounded" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-lifted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-10 text-center shadow-card space-y-2">
        <div className="size-10 rounded-full bg-surface-lifted text-muted flex items-center justify-center mx-auto">
          <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold text-foreground">Chưa có lịch sử đồng bộ sàn</h4>
        <p className="text-xs text-muted max-w-md mx-auto">
          Đơn hàng này chưa ghi nhận thay đổi nào từ các tiến trình đồng bộ Lazada gần đây hoặc được tạo trực tiếp từ nội bộ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Lịch sử đối soát đồng bộ Lazada</h3>
          <p className="text-xs text-muted mt-0.5">
            Các lần dữ liệu authoritative từ sàn Lazada được ghi nhận và nạp vào cơ sở dữ liệu.
          </p>
        </div>
        <Badge variant="teal" size="sm">
          {changes.length} bản ghi audit
        </Badge>
      </div>

      <div className="relative border-l-2 border-hairline pl-5 ml-3 space-y-6">
        {changes.map((change) => {
          const hasDiffs = change.changes && Object.keys(change.changes).length > 0;
          const isCreated = change.changeType === 'created';
          const isUpdated = change.changeType === 'updated';

          return (
            <div key={change.id} className="relative group">
              {/* Timeline Marker Dot */}
              <div
                className="absolute -left-[27px] top-1 size-3.5 rounded-full border-2 border-surface-card bg-primary ring-2 ring-primary/20 transition group-hover:scale-110"
              />

              <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isCreated ? 'success' : isUpdated ? 'info' : 'warning'}
                      size="xs"
                    >
                      {isCreated
                        ? 'Khởi tạo từ Lazada'
                        : isUpdated
                          ? 'Cập nhật từ Lazada'
                          : 'Vô hiệu hóa'}
                    </Badge>

                    <span className="text-[11px] font-mono text-muted">
                      Entity ID: [{change.entityId}]
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-muted">
                    {new Date(change.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                {/* Reusable Diff Table */}
                {hasDiffs && change.changes ? (
                  <SyncFieldDiffTable diffs={change.changes} size="sm" />
                ) : isCreated ? (
                  <p className="text-xs text-status-success font-medium">
                    Bản ghi mới được nạp và khởi tạo thành công từ Lazada.
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Ghi nhận thay đổi đối soát thành công.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
