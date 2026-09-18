'use client';

import { useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Badge } from '@/components/atoms';
import { ErrorBanner, ShopConnectionStatusBadge } from '@/components/molecules';
import { useShopConnection } from '@/hooks';
import { ShopConnectionActivityTimeline } from './ShopConnectionActivityTimeline';
import { ShopConnectionLabelDialog } from './ShopConnectionLabelDialog';
import { ShopConnectionDisconnectDialog } from './ShopConnectionDisconnectDialog';
import { ShopConnectionReassignDialog } from './ShopConnectionReassignDialog';
import { ShopConnectionAuthorizationDialog } from './ShopConnectionAuthorizationDialog';
import type { SupportedShopPlatformCode } from '@/types';

export type ShopConnectionDetailViewProps = {
  readonly connectionId: number;
};

export function ShopConnectionDetailView({ connectionId }: ShopConnectionDetailViewProps): JSX.Element {
  const t = useTranslations('shops.detail');
  const tCommon = useTranslations('common');

  const { data: connection, isLoading, error } = useShopConnection(connectionId);

  // Dialog states
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isReconnectOpen, setIsReconnectOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-1/3 rounded-xl bg-surface-lifted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 rounded-2xl bg-surface-lifted" />
          <div className="h-28 rounded-2xl bg-surface-lifted" />
          <div className="h-28 rounded-2xl bg-surface-lifted" />
        </div>
      </div>
    );
  }

  if (error || !connection) {
    return <ErrorBanner message={t('loadFailed')} />;
  }

  const { capabilities } = connection;

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {connection.displayLabel ?? connection.shopName ?? connection.platformName}
            </h1>
            <ShopConnectionStatusBadge status={connection.status} size="sm" />
            <Badge variant="outline" size="sm">
              {connection.platformName}
            </Badge>
          </div>

          {connection.shopName && connection.displayLabel && (
            <p className="text-xs text-muted">
              {t('originalName')}: <span className="font-mono">{connection.shopName}</span>
            </p>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {capabilities.canEditLabel && (
            <Button variant="outline" size="sm" onClick={() => setIsLabelOpen(true)}>
              {t('actions.editLabel')}
            </Button>
          )}

          {capabilities.canReconnect && (
            <Button variant="outline" size="sm" onClick={() => setIsReconnectOpen(true)}>
              {t('actions.reconnect')}
            </Button>
          )}

          {capabilities.canReassign && (
            <Button variant="outline" size="sm" onClick={() => setIsReassignOpen(true)}>
              {t('actions.reassign')}
            </Button>
          )}

          {capabilities.canDisconnect && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDisconnectOpen(true)}
            >
              {t('actions.disconnect')}
            </Button>
          )}
        </div>
      </div>

      {/* Reconnect Required Warning Banner */}
      {connection.status === 'reconnect_required' && (
        <div className="rounded-2xl border border-status-warning/40 bg-status-warning/10 p-4 text-xs text-status-warning flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">{t('attention.title')}</p>
            <p className="mt-0.5">{t('attention.description')}</p>
            {connection.lastFailureCode && (
              <p className="mt-1 font-mono text-[11px] opacity-90">
                {t('attention.code')}: {connection.lastFailureCode}
              </p>
            )}
          </div>
          {capabilities.canReconnect && (
            <Button size="sm" onClick={() => setIsReconnectOpen(true)}>
              {t('actions.reconnectNow')}
            </Button>
          )}
        </div>
      )}

      {/* Key Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Organization Card */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('cards.organization')}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">
              {connection.organizationName}
            </p>
            <Link
              href={`/organizations`}
              className="text-xs text-primary hover:underline font-medium"
            >
              {t('cards.viewOrg')}
            </Link>
          </div>
          <p className="mt-0.5 text-xs font-mono text-muted">
            {t('cards.slug', { slug: connection.organizationSlug })}
          </p>
        </div>

        {/* Identity & Verification Card */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('cards.identity')}
          </p>
          <p className="mt-2 text-sm font-mono font-medium text-foreground truncate">
            {connection.externalShopId ?? t('cards.unverified')}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {t('cards.lastVerified')}:{' '}
            {connection.lastVerifiedAt
              ? new Date(connection.lastVerifiedAt).toLocaleString()
              : t('cards.never')}
          </p>
        </div>

        {/* Operations & Sync Card */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('cards.activitySummary')}
          </p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <div>
              <span className="font-bold text-foreground">{connection.orderCount}</span>{' '}
              <span className="text-xs text-muted">{t('cards.orders')}</span>
            </div>
            <div>
              <span className="font-bold text-foreground">{connection.syncBatchCount}</span>{' '}
              <span className="text-xs text-muted">{t('cards.syncBatches')}</span>
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {t('cards.lastSynced')}:{' '}
            {connection.lastSyncedAt
              ? new Date(connection.lastSyncedAt).toLocaleString()
              : t('cards.never')}
          </p>
        </div>
      </div>

      {/* Activity Timeline Section */}
      <div className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-card space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t('timelineTitle')}
        </h2>
        <ShopConnectionActivityTimeline connectionId={connection.id} />
      </div>

      {/* Modals */}
      <ShopConnectionLabelDialog
        isOpen={isLabelOpen}
        onOpenChange={setIsLabelOpen}
        onClose={() => setIsLabelOpen(false)}
        connection={connection}
      />

      <ShopConnectionDisconnectDialog
        isOpen={isDisconnectOpen}
        onOpenChange={setIsDisconnectOpen}
        onClose={() => setIsDisconnectOpen(false)}
        connection={connection}
      />

      <ShopConnectionReassignDialog
        isOpen={isReassignOpen}
        onOpenChange={setIsReassignOpen}
        onClose={() => setIsReassignOpen(false)}
        connection={connection}
      />

      <ShopConnectionAuthorizationDialog
        isOpen={isReconnectOpen}
        onOpenChange={setIsReconnectOpen}
        onClose={() => setIsReconnectOpen(false)}
        defaultPlatform={connection.platformCode as SupportedShopPlatformCode}
        fixedOrganizationId={connection.organizationId}
        fixedOrganizationName={connection.organizationName}
        reconnectConnectionId={connection.id}
      />
    </section>
  );
}
