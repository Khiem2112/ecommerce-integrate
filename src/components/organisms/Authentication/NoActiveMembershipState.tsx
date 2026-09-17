'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms';
import { UserIdentityBadge } from '@/components/molecules';
import { useAuthentication } from '@/hooks/useAuthentication';
import type { UserSessionProjection } from '@/types';

export type NoActiveMembershipStateProps = {
  readonly user?: UserSessionProjection | null;
};

export function NoActiveMembershipState({ user: propUser }: NoActiveMembershipStateProps = {}) {
  const t = useTranslations('authentication.noActiveMembership');
  const { user: authUser, logout, isLoggingOut } = useAuthentication();
  const user = propUser ?? authUser;

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-status-warning/10 p-3 text-status-warning">
          <svg
            aria-hidden="true"
            className="size-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          {t('title')}
        </h2>
        <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
          {t('description')}
        </p>
      </div>

      {user && (
        <div className="flex justify-center">
          <div className="inline-block rounded-xl border border-hairline bg-surface-lifted/40 p-3 text-left">
            <UserIdentityBadge user={user} size="sm" />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void logout()}
          isLoading={isLoggingOut}
          className="w-full sm:w-auto"
        >
          {t('logout')}
        </Button>
      </div>
    </div>
  );
}
