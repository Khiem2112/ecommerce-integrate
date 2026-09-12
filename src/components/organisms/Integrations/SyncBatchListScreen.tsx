'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { syncBatchFilterAtom } from '@/atoms';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/atoms';
import { useRetrySyncBatch, useSyncBatchList } from '@/hooks';
import type { SyncBatchListFilter, SyncBatchListItem } from '@/types';
import { SyncBatchCounterChips } from './SyncBatchCounterChips';
import { SyncBatchDurationLabel } from './SyncBatchDurationLabel';
import { SyncBatchFilterBar } from './SyncBatchFilterBar';
import { SyncBatchStatusBadge } from './SyncBatchStatusBadge';

function parseFiltersFromLocation(): SyncBatchListFilter {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get('page') ?? 1);
  const rawStatus = params.get('status');
  const validStatuses: readonly NonNullable<SyncBatchListFilter['status']>[] = [
    'queued', 'running', 'completed', 'partial', 'failed', 'cancelled',
  ];
  return {
    platform: params.get('platform') ?? undefined,
    status: validStatuses.includes(rawStatus as NonNullable<SyncBatchListFilter['status']>)
      ? rawStatus as NonNullable<SyncBatchListFilter['status']>
      : undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    batchCode: params.get('batchCode') ?? undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: 20,
  };
}

function SyncBatchActions({ batch }: { readonly batch: SyncBatchListItem }) {
  const router = useRouter();
  const retryMutation = useRetrySyncBatch();
  const canRetry = ['partial', 'failed'].includes(batch.status) && batch.failedCount > 0;

  const handleRetry = async () => {
    const result = await retryMutation.mutateAsync(batch.id);
    router.push(`/settings/integrations/lazada/syncs/${encodeURIComponent(result.batchCode)}`);
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(batch.batchCode)}`}>
        <Button variant="outline" size="xs">Chi tiết</Button>
      </Link>
      {canRetry && !batch.retryBlockedReason && (
        <Button size="xs" onClick={handleRetry} isLoading={retryMutation.isPending}>
          Thử lại lỗi
        </Button>
      )}
      {batch.retryBlockedReason && canRetry && (
        <span className="max-w-36 text-right text-[10px] text-status-warning" title={batch.retryBlockedReason}>
          {batch.retryBlockedReason}
        </span>
      )}
      {retryMutation.error && (
        <span role="alert" className="basis-full text-right text-[10px] text-semantic-error">
          {retryMutation.error.message}
        </span>
      )}
    </div>
  );
}

export function SyncBatchListScreen() {
  const [filters, setFilters] = useAtom(syncBatchFilterAtom);
  const hasHydratedFilters = useRef(false);
  const { data, isLoading, isFetching, error, refetch } = useSyncBatchList(filters);

  useEffect(() => {
    setFilters(parseFiltersFromLocation());
    queueMicrotask(() => {
      hasHydratedFilters.current = true;
    });
  }, [setFilters]);

  useEffect(() => {
    if (!hasHydratedFilters.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && key !== 'limit') params.set(key, String(value));
    }
    const next = params.toString();
    window.history.replaceState(null, '', next ? `${window.location.pathname}?${next}` : window.location.pathname);
  }, [filters]);

  const handleFilterChange = useCallback((partial: Partial<SyncBatchListFilter>) => {
    setFilters((current) => ({ ...current, ...partial, page: 1 }));
  }, [setFilters]);

  const handleReset = useCallback(() => setFilters({ page: 1, limit: 20 }), [setFilters]);
  const batches = useMemo(() => data?.data ?? [], [data?.data]);

  if (isLoading && !data) {
    return (
      <div className="space-y-4 motion-safe:animate-pulse" aria-busy="true" aria-label="Đang tải lịch sử đồng bộ">
        <div className="h-28 rounded-2xl bg-surface-strong" />
        {[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-16 rounded-xl bg-surface-strong" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SyncBatchFilterBar filters={filters} onFilterChange={handleFilterChange} onReset={handleReset} />
      {isFetching && <p className="text-[11px] text-muted" role="status" aria-live="polite">Đang cập nhật dữ liệu…</p>}

      {error ? (
        <div className="rounded-2xl border border-semantic-error/30 bg-surface-card p-8 text-center shadow-card" role="alert">
          <h2 className="text-sm font-semibold text-foreground">Không thể tải lịch sử đồng bộ</h2>
          <p className="mt-1 text-xs text-muted">{error.message} Bộ lọc của bạn vẫn được giữ nguyên.</p>
          <Button className="mt-4" size="sm" onClick={() => refetch()}>Thử tải lại</Button>
        </div>
      ) : batches.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface-card p-10 text-center shadow-card">
          <h2 className="text-sm font-semibold text-foreground">Không có đợt đồng bộ phù hợp</h2>
          <p className="mt-1 text-xs text-muted">Hãy điều chỉnh khoảng ngày hoặc xóa bộ lọc hiện tại.</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={handleReset}>Xóa bộ lọc</Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Đợt đồng bộ</TableHead>
                  <TableHead>Gian hàng / chế độ</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(batch.batchCode)}`} className="font-mono text-xs font-semibold text-foreground hover:underline">
                        {batch.batchCode}
                      </Link>
                      {batch.parentBatchCode && (
                        <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(batch.parentBatchCode)}`} className="mt-1 block text-[10px] text-status-info hover:underline">
                          ← Đợt gốc {batch.parentBatchCode}
                        </Link>
                      )}
                      {!batch.parentBatchCode && batch.childBatchCode && (
                        <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(batch.childBatchCode)}`} className="mt-1 block text-[10px] text-status-info hover:underline">
                          Xem đợt thử lại →
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{batch.shopName ?? 'Gian hàng Lazada'}</p>
                      <p className="mt-0.5 text-[10px] uppercase text-muted">{batch.platform} · {batch.syncMode === 'deep_reconcile' ? 'Quét sâu' : batch.syncMode === 'retry' ? 'Thử lại chọn lọc' : 'Tiếp nối'}</p>
                    </TableCell>
                    <TableCell><SyncBatchDurationLabel {...batch} /></TableCell>
                    <TableCell><SyncBatchCounterChips {...batch} /></TableCell>
                    <TableCell><SyncBatchStatusBadge status={batch.status} /></TableCell>
                    <TableCell><SyncBatchActions batch={batch} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {batches.map((batch) => (
              <article key={batch.id} className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(batch.batchCode)}`} className="break-all font-mono text-xs font-semibold text-foreground hover:underline">{batch.batchCode}</Link>
                  <SyncBatchStatusBadge status={batch.status} />
                </div>
                <p className="mt-2 text-xs text-muted">{batch.shopName ?? 'Gian hàng Lazada'} · {batch.syncMode === 'retry' ? 'Thử lại chọn lọc' : batch.syncMode === 'deep_reconcile' ? 'Quét sâu' : 'Tiếp nối'}</p>
                <div className="mt-3"><SyncBatchCounterChips {...batch} /></div>
                <div className="mt-3"><SyncBatchDurationLabel {...batch} /></div>
                <div className="mt-4"><SyncBatchActions batch={batch} /></div>
              </article>
            ))}
          </div>

          <nav className="flex items-center justify-between" aria-label="Phân trang lịch sử đồng bộ">
            <p className="text-xs text-muted">Trang {data?.meta.page} / {data?.meta.totalPages} · {data?.meta.total} đợt</p>
            <div className="flex gap-2">
              <Button variant="outline" size="xs" disabled={(data?.meta.page ?? 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))}>Trang trước</Button>
              <Button variant="outline" size="xs" disabled={(data?.meta.page ?? 1) >= (data?.meta.totalPages ?? 1)} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}>Trang sau</Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
