'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useBreadcrumb, useOrder, useOrderLookups } from '@/hooks';
import { OrderForm } from '@/components/organisms';
import { Button } from '@/components/atoms';
import type { OrderFormValues } from '@/forms';

type EditOrderPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default function EditOrderPage({ params }: EditOrderPageProps) {
  const t = useTranslations('orders');
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.id);

  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: lookups } = useOrderLookups();

  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/orders' },
      {
        label: order?.platformOrderId
          ? t('detail.orderLabel', { id: order.platformOrderId })
          : t('detail.orderLabel', { id: orderId }),
        href: `/orders/${orderId}`,
      },
      { label: t('detail.editFull') },
    ]);
  }, [order?.platformOrderId, orderId, setBreadcrumb, t]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-1/3 rounded-lg bg-surface-lifted" />
        <div className="h-80 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">{t('detail.notFound')}</h3>
        <p className="mt-1 text-xs text-muted">
          {t('detail.notFoundEditDescription')}
        </p>
        <Link href="/orders" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            {t('detail.backToList')}
          </Button>
        </Link>
      </div>
    );
  }

  const initialValues: OrderFormValues = {
    id: order.id,
    platformId: order.platformId,
    platformOrderId: order.platformOrderId,
    customerId: order.customerId,
    currentStatusId: order.currentStatusId,
    currency: order.currency || 'VND',
    shippingFee: order.shippingFee,
    discountAmount: order.discountAmount,
    totalValue: order.totalValue,
    cancelReturnInitiator: (order.cancelReturnInitiator as 'buyer' | 'seller' | 'system' | '') || '',
    cancellationReason: order.cancellationReason || '',
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku || '',
      productName: item.productName,
      categoryId: item.categoryId ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      refundAmount: item.refundAmount,
    })),
    updatedAt: String(order.updatedAt),
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <OrderForm
        mode="EDIT"
        orderId={order.id}
        initialValues={initialValues}
        lookups={lookups}
      />
    </div>
  );
}
