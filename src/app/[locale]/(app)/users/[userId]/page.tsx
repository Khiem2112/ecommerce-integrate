'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { UserAccessDetail } from '@/components/organisms/User';
import { useBreadcrumb } from '@/hooks';

export default function UserDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly userId: string }>;
}) {
  const { userId: rawId } = use(params);
  const userId = Number(rawId);
  const t = useTranslations('users');
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/users' },
      { label: t('detail.pageTitle') },
    ]);
  }, [setBreadcrumb, t]);

  return (
    <div className="max-w-4xl mx-auto py-4">
      <UserAccessDetail userId={userId} />
    </div>
  );
}
