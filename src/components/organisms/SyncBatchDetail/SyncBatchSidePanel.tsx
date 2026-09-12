'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms';
import { useSyncBatchList } from '@/hooks';
import { cn } from '@/lib/cn';
import type { SyncBatchDetail } from '@/types';
import { SyncBatchCounterChips } from '../Integrations/SyncBatchCounterChips';
import { SyncBatchDurationLabel } from '../Integrations/SyncBatchDurationLabel';
import { SyncBatchStatusBadge } from '../Integrations/SyncBatchStatusBadge';

type SyncBatchSidePanelProps = {
  readonly currentBatch: SyncBatchDetail;
};

function getModeLabel(mode: SyncBatchDetail['syncMode']) {
  if (mode === 'retry') return 'Thử lại chọn lọc';
  if (mode === 'deep_reconcile') return 'Quét sâu';
  return 'Tiếp nối';
}

export function SyncBatchSidePanel({ currentBatch }: SyncBatchSidePanelProps) {
  const result = useSyncBatchList({
    platform: currentBatch.platform,
    page: 1,
    limit: 50,
  });
  const batches = result.data?.data ?? [];

  return (
    <aside className="hidden w-80 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card xl:flex xl:flex-col" aria-label="Danh sách đợt đồng bộ">
      <div className="border-b border-hairline p-3">
        <h2 className="text-xs font-semibold text-foreground">Các đợt đồng bộ</h2>
        <p className="mt-0.5 text-[10px] text-muted">Chọn một đợt để xem chi tiết xử lý.</p>
      </div>

      <div className="max-h-[calc(100dvh-220px)] flex-1 overflow-y-auto custom-scrollbar" aria-busy={result.isLoading}>
        {result.isLoading ? (
          <div className="space-y-2 p-3 motion-safe:animate-pulse">
            {[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-20 rounded-lg bg-surface-strong" />)}
          </div>
        ) : result.error ? (
          <div className="p-4 text-center" role="alert">
            <p className="text-xs text-semantic-error">Không tải được danh sách đợt.</p>
            <Button className="mt-2" variant="outline" size="xs" onClick={() => result.refetch()}>Thử lại</Button>
          </div>
        ) : batches.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted">Chưa có đợt đồng bộ nào.</p>
        ) : batches.map((batch) => {
          const isCurrent = batch.id === currentBatch.id;
          return (
            <Link
              key={batch.id}
              href={`/settings/integrations/lazada/syncs/${encodeURIComponent(batch.batchCode)}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'block border-b border-hairline px-3 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                isCurrent ? 'bg-status-info/10' : 'hover:bg-surface-lifted',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px] font-semibold text-foreground">{batch.batchCode}</span>
                  <span className="mt-0.5 block text-[10px] text-muted">{batch.shopName ?? 'Gian hàng Lazada'} · {getModeLabel(batch.syncMode)}</span>
                </span>
                <SyncBatchStatusBadge status={batch.status} />
              </span>
              <span className="mt-2 block"><SyncBatchCounterChips {...batch} /></span>
              <span className="mt-2 block"><SyncBatchDurationLabel {...batch} /></span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-hairline p-2">
        <Link href="/settings/integrations/lazada/syncs" className="block">
          <Button variant="ghost" size="xs" className="w-full">Xem toàn bộ lịch sử</Button>
        </Link>
      </div>
    </aside>
  );
}
