import { Badge } from '@/components/atoms';

type SyncBatchCounterChipsProps = {
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly failedCount: number;
};

export function SyncBatchCounterChips({
  createdCount,
  updatedCount,
  unchangedCount,
  failedCount,
}: SyncBatchCounterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Kết quả xử lý đơn hàng">
      <Badge variant="success" size="xs">✓ {createdCount + updatedCount}</Badge>
      {unchangedCount > 0 && <Badge variant="secondary" size="xs">= {unchangedCount}</Badge>}
      {failedCount > 0 && <Badge variant="error" size="xs">✕ {failedCount}</Badge>}
    </div>
  );
}
