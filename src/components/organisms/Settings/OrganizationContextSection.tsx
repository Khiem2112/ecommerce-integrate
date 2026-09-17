'use client';

import { useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/atoms';
import {
  OrganizationOptionCard,
  OrganizationRoleBadge,
} from '@/components/molecules';
import {
  useActiveOrganizationContext,
  useOrganization,
  useOrganizations,
  useSwitchActiveOrganization,
} from '@/hooks';
import { useAuthentication } from '@/hooks/useAuthentication';
import { cn } from '@/lib/cn';

type OrganizationMetricProps = {
  readonly label: string;
  readonly value: string | number;
  readonly mono?: boolean;
  readonly emphasized?: boolean;
};

function OrganizationMetric({
  label,
  value,
  mono = false,
  emphasized = false,
}: OrganizationMetricProps): JSX.Element {
  return (
    <div className="rounded-lg border border-hairline/70 bg-surface-lifted/40 p-3.5">
      <span className="block text-[11px] font-medium text-muted">{label}</span>
      <span
        className={cn(
          'mt-1 block text-foreground',
          mono ? 'font-mono text-xs' : 'text-sm font-semibold',
          emphasized && 'font-semibold',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function OrganizationContextSection(): JSX.Element {
  const t = useTranslations('settings');
  const tOrg = useTranslations('organizations');
  const { user } = useAuthentication();
  const { data: activeOrg } = useActiveOrganizationContext();
  const { data: organizationDetail } = useOrganization(activeOrg?.organizationId);
  const { data: organizations } = useOrganizations({ page: 1, pageSize: 100 });
  const switchMutation = useSwitchActiveOrganization();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const orgItems = organizations?.items ?? [];
  const filteredOrgs = searchQuery.trim()
    ? orgItems.filter(
        (org) =>
          org.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          org.slug.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : orgItems;

  return (
    <section className="w-full space-y-4 rounded-xl border border-hairline bg-surface-card p-6 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('organizationTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{t('organizationDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSwitchModalOpen(true)}
          >
            {t('switchOrg')}
          </Button>
          {activeOrg?.organizationId && (
            <Link href={`/organizations/${activeOrg.organizationId}`}>
              <Button type="button" variant="ghost" size="sm">
                {t('manageOrg')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {activeOrg ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrganizationMetric label={tOrg('name')} value={activeOrg.displayName ?? '—'} />
          <OrganizationMetric label={tOrg('slug')} value={activeOrg.slug ?? '—'} mono />
          <div className="rounded-lg border border-hairline/70 bg-surface-lifted/40 p-3.5">
            <span className="block text-[11px] font-medium text-muted">{t('yourRole')}</span>
            <div className="mt-1">
              {user?.role ? (
                <OrganizationRoleBadge role={user.role} size="xs" />
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
            </div>
          </div>

          {organizationDetail && (
            <>
              <OrganizationMetric
                label={tOrg('form.currency')}
                value={organizationDetail.baseCurrency ?? '—'}
                mono
              />
              <OrganizationMetric
                label={tOrg('form.timezone')}
                value={organizationDetail.timezone ?? '—'}
                mono
              />
              <OrganizationMetric
                label={t('shopsCount')}
                value={organizationDetail.shopCount}
                mono
                emphasized
              />
            </>
          )}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-muted">
          <p>{t('noActiveOrg')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setIsSwitchModalOpen(true)}
          >
            {t('switchOrg')}
          </Button>
        </div>
      )}

      <Dialog open={isSwitchModalOpen} onOpenChange={setIsSwitchModalOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-hairline p-5 pb-4">
            <DialogTitle>{tOrg('context.switchModalTitle')}</DialogTitle>
            <DialogDescription className="mt-1">
              {tOrg('context.switchModalDescription')}
            </DialogDescription>
            <div className="pt-3">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={tOrg('search')}
                size="sm"
              />
            </div>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto p-5">
            {filteredOrgs.length > 0 ? (
              filteredOrgs.map((org) => {
                const isActive = org.id === activeOrg?.organizationId;

                return (
                  <OrganizationOptionCard
                    key={org.id}
                    organization={org}
                    isSelected={isActive}
                    disabled={switchMutation.isPending}
                    onSelect={(id) => {
                      if (!isActive) {
                        switchMutation.mutate(id, {
                          onSuccess: () => setIsSwitchModalOpen(false),
                        });
                        return;
                      }

                      setIsSwitchModalOpen(false);
                    }}
                  />
                );
              })
            ) : (
              <p className="py-8 text-center text-xs text-muted">{tOrg('empty')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
