'use client';

import type { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { OrganizationRoleBadge } from '@/components/molecules';
import { PasswordChangeForm } from '@/components/organisms/Authentication';
import { useAuthentication } from '@/hooks/useAuthentication';

export function PersonalProfileSection(): JSX.Element {
  const t = useTranslations('settings');
  const { user } = useAuthentication();
  const initial = (user?.displayName ?? user?.email ?? 'U').charAt(0).toUpperCase();

  return (
    <section className="w-full space-y-4 rounded-xl border border-hairline bg-surface-card p-6 shadow-sm">
      <div className="border-b border-hairline pb-4">
        <h2 className="text-base font-semibold text-foreground">{t('personalTitle')}</h2>
        <p className="mt-0.5 text-xs text-muted">{t('personalDescription')}</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-lifted text-lg font-bold text-foreground select-none">
            {initial}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {user?.displayName ?? '—'}
              </span>
              {user?.role && <OrganizationRoleBadge role={user.role} size="xs" />}
            </div>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            <p className="text-[11px] text-muted">
              {t('userId')}: <span className="font-mono">#{user?.id}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-hairline pt-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t('changePasswordTitle')}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{t('changePasswordDescription')}</p>
        </div>

        <div className="w-full max-w-xl">
          <PasswordChangeForm mode="voluntary" />
        </div>
      </div>
    </section>
  );
}
