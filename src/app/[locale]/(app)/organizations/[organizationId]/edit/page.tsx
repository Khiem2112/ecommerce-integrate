'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/atoms';
import { OrganizationForm } from '@/components/organisms';
import { useBreadcrumb, useOrganization } from '@/hooks';

export default function EditOrganizationPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId: rawId } = use(params);
  const organizationId = Number(rawId);
  const t = useTranslations('organizations');
  const { data, isLoading } = useOrganization(organizationId);
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/organizations' },
      { label: t('edit') },
    ]);
  }, [setBreadcrumb, t]);

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-surface-lifted" />;
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-card p-8 text-center shadow-card">
        <p className="text-sm text-muted">{t('notFound')}</p>
        <Link href="/organizations" className="mt-4 inline-block">
          <Button variant="outline">{t('back')}</Button>
        </Link>
      </div>
    );
  }

  return <OrganizationForm organization={data} />;
}
