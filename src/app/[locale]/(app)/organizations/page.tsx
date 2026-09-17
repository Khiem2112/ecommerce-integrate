'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { OrganizationDirectory } from '@/components/organisms';
import { useBreadcrumb } from '@/hooks';

export default function OrganizationsPage() {
  const t = useTranslations('organizations');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([{ label: t('breadcrumb') }]);
  }, [setBreadcrumb, t]);

  return <OrganizationDirectory />;
}
