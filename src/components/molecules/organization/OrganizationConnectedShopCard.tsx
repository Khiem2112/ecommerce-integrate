'use client';

import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/atoms';
import { cn } from '@/lib/cn';
import { ShopConnectionStatusBadge } from './ShopConnectionStatusBadge';
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
}: OrganizationConnectedShopCardProps): JSX.Element {
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
          <Link
            href={`/shops/${connection.id}`}
            className="truncate text-sm font-semibold text-foreground hover:text-primary hover:underline block"
          >
            {connection.displayLabel ?? connection.shopName ?? connection.platformName}
          </Link>
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
        {connection.status ? (
          <ShopConnectionStatusBadge status={connection.status} size="xs" />
        ) : connection.lastSyncedAt ? (
          <Badge variant="success" size="xs" useDot>
            {t('statuses.active')}
          </Badge>
        ) : null}
        <Link
          href={`/shops/${connection.id}`}
          className="text-xs text-primary hover:underline font-medium ml-1"
        >
          {t('shopsTab.manage')}
        </Link>
      </div>
    </div>
  );
}
