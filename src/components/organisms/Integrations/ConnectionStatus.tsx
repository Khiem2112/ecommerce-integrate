'use client';

/**
 * Visual badge and connection health status indicator.
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms';
import { cn } from '@/lib/cn';

export type ConnectionStatusType = 'connected' | 'expired' | 'error' | 'disconnected' | 'syncing';

export type ConnectionStatusProps = {
  readonly status: ConnectionStatusType;
  readonly latencyMs?: number;
  readonly className?: string;
};

const STATUS_VARIANTS: Record<
  ConnectionStatusType,
  {
    readonly variant: 'success' | 'warning' | 'error' | 'secondary' | 'info';
    readonly dotColor: string;
  }
> = {
  connected: {
    variant: 'success',
    dotColor: 'bg-status-success animate-pulse',
  },
  syncing: {
    variant: 'info',
    dotColor: 'bg-status-info animate-spin',
  },
  expired: {
    variant: 'warning',
    dotColor: 'bg-status-warning',
  },
  error: {
    variant: 'error',
    dotColor: 'bg-semantic-error',
  },
  disconnected: {
    variant: 'secondary',
    dotColor: 'bg-muted',
  },
};

export function ConnectionStatus({ status, latencyMs, className }: ConnectionStatusProps) {
  const t = useTranslations('integrations.status');
  const variantInfo = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.disconnected;

  const labelMap: Record<ConnectionStatusType, string> = {
    connected: t('connected'),
    syncing: t('syncing'),
    expired: t('tokenExpired'),
    error: t('error'),
    disconnected: t('disconnected'),
  };

  const label = labelMap[status] ?? t('disconnected');

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Badge variant={variantInfo.variant} size="sm" useDot dotClassName={variantInfo.dotColor}>
        <span>{label}</span>
      </Badge>
      {status === 'connected' && latencyMs !== undefined && latencyMs > 0 && (
        <span className="text-[11px] font-mono text-muted">
          {latencyMs}ms
        </span>
      )}
    </div>
  );
}
