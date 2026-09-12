'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Input } from '@/components/atoms';
import { useSyncOrdersByChangeType } from '@/hooks';
import { cn } from '@/lib/cn';
import type { SyncOrderListItem } from '@/types';

const TYPE_LABELS = { created: 'Mới', updated: 'Cập nhật', unchanged: 'Không đổi', failed: 'Lỗi' } as const;

type SyncOrderSidePanelProps = {
  readonly batchId: number;
  readonly selectedId: string | null;
  readonly onSelect: (order: SyncOrderListItem) => void;
};

export function SyncOrderSidePanel({ batchId, selectedId, onSelect }: SyncOrderSidePanelProps) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const result = useSyncOrdersByChangeType(batchId, undefined, page, true, 50);
  const orders = useMemo(() => (result.data?.data ?? []).filter((order) =>
    order.externalOrderId.toLowerCase().includes(query.trim().toLowerCase()),
  ), [query, result.data?.data]);

  return (
    <aside className="hidden w-70 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card xl:flex xl:flex-col" aria-label="Điều hướng đơn trong đợt">
      <div className="border-b border-hairline p-3">
        <h2 className="text-xs font-semibold text-foreground">Đơn đã xử lý</h2>
        <p className="mb-2 mt-0.5 text-[10px] text-muted">Chọn một đơn để xem diff đầy đủ.</p>
        <label htmlFor="sync-side-search" className="sr-only">Tìm mã đơn</label>
        <Input id="sync-side-search" size="sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã đơn…" />
      </div>
      <div className="max-h-[calc(100dvh-240px)] flex-1 overflow-y-auto custom-scrollbar" aria-busy={result.isLoading}>
        {result.isLoading ? (
          <div className="space-y-2 p-3 motion-safe:animate-pulse">
            {[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-12 rounded-lg bg-surface-strong" />)}
          </div>
        ) : result.error ? (
          <div className="p-4 text-center" role="alert">
            <p className="text-xs text-semantic-error">Không tải được danh sách đơn.</p>
            <Button className="mt-2" variant="outline" size="xs" onClick={() => result.refetch()}>Thử lại</Button>
          </div>
        ) : orders.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted">Không có đơn phù hợp.</p>
        ) : orders.map((order) => (
          <button
            key={order.externalOrderId}
            type="button"
            aria-pressed={selectedId === order.externalOrderId}
            onClick={() => onSelect(order)}
            className={cn(
              'flex min-h-14 w-full items-center justify-between gap-2 border-b border-hairline px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
              selectedId === order.externalOrderId ? 'bg-status-info/10' : 'hover:bg-surface-lifted',
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-[11px] font-semibold text-foreground">{order.externalOrderId}</span>
              <span className="block text-[10px] text-muted">{new Date(order.syncedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </span>
            <Badge variant={order.changeType === 'created' ? 'success' : order.changeType === 'updated' ? 'warning' : order.changeType === 'failed' ? 'error' : 'secondary'} size="xs">
              {TYPE_LABELS[order.changeType]}
            </Badge>
          </button>
        ))}
      </div>
      {(result.data?.meta.totalPages ?? 1) > 1 && (
        <div className="flex items-center justify-between border-t border-hairline p-2">
          <Button variant="ghost" size="xs" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button>
          <span className="text-[10px] text-muted">{page}/{result.data?.meta.totalPages}</span>
          <Button variant="ghost" size="xs" disabled={page >= (result.data?.meta.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Sau</Button>
        </div>
      )}
    </aside>
  );
}
