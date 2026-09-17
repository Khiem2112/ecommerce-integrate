'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/atoms';
import { SyncBatchListScreen } from '@/components/organisms';
import { useBreadcrumb } from '@/hooks';

export default function LazadaSyncBatchListPage() {
  const t = useTranslations('integrations.lazadaPage');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumbs.settings') },
      { label: t('breadcrumbs.integrations'), href: '/settings/integrations' },
      { label: t('breadcrumbs.lazada'), href: '/settings/integrations/lazada' },
      { label: t('syncsBreadcrumb') },
    ]);
  }, [setBreadcrumb, t]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <p className="text-caption-uppercase text-status-info">{t('syncsSubtitle')}</p>
          <h1 className="mt-1 text-display-sm text-foreground">{t('syncsTitle')}</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted">{t('syncsDesc')}</p>
        </div>
        <Link href="/settings/integrations/lazada">
          <Button variant="outline" size="sm">{t('backToLazada')}</Button>
        </Link>
      </header>
      <SyncBatchListScreen />
    </div>
  );
}
