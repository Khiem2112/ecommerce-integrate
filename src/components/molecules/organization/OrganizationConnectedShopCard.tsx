'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { OrganizationConnection } from '@/types';

export type OrganizationConnectedShopCardProps = {
  readonly connection: OrganizationConnection;
  readonly variant?: 'row' | 'card';
  readonly className?: string;
};

export function OrganizationConnectedShopCard({
  connection,
  variant = 'row',
  className,
}: OrganizationConnectedShopCardProps) {
  const t = useTranslations('organizations');

  return (
    <div
      className={cn(
        variant === 'card'
          ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-card/60 p-4 transition-colors hover:bg-surface-card'
          : 'flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-lifted/50',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-lifted text-sm font-bold text-foreground shadow-xs">
          {connection.platformName[0]?.toUpperCase() ?? 'S'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {connection.shopName ?? connection.platformName}
          </p>
          <p className="font-mono text-xs text-muted">
            {connection.lastSyncedAt
              ? t('shopsTab.lastSync', {
                  time: new Date(connection.lastSyncedAt).toLocaleString(),
                })
              : connection.platformName}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" size="xs">
          {connection.platformName}
        </Badge>
        {connection.lastSyncedAt && (
          <Badge variant="success" size="xs" useDot>
            {t('statuses.active')}
          </Badge>
        )}
      </div>
    </div>
  );
}
