'use client';

import { useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms';
import { useShopConnectionActivity } from '@/hooks';
import { ShopConnectionStatusBadge } from '@/components/molecules';
import type { ShopConnectionActivityItem } from '@/types';

export type ShopConnectionActivityTimelineProps = {
  readonly connectionId: number;
};

const ACTION_LABEL_KEYS: Record<string, 'authorization_started' | 'authorization_failed' | 'authorization_completed' | 'connection_connected' | 'connection_label_updated' | 'connection_disconnected' | 'connection_reassigned'> = {
  'authorization.started': 'authorization_started',
  'authorization.failed': 'authorization_failed',
  'authorization.completed': 'authorization_completed',
  'connection.connected': 'connection_connected',
  'connection.label_updated': 'connection_label_updated',
  'connection.disconnected': 'connection_disconnected',
  'connection.reassigned': 'connection_reassigned',
};

export function ShopConnectionActivityTimeline({
  connectionId,
}: ShopConnectionActivityTimelineProps): JSX.Element {
  const t = useTranslations('shops.activity');
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [accumulatedItems, setAccumulatedItems] = useState<readonly ShopConnectionActivityItem[]>([]);

  const { data, isLoading, error } = useShopConnectionActivity(connectionId, cursor);

  // Append new items when data updates
  const items = cursor
    ? [...accumulatedItems, ...(data?.items ?? [])]
    : (data?.items ?? []);

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setAccumulatedItems(items);
      setCursor(data.nextCursor);
    }
  };

  if (isLoading && !cursor) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 w-full animate-pulse rounded-xl border border-hairline bg-surface-lifted/40"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4 text-xs text-semantic-error">
        {t('loadError')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-hairline bg-surface-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">{t('emptyTitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative border-l-2 border-hairline ml-3.5 space-y-6 py-2">
        {items.map((item) => {
          const actionKey = ACTION_LABEL_KEYS[item.action];
          const actionLabel = actionKey
            ? t(`actions.${actionKey}`)
            : t('actions.unknown', { action: item.action });

          return (
            <div key={item.id} className="relative pl-6">
              {/* Timeline bullet */}
              <div className="absolute -left-[9px] top-1.5 size-4 rounded-full border-2 border-surface-card bg-primary ring-2 ring-primary/20" />

              <div className="rounded-xl border border-hairline bg-surface-card p-3.5 shadow-xs transition-colors hover:bg-surface-lifted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {actionLabel}
                  </p>
                  <time className="font-mono text-xs text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>

                {item.actorName && (
                  <p className="mt-0.5 text-xs text-muted">
                    {t('by', { actor: item.actorName })}
                  </p>
                )}

                {/* Status Transition Display */}
                {(item.fromStatus ?? item.toStatus) && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {item.fromStatus && (
                      <ShopConnectionStatusBadge status={item.fromStatus} size="xs" />
                    )}
                    {item.fromStatus && item.toStatus && (
                      <span className="text-muted">→</span>
                    )}
                    {item.toStatus && (
                      <ShopConnectionStatusBadge status={item.toStatus} size="xs" />
                    )}
                  </div>
                )}

                {/* Reassignment Display */}
                {(item.organizationIdBefore || item.organizationIdAfter) && (
                  <div className="mt-2 rounded-lg border border-hairline bg-surface-lifted/60 p-2 text-xs text-muted">
                    {t('reassignedDetails', {
                      from: item.organizationNameBefore ?? `#${item.organizationIdBefore}`,
                      to: item.organizationNameAfter ?? `#${item.organizationIdAfter}`,
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data?.hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? t('loadingMore') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
