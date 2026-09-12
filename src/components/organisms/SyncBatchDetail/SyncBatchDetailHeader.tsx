'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Badge } from '@/components/atoms';
import { useRetrySyncBatch } from '@/hooks';
import type { SyncBatchDetail } from '@/types';
import { SyncBatchStatusBadge } from '@/components/organisms/Integrations/SyncBatchStatusBadge';

type SyncBatchDetailHeaderProps = {
  readonly detail: SyncBatchDetail;
};

export function SyncBatchDetailHeader({ detail }: SyncBatchDetailHeaderProps) {
  const router = useRouter();
  const retryMutation = useRetrySyncBatch();
  const canRetry = detail.failedCount > 0 && detail.status !== 'running' && detail.status !== 'queued';

  const handleRetryAll = async () => {
    const child = await retryMutation.mutateAsync(detail.id);
    router.push(`/settings/integrations/lazada/syncs/${encodeURIComponent(child.batchCode)}`);
  };

  return (
    <header className="border-b border-hairline pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-channel-lazada-border bg-channel-lazada-soft text-xs font-bold text-channel-lazada">
            LAZ
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-all font-mono text-lg font-bold tracking-tight text-foreground">{detail.batchCode}</h1>
              <SyncBatchStatusBadge status={detail.status} />
              <Badge variant="outline" size="xs">
                {detail.syncMode === 'retry' ? 'Thử lại chọn lọc' : detail.syncMode === 'deep_reconcile' ? 'Quét sâu' : 'Tiếp nối'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {detail.shopName ?? 'Gian hàng Lazada'} · Bắt đầu {new Date(detail.startedAt).toLocaleString('vi-VN')}
              {detail.triggeredBy ? ` · ${detail.triggeredBy}` : ''}
            </p>
            {detail.parentBatchCode && (
              <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(detail.parentBatchCode)}`} className="mt-1 inline-block text-[11px] text-status-info hover:underline">
                ← Xem đợt gốc {detail.parentBatchCode}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRetry && detail.connectionActive && (
            <Button size="sm" onClick={handleRetryAll} isLoading={retryMutation.isPending}>
              Thử lại lỗi đủ điều kiện
            </Button>
          )}
          {!detail.connectionActive && (
            <Link href="/settings/integrations">
              <Button variant="outline" size="sm">Cấp lại quyền kết nối</Button>
            </Link>
          )}
          <Link href="/settings/integrations/lazada/syncs">
            <Button variant="outline" size="sm">Quay lại lịch sử</Button>
          </Link>
        </div>
      </div>
      {retryMutation.error && (
        <p role="alert" className="mt-3 rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3 text-xs text-semantic-error">
          {retryMutation.error.message}
        </p>
      )}
    </header>
  );
}
