import { useTranslations } from 'next-intl';
import { Badge, type BadgeVariant } from '@/components/atoms';
import type { SyncBatchStatus } from '@/types';
import { cn } from '@/lib/cn';

const STATUS_VARIANTS: Record<SyncBatchStatus, BadgeVariant> = {
  queued: 'secondary',
  running: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'error',
  cancelled: 'slate',
};

type SyncBatchStatusBadgeProps = {
  readonly status: SyncBatchStatus;
  readonly className?: string;
};

export function SyncBatchStatusBadge({ status, className }: SyncBatchStatusBadgeProps) {
  const t = useTranslations('integrations.filterBar');
  const config = STATUS_VARIANTS[status];
  return (
    <Badge
      variant={config}
      size="xs"
      useDot
      className={cn(status === 'running' && 'motion-safe:animate-pulse', className)}
    >
      {t(status)}
    </Badge>
  );
}
