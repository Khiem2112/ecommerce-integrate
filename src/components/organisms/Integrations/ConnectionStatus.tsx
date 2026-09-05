'use client';

/**
 * Visual badge and connection health status indicator.
 */

import { Badge } from '@/components/atoms';
import { cn } from '@/lib/cn';

export type ConnectionStatusType = 'connected' | 'expired' | 'error' | 'disconnected' | 'syncing';

export type ConnectionStatusProps = {
  readonly status: ConnectionStatusType;
  readonly latencyMs?: number;
  readonly className?: string;
};

const STATUS_CONFIG: Record<
  ConnectionStatusType,
  {
    readonly label: string;
    readonly variant: 'success' | 'warning' | 'error' | 'secondary' | 'info';
    readonly dotColor: string;
  }
> = {
  connected: {
    label: 'Đã kết nối',
    variant: 'success',
    dotColor: 'bg-status-success animate-pulse',
  },
  syncing: {
    label: 'Đang đồng bộ...',
    variant: 'info',
    dotColor: 'bg-status-info animate-spin',
  },
  expired: {
    label: 'Token hết hạn',
    variant: 'warning',
    dotColor: 'bg-status-warning',
  },
  error: {
    label: 'Lỗi kết nối',
    variant: 'error',
    dotColor: 'bg-semantic-error',
  },
  disconnected: {
    label: 'Chưa kết nối',
    variant: 'secondary',
    dotColor: 'bg-muted',
  },
};

export function ConnectionStatus({ status, latencyMs, className }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Badge variant={config.variant} size="sm" useDot dotClassName={config.dotColor}>
        <span>{config.label}</span>
      </Badge>
      {status === 'connected' && latencyMs !== undefined && latencyMs > 0 && (
        <span className="text-[11px] font-mono text-muted">
          {latencyMs}ms
        </span>
      )}
    </div>
  );
}
