'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ShopConnectionDirectory } from '@/components/organisms';
import { useBreadcrumb } from '@/hooks';

export default function ShopsPage() {
  const t = useTranslations('shops');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([{ label: t('breadcrumb') }]);
  }, [setBreadcrumb, t]);

  return <ShopConnectionDirectory />;
}
