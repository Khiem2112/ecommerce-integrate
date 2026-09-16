'use client';

import { useTranslations } from 'next-intl';
import {
  OrganizationBasicInfoCard,
  OrganizationShopsCard,
} from '@/components/molecules';
import type { OrganizationDetail } from '@/types';

export type OrganizationWorkspaceInfoSectionProps = {
  readonly organization: OrganizationDetail;
};

export function OrganizationWorkspaceInfoSection({
  organization,
}: OrganizationWorkspaceInfoSectionProps) {
  const t = useTranslations('organizations');

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
          {t('overviewTitle')}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left Sub-section: Basic Details */}
        <div className="lg:col-span-5">
          <OrganizationBasicInfoCard organization={organization} />
        </div>

        {/* Right Sub-section: Connected Shops */}
        <div className="lg:col-span-7">
          <OrganizationShopsCard organization={organization} />
        </div>
      </div>
    </section>
  );
}
