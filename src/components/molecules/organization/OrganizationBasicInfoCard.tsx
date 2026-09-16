'use client';

import { useTranslations } from 'next-intl';
import type { OrganizationDetail } from '@/types';

export type OrganizationBasicInfoCardProps = {
  readonly organization: OrganizationDetail;
};

export function OrganizationBasicInfoCard({
  organization,
}: OrganizationBasicInfoCardProps) {
  const t = useTranslations('organizations');

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-hairline bg-surface-card p-5 shadow-card">
      <div>
        <div className="flex items-center gap-2 border-b border-hairline pb-3">
          <svg
            aria-hidden="true"
            className="size-4 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">
            {t('basicInfo')}
          </h3>
        </div>

        <dl className="mt-2 divide-y divide-hairline text-xs">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('form.timezone')}</dt>
            <dd className="font-mono font-medium text-foreground">
              {organization.timezone}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('form.currency')}</dt>
            <dd className="font-mono font-medium text-foreground">
              {organization.baseCurrency}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('slug')}</dt>
            <dd className="font-mono text-muted">
              {organization.slug}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('form.legalName')}</dt>
            <dd className="font-medium text-foreground">
              {organization.legalName ?? '—'}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('form.country')}</dt>
            <dd className="font-mono font-medium text-foreground">
              {organization.countryCode ?? '—'}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('shops')}</dt>
            <dd className="font-mono tabular-nums font-medium text-foreground">
              {organization.shopCount}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">{t('members')}</dt>
            <dd className="font-mono tabular-nums font-medium text-foreground">
              {organization.memberCount}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 border-t border-hairline pt-3 flex items-center justify-between text-xs text-muted">
        <span>{t('lastUpdated')}</span>
        <span className="font-mono tabular-nums">
          {new Date(organization.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
