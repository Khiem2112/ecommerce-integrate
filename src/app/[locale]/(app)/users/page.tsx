'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { UserDirectory } from '@/components/organisms/User';
import { useBreadcrumb } from '@/hooks';

export default function UsersPage() {
  const t = useTranslations('users');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([{ label: t('breadcrumb') }]);
  }, [setBreadcrumb, t]);

  return <UserDirectory />;
}
