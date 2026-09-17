'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/atoms';
import { SyncBatchDetailScreen } from '@/components/organisms';
import { useBreadcrumb, useSyncBatchDetail } from '@/hooks';

export default function LazadaSyncBatchDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly batchCode: string }>;
}) {
  const resolvedParams = use(params);
  const batchCode = decodeURIComponent(resolvedParams.batchCode);
  const t = useTranslations('integrations.lazadaPage');
  const { setBreadcrumb } = useBreadcrumb();
  const detailQuery = useSyncBatchDetail(batchCode);

  useEffect(() => {
    const detail = detailQuery.data;
    setBreadcrumb([
      { label: t('breadcrumbs.settings') },
      { label: t('breadcrumbs.integrations'), href: '/settings/integrations' },
      { label: t('breadcrumbs.lazada'), href: '/settings/integrations/lazada' },
      { label: t('syncsBreadcrumb'), href: '/settings/integrations/lazada/syncs' },
      ...(detail?.parentBatchCode
        ? [{ label: detail.parentBatchCode, href: `/settings/integrations/lazada/syncs/${encodeURIComponent(detail.parentBatchCode)}` }]
        : []),
      { label: detail?.parentBatchCode ? t('retryLabel', { code: batchCode }) : batchCode },
    ]);
  }, [batchCode, detailQuery.data, setBreadcrumb, t]);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-5 motion-safe:animate-pulse" aria-busy="true" aria-label={t('loadingDetailAria')}>
        <div className="h-20 rounded-2xl bg-surface-strong" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 rounded-xl bg-surface-strong" />)}
        </div>
        <div className="h-96 rounded-2xl bg-surface-strong" />
      </div>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="rounded-2xl border border-semantic-error/30 bg-surface-card p-10 text-center shadow-card" role="alert">
        <h1 className="text-base font-semibold text-foreground">{t('cannotOpenBatchTitle')}</h1>
        <p className="mt-1 text-xs text-muted">{detailQuery.error?.message ?? t('notFoundBatchDesc', { code: batchCode })}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" onClick={() => detailQuery.refetch()}>{t('retryLoadBtn')}</Button>
          <Link href="/settings/integrations/lazada/syncs"><Button variant="outline" size="sm">{t('backToHistoryBtn')}</Button></Link>
        </div>
      </div>
    );
  }

  return <SyncBatchDetailScreen detail={detailQuery.data} />;
}
