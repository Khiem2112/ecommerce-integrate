'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useBreadcrumb, useOrderLookups } from '@/hooks';
import { OrderForm } from '@/components/organisms';

export default function NewOrderPage() {
  const { setBreadcrumb } = useBreadcrumb();
  const t = useTranslations('orders');

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/orders' },
      { label: t('detail.newBreadcrumb') },
    ]);
  }, [setBreadcrumb, t]);

  const { data: lookups } = useOrderLookups();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <OrderForm mode="NEW" lookups={lookups} />
    </div>
  );
}
