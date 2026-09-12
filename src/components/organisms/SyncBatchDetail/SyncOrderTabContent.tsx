'use client';

import { useMemo, useState } from 'react';
import { Button, Input } from '@/components/atoms';
import { useSyncOrdersByChangeType } from '@/hooks';
import type { SyncOrderChangeType, SyncOrderListItem } from '@/types';
import { SyncOrderErrorRow } from './SyncOrderErrorRow';
import { SyncOrderListRow } from './SyncOrderListRow';

type SyncOrderTabContentProps = {
  readonly batchId: number;
  readonly activeTab: SyncOrderChangeType;
  readonly onSelect: (order: SyncOrderListItem) => void;
};

export function SyncOrderTabContent({ batchId, activeTab, onSelect }: SyncOrderTabContentProps) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const result = useSyncOrdersByChangeType(batchId, activeTab, page);
  const orders = useMemo(() => (result.data?.data ?? []).filter((order) =>
    order.externalOrderId.toLowerCase().includes(query.trim().toLowerCase()),
  ), [query, result.data?.data]);

  return (
    <section
      id={`sync-panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`sync-tab-${activeTab}`}
      aria-busy={result.isLoading}
      className="overflow-hidden rounded-b-2xl border-x border-b border-hairline bg-surface-card shadow-card"
    >
      <div className="border-b border-hairline p-3">
        <label htmlFor="sync-order-search" className="sr-only">Tìm mã đơn trong tab hiện tại</label>
        <Input id="sync-order-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã đơn trong trang này…" className="max-w-sm" />
      </div>
      {result.isLoading ? (
        <div className="space-y-2 p-3 motion-safe:animate-pulse" aria-label="Đang tải danh sách đơn">
          {[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-12 rounded-lg bg-surface-strong" />)}
        </div>
      ) : result.error ? (
        <div className="p-8 text-center" role="alert">
          <p className="text-sm font-semibold text-foreground">Không thể tải danh sách đơn</p>
          <p className="mt-1 text-xs text-muted">{result.error.message}</p>
          <Button className="mt-3" size="sm" onClick={() => result.refetch()}>Thử tải lại</Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-semibold text-foreground">{query ? `Không có kết quả cho “${query}”` : 'Không có đơn trong nhóm này'}</p>
          <p className="mt-1 text-xs text-muted">{query ? 'Hãy xóa từ khóa hoặc thử một mã đơn khác.' : 'Đợt đồng bộ không ghi nhận kết quả thuộc trạng thái này.'}</p>
          {query && <Button className="mt-3" variant="outline" size="sm" onClick={() => setQuery('')}>Xóa tìm kiếm</Button>}
        </div>
      ) : (
        <div>
          {orders.map((order) => activeTab === 'failed'
            ? <SyncOrderErrorRow key={order.externalOrderId} batchId={batchId} order={order} onSelect={onSelect} />
            : <SyncOrderListRow key={order.externalOrderId} order={order} onSelect={onSelect} />)}
        </div>
      )}
      {(result.data?.meta.totalPages ?? 1) > 1 && (
        <nav className="flex items-center justify-between border-t border-hairline p-3" aria-label="Phân trang đơn hàng">
          <span className="text-[11px] text-muted">Trang {result.data?.meta.page}/{result.data?.meta.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</Button>
            <Button variant="outline" size="xs" disabled={page >= (result.data?.meta.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Sau</Button>
          </div>
        </nav>
      )}
    </section>
  );
}
