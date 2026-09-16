'use client';

import { useTranslations } from 'next-intl';
import { OrganizationConnectedShopCard } from '@/components/molecules';
import type { OrganizationDetail } from '@/types';

export type OrganizationConnectedShopsTabProps = {
  readonly organization: OrganizationDetail;
};

export function OrganizationConnectedShopsTab({
  organization,
}: OrganizationConnectedShopsTabProps) {
  const t = useTranslations('organizations');

  return (
    <section className="rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t('shopsTab.title')}
        </h2>
        <span className="inline-flex items-center rounded-full border border-hairline bg-surface-lifted px-2.5 py-0.5 font-mono text-xs font-medium text-muted">
          {organization.connections.length}
        </span>
      </div>

      {organization.connections.length > 0 ? (
        <div className="divide-y divide-hairline">
          {organization.connections.map((connection) => (
            <OrganizationConnectedShopCard
              key={connection.id}
              connection={connection}
              variant="row"
            />
          ))}
        </div>
      ) : (
        <div className="py-12 px-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-hairline bg-surface-lifted text-muted">
            <svg
              aria-hidden="true"
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.623 4.72" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {t('directory.noConnectedShops')}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t('shopsTab.empty')}
          </p>
        </div>
      )}
    </section>
  );
}
