'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Badge } from '@/components/atoms';
import { useRetrySyncBatch } from '@/hooks';
import type { SyncBatchDetail } from '@/types';
import { SyncBatchStatusBadge } from '@/components/organisms/Integrations/SyncBatchStatusBadge';

type SyncBatchDetailHeaderProps = {
  readonly detail: SyncBatchDetail;
};

export function SyncBatchDetailHeader({ detail }: SyncBatchDetailHeaderProps) {
  const t = useTranslations('integrations.batchDetail');
  const tList = useTranslations('integrations.listScreen');
  const locale = useLocale() === 'vi' ? 'vi-VN' : 'en-US';
  const router = useRouter();
  const retryMutation = useRetrySyncBatch();
  const canRetry = detail.failedCount > 0 && detail.status !== 'running' && detail.status !== 'queued';

  const handleRetryAll = async () => {
    const child = await retryMutation.mutateAsync(detail.id);
    router.push(`/settings/integrations/lazada/syncs/${encodeURIComponent(child.batchCode)}`);
  };

  return (
    <header className="border-b border-hairline pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-channel-lazada-border bg-channel-lazada-soft text-xs font-bold text-channel-lazada">
            LAZ
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-all font-mono text-lg font-bold tracking-tight text-foreground">{detail.batchCode}</h1>
              <SyncBatchStatusBadge status={detail.status} />
              <Badge variant="outline" size="xs">
                {detail.syncMode === 'retry' ? tList('modeRetry') : detail.syncMode === 'deep_reconcile' ? tList('modeDeepReconcile') : tList('modeIncremental')}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {detail.shopName ?? tList('defaultShopName')} · {t('startedAt', { time: new Date(detail.startedAt).toLocaleString(locale) })}
              {detail.triggeredBy ? ` · ${detail.triggeredBy}` : ''}
            </p>
            {detail.parentBatchCode && (
              <Link href={`/settings/integrations/lazada/syncs/${encodeURIComponent(detail.parentBatchCode)}`} className="mt-1 inline-block text-[11px] text-status-info hover:underline">
                {t('viewParentBatch', { batchCode: detail.parentBatchCode })}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRetry && detail.connectionActive && (
            <Button size="sm" onClick={handleRetryAll} isLoading={retryMutation.isPending}>
              {t('retryEligible')}
            </Button>
          )}
          {!detail.connectionActive && (
            <Link href="/settings/integrations">
              <Button variant="outline" size="sm">{t('reauthorize')}</Button>
            </Link>
          )}
          <Link href="/settings/integrations/lazada/syncs">
            <Button variant="outline" size="sm">{t('backToHistory')}</Button>
          </Link>
        </div>
      </div>
      {retryMutation.error && (
        <p role="alert" className="mt-3 rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3 text-xs text-semantic-error">
          {retryMutation.error.message}
        </p>
      )}
    </header>
  );
}
