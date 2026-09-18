import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Badge } from '@/components/atoms';
import { OrganizationConnectedShopCard } from './OrganizationConnectedShopCard';
import type { OrganizationDetail } from '@/types';

export type OrganizationShopsCardProps = {
  readonly organization: OrganizationDetail;
  readonly onConnect?: () => void;
};

export function OrganizationShopsCard({
  organization,
  onConnect,
}: OrganizationShopsCardProps): JSX.Element {
  const t = useTranslations('organizations');
  const tShops = useTranslations('shops');

  return (
    <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-2">
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
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">
            {t('shopsTab.title')}
          </h3>
          <Badge variant="secondary" size="xs" className="font-mono">
            {organization.connections.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {organization.canManage && onConnect && (
            <Button variant="ghost" size="xs" onClick={onConnect}>
              + {tShops('directory.connectShop')}
            </Button>
          )}
          <Link
            href={`/shops?organizationId=${organization.id}`}
            className="text-xs text-primary hover:underline font-medium"
          >
            {t('shopsTab.viewAll')}
          </Link>
        </div>
      </div>

      <div className="flex-1">
        {organization.connections.length > 0 ? (
          <div className="divide-y divide-hairline max-h-[380px] overflow-y-auto">
            {organization.connections.map((connection) => (
              <OrganizationConnectedShopCard
                key={connection.id}
                connection={connection}
                variant="row"
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-hairline bg-surface-lifted text-muted">
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
            <p className="mt-3 text-sm font-semibold text-foreground">
              {t('directory.noConnectedShops')}
            </p>
            <p className="mt-1 text-xs text-muted max-w-xs">
              {t('shopsTab.empty')}
            </p>
            {organization.canManage && onConnect && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onConnect}
              >
                {tShops('directory.connectShop')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
