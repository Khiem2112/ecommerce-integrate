'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useOrder, useOrderLookups, useBreadcrumb } from '@/hooks';
import { Button } from '@/components/atoms';
import { OrderDetailContent } from '@/components/organisms';

export default function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('orders');
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.id);

  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: lookups } = useOrderLookups();

  // Dynamic Breadcrumb
  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/orders' },
      {
        label: order?.platformOrderId
          ? t('detail.orderLabel', { id: order.platformOrderId })
          : t('detail.orderLabel', { id: orderId }),
      },
    ]);
  }, [order?.platformOrderId, orderId, setBreadcrumb, t]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 w-1/3 rounded-lg bg-surface-lifted" />
        <div className="h-64 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">{t('detail.notFound')}</h3>
        <p className="mt-1 text-xs text-muted">
          {t('detail.notFoundDescription')}
        </p>
        <Link href="/orders" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            {t('detail.backToList')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <OrderDetailContent
      order={order}
      lookups={lookups}
      onOrderDeleted={() => router.push('/orders')}
    />
  );
}

