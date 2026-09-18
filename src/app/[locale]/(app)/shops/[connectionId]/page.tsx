'use client';

import { useEffect, use } from 'react';
import { useTranslations } from 'next-intl';
import { ShopConnectionDetailView } from '@/components/organisms';
import { useBreadcrumb } from '@/hooks';

export type ShopDetailPageProps = {
  readonly connectionId?: number | string;
  readonly params?: Promise<{ readonly connectionId: string }>;
};

export default function ShopDetailPage({
  connectionId,
  params,
}: ShopDetailPageProps) {
  const resolvedParams = params ? use(params) : undefined;
  const rawId = connectionId ?? resolvedParams?.connectionId;
  const t = useTranslations('shops');
  const { setBreadcrumb } = useBreadcrumb();

  const id = typeof rawId === 'number' ? rawId : parseInt(rawId ?? '', 10);

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/shops' },
      { label: `#${id}` },
    ]);
  }, [setBreadcrumb, t, id]);

  return <ShopConnectionDetailView connectionId={id} />;
}
