'use client';

import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Badge } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { ShopConnectionHealthStatusCode, ShopConnectionStatsSummary } from '@/types';

type ShopConnectionSummaryStatsProps = {
  readonly stats: ShopConnectionStatsSummary;
  readonly activeStatus?: ShopConnectionHealthStatusCode;
  readonly onStatusToggle: (status: ShopConnectionHealthStatusCode) => void;
};

type StatusStat = {
  readonly status: Extract<
    ShopConnectionHealthStatusCode,
    'connected' | 'expiring_soon' | 'reconnect_required' | 'disconnected'
  >;
  readonly count: number;
  readonly colorClassName: string;
};

export function ShopConnectionSummaryStats({
  stats,
  activeStatus,
  onStatusToggle,
}: ShopConnectionSummaryStatsProps): JSX.Element {
  const t = useTranslations('shops.summary');
  const tStatuses = useTranslations('shops.statuses');
  const statusStats: readonly StatusStat[] = [
    { status: 'connected', count: stats.connected, colorClassName: 'border-status-success/30 text-status-success hover:bg-status-success/10' },
    { status: 'expiring_soon', count: stats.expiringSoon, colorClassName: 'border-status-warning/30 text-status-warning hover:bg-status-warning/10' },
    { status: 'reconnect_required', count: stats.reconnectRequired, colorClassName: 'border-semantic-error/30 text-semantic-error hover:bg-semantic-error/10' },
    { status: 'disconnected', count: stats.disconnected, colorClassName: 'border-hairline text-muted hover:bg-surface-lifted' },
  ];

  return (
    <section aria-label={t('label')} className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-xs">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2" aria-label={t('statusDistribution')}>
          {statusStats.map((stat) => {
            const isActive = activeStatus === stat.status;
            return (
              <Button
                key={stat.status}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={isActive}
                onClick={() => onStatusToggle(stat.status)}
                className={cn(
                  'h-auto gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
                  stat.colorClassName,
                  isActive && 'ring-2 ring-primary bg-primary/10',
                )}
              >
                <span>{tStatuses(stat.status)}</span>
                <span aria-label={t('count', { count: stat.count })}>{stat.count}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label={t('platformDistribution')}>
          <Badge variant="outline" size="sm">{t('platform.lazada', { count: stats.byPlatform.lazada })}</Badge>
          <Badge variant="outline" size="sm">{t('platform.shopify', { count: stats.byPlatform.shopify })}</Badge>
        </div>
      </div>
    </section>
  );
}
