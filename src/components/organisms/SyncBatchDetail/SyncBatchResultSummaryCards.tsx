import { Chip } from '@/components/atoms';
import type { SyncBatchDetail, SyncBatchDetailProgress } from '@/types';

type SyncBatchResultSummaryCardsProps = {
  readonly detail: SyncBatchDetail;
  readonly progress?: SyncBatchDetailProgress;
};

export function SyncBatchResultSummaryCards({ detail, progress }: SyncBatchResultSummaryCardsProps) {
  const counters = progress ?? detail;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Tóm tắt kết quả đồng bộ">
      <Chip label="Tạo mới" value={counters.createdCount} prefix="+" variant="success" size="md" />
      <Chip label="Cập nhật" value={counters.updatedCount} prefix="~" variant="info" size="md" />
      <Chip label="Không đổi" value={counters.unchangedCount} prefix="=" variant="muted" size="md" />
      <Chip label="Lỗi" value={counters.failedCount} prefix="!" variant="error" size="md" />
    </section>
  );
}
