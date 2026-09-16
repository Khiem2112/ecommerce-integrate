'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { OrganizationForm } from '@/components/organisms';
import { useBreadcrumb } from '@/hooks';

export default function NewOrganizationPage() {
  const t = useTranslations('organizations');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/organizations' },
      { label: t('new') },
    ]);
  }, [setBreadcrumb, t]);

  return <OrganizationForm />;
}
