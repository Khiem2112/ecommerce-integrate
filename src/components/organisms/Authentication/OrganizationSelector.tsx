'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button, Input } from '@/components/atoms';
import { OrganizationOptionCard } from '@/components/molecules';
import { useAuthentication, useSwitchActiveOrganization, useToast } from '@/hooks';
import type { OrganizationSummary } from '@/types';

export type OrganizationSelectorProps = {
  readonly organizations: readonly OrganizationSummary[];
  readonly returnUrl?: string;
};

export function OrganizationSelector({
  organizations,
  returnUrl,
}: OrganizationSelectorProps) {
  const t = useTranslations('authentication.selectOrganization');
  const router = useRouter();
  const { toast } = useToast();
  const switchMutation = useSwitchActiveOrganization();
  const { logout, isLoggingOut } = useAuthentication();
  const [search, setSearch] = useState('');

  const filtered = organizations.filter(
    (org) =>
      org.displayName.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (organizationId: number): void => {
    switchMutation.mutate(organizationId, {
      onSuccess: () => {
        router.push(returnUrl ?? '/conversations');
        router.refresh();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : t('switchError'));
      },
    });
  };

  const isSubmitting = switchMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          {t('subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            disabled={isSubmitting}
            rounded={false}
            className="w-full"
          />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {filtered.length > 0 ? (
            filtered.map((org) => (
              <OrganizationOptionCard
                key={org.id}
                organization={org}
                onSelect={handleSelect}
                disabled={isSubmitting}
              />
            ))
          ) : (
            <p className="py-8 text-center text-xs text-muted">
              {t('emptyResult')}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-hairline flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            isLoading={isLoggingOut}
            disabled={isSubmitting}
          >
            {t('logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
