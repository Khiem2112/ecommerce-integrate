import { Badge, type BadgeVariant } from '@/components/atoms';
import type { SyncBatchStatus } from '@/types';
import { cn } from '@/lib/cn';

const STATUS_CONFIG: Record<SyncBatchStatus, { readonly label: string; readonly variant: BadgeVariant }> = {
  queued: { label: 'Đang xếp hàng', variant: 'secondary' },
  running: { label: 'Đang chạy', variant: 'info' },
  completed: { label: 'Hoàn tất', variant: 'success' },
  partial: { label: 'Một phần lỗi', variant: 'warning' },
  failed: { label: 'Thất bại', variant: 'error' },
  cancelled: { label: 'Đã hủy', variant: 'slate' },
};

type SyncBatchStatusBadgeProps = {
  readonly status: SyncBatchStatus;
  readonly className?: string;
};

export function SyncBatchStatusBadge({ status, className }: SyncBatchStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant={config.variant}
      size="xs"
      useDot
      className={cn(status === 'running' && 'motion-safe:animate-pulse', className)}
    >
      {config.label}
    </Badge>
  );
}
