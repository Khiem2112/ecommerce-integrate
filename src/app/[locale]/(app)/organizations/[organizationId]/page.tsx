'use client';

import { use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/atoms';
import { OrganizationInspector } from '@/components/organisms';
import { OrganizationDetailSkeleton } from '@/components/molecules';
import {
  useBreadcrumb,
  useOrganization,
  useSwitchActiveOrganization,
  useToast,
} from '@/hooks';

export default function OrganizationDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId: rawId } = use(params);
  const organizationId = Number(rawId);
  const t = useTranslations('organizations');
  const { data, isLoading } = useOrganization(organizationId);
  const { setBreadcrumb } = useBreadcrumb();
  const { toast } = useToast();
  const switchMutation = useSwitchActiveOrganization();

  const handleSwitchActive = () => {
    if (!data) return;

    if (data.status === 'suspended') {
      toast({
        variant: 'warning',
        title: t('toast.cannotSwitchSuspendedTitle'),
        description: t('toast.cannotSwitchSuspended'),
      });
      return;
    }

    if (data.status === 'archived') {
      toast({
        variant: 'warning',
        title: t('toast.cannotSwitchArchivedTitle'),
        description: t('toast.cannotSwitchArchived'),
      });
      return;
    }

    switchMutation.mutate(data.id);
  };

  useEffect(() => {
    setBreadcrumb([
      { label: t('breadcrumb'), href: '/organizations' },
      { label: data?.displayName ?? t('title') },
    ]);
  }, [data?.displayName, setBreadcrumb, t]);

  if (isLoading) {
    return <OrganizationDetailSkeleton />;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <div className="rounded-2xl border border-hairline bg-surface-card p-8 shadow-card">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-hairline bg-surface-lifted text-muted">
            <svg
              aria-hidden="true"
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            {t('notFound')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('empty')}
          </p>
          <div className="mt-6">
            <Link href="/organizations">
              <Button variant="outline" size="sm">
                {t('back')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <OrganizationInspector
        organization={data}
        onSwitchActive={handleSwitchActive}
        isSwitching={switchMutation.isPending}
      />
    </div>
  );
}
