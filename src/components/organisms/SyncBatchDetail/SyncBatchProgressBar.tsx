import { ProgressBar } from '@/components/atoms';
import type { SyncBatchDetailProgress } from '@/types';

type SyncBatchProgressBarProps = {
  readonly progress: SyncBatchDetailProgress;
};

export function SyncBatchProgressBar({ progress }: SyncBatchProgressBarProps) {
  const processed = progress.createdCount + progress.updatedCount + progress.unchangedCount + progress.failedCount;
  return (
    <section className="rounded-2xl border border-status-info/25 bg-status-info/10 p-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-foreground">Đang đồng bộ đơn hàng trong nền</span>
        <span className="font-mono font-semibold text-status-info">{progress.progressPercent}% · {processed}/{progress.totalOrders} đơn</span>
      </div>
      <ProgressBar value={progress.progressPercent} status={progress.status} aria-label="Tiến độ đồng bộ đơn hàng" />
    </section>
  );
}
