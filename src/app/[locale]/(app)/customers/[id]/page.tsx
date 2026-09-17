'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCustomer, useBreadcrumb } from '@/hooks';
import { Button } from '@/components/atoms';
import { CustomerDetailContent } from '@/components/organisms';

export default function CustomerDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const resolvedParams = use(params);
  const customerId = Number(resolvedParams.id);

  const { data: customer, isLoading, error } = useCustomer(customerId);
  const t = useTranslations('customers');

  const isValidId = !Number.isNaN(customerId) && customerId > 0;

  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/customers' },
      {
        label: customer?.platformBuyerId
          ? t('detail.profile', { buyerId: customer.platformBuyerId })
          : isValidId
          ? t('detail.customerId', { id: customerId })
          : t('detail.customerProfile'),
      },
    ]);
  }, [customer?.platformBuyerId, customerId, isValidId, setBreadcrumb, t]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-xl bg-surface-lifted" />
        <div className="grid grid-cols-4 gap-3">
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
        </div>
        <div className="h-64 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">{t('detail.notFound')}</h3>
        <p className="mt-1 text-xs text-muted">
          {t('detail.notFoundDescription')}
        </p>
        <Link href="/customers" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            {t('detail.backToList')}
          </Button>
        </Link>
      </div>
    );
  }

  return <CustomerDetailContent customer={customer} />;
}
