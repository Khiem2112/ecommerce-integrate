'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, Switch } from '@/components/atoms';
import { cn } from '@/lib/cn';
import {
  ErrorBanner,
  OrganizationContextBanner,
  OrganizationStatusBadge,
} from '@/components/molecules';
import {
  useChangeOrganizationLifecycle,
  useSwitchActiveOrganization,
  useToast,
} from '@/hooks';
import { OrganizationLifecycleDialog } from './OrganizationLifecycleDialog';
import type {
  OrganizationDetail,
  OrganizationStatusCode,
} from '@/types';

export type OrganizationDetailHeaderProps = {
  readonly organization: OrganizationDetail;
  readonly onSwitchActive?: () => void;
  readonly isSwitching?: boolean;
};

export function OrganizationDetailHeader({
  organization,
  onSwitchActive,
  isSwitching,
}: OrganizationDetailHeaderProps) {
  const t = useTranslations('organizations');
  const { toast } = useToast();
  const [lifecycleTarget, setLifecycleTarget] = useState<OrganizationStatusCode | null>(null);

  const defaultSwitchMutation = useSwitchActiveOrganization();
  const lifecycleMutation = useChangeOrganizationLifecycle();

  const handleDefaultSwitch = () => {
    if (organization.status === 'suspended') {
      toast({
        variant: 'warning',
        title: t('toast.cannotSwitchSuspendedTitle'),
        description: t('toast.cannotSwitchSuspended'),
      });
      return;
    }
    if (organization.status === 'archived') {
      toast({
        variant: 'warning',
        title: t('toast.cannotSwitchArchivedTitle'),
        description: t('toast.cannotSwitchArchived'),
      });
      return;
    }
    defaultSwitchMutation.mutate(organization.id);
  };

  const handleSwitch = onSwitchActive ?? handleDefaultSwitch;
  const isSwitchPending = isSwitching ?? defaultSwitchMutation.isPending;

  const handleToggleLifecycle = async (checked: boolean) => {
    const targetStatus: 'active' | 'suspended' = checked ? 'active' : 'suspended';
    await lifecycleMutation.mutateAsync({
      organizationId: organization.id,
      targetStatus,
      expectedVersion: organization.version,
    });
  };

  const handleLifecycleConfirm = async (
    targetStatus: 'active' | 'suspended' | 'archived',
    confirmation?: string,
  ) => {
    await lifecycleMutation.mutateAsync({
      organizationId: organization.id,
      targetStatus,
      expectedVersion: organization.version,
      confirmation,
    });
  };

  return (
    <div className="space-y-4">
      {/* Back link navigation */}
      <div>
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>{t('back')}</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <header className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Identity & Status */}
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-hairline bg-surface-lifted text-xl font-bold text-foreground shadow-xs overflow-hidden">
              {organization.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={organization.logoUrl}
                  alt={organization.displayName}
                  className="size-full object-cover"
                />
              ) : (
                organization.displayName.charAt(0).toUpperCase()
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {organization.displayName}
                </h1>

                {organization.status === 'archived' ? (
                  <OrganizationStatusBadge status="archived" size="sm" />
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-lifted/80 px-2.5 py-1 shadow-xs">
                    <Switch
                      id="org-lifecycle-toggle"
                      size="sm"
                      checked={organization.status === 'active'}
                      disabled={!organization.canManageLifecycle || lifecycleMutation.isPending}
                      onCheckedChange={handleToggleLifecycle}
                      aria-label={
                        organization.status === 'active'
                          ? t('statuses.active')
                          : t('statuses.suspended')
                      }
                    />
                    <label
                      htmlFor="org-lifecycle-toggle"
                      className={cn(
                        'cursor-pointer select-none text-xs font-medium transition-colors',
                        organization.status === 'active'
                          ? 'text-status-success'
                          : 'text-muted',
                        (!organization.canManageLifecycle || lifecycleMutation.isPending) &&
                        'cursor-not-allowed opacity-60',
                      )}
                    >
                      {organization.status === 'active'
                        ? t('statuses.active')
                        : t('statuses.suspended')}
                    </label>
                  </div>
                )}

                {organization.isActiveContext && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-semibold text-status-success">
                    <span className="size-1.5 rounded-full bg-status-success" />
                    {t('context.active')}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="font-mono text-muted">{organization.slug}</span>
                <span className="text-hairline-strong">•</span>
                <span>{organization.timezone}</span>
                <span className="text-hairline-strong">•</span>
                <span>{organization.baseCurrency}</span>
              </div>
            </div>
          </div>

          {/* Status Governance Actions & Navigation Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {organization.canManageLifecycle && (
              <>
                {organization.status !== 'archived' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLifecycleTarget('archived')}
                    disabled={lifecycleMutation.isPending}
                    className="gap-1.5 border-semantic-error/30 text-semantic-error hover:bg-semantic-error/10 hover:border-semantic-error"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 8v13H3V8" />
                      <path d="M1 3h22v5H1z" />
                      <path d="M10 12h4" />
                    </svg>
                    <span>{t('lifecycle.archive')}</span>
                  </Button>
                )}

                {organization.status === 'archived' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLifecycleTarget('active')}
                    disabled={lifecycleMutation.isPending}
                    className="gap-1.5"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    <span>{t('lifecycle.restore')}</span>
                  </Button>
                )}
              </>
            )}

            {organization.canManage && (
              <Link href={`/organizations/${organization.id}/edit`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <svg
                    aria-hidden="true"
                    className="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  <span>{t('edit')}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {lifecycleMutation.error && (
          <div className="mt-4">
            <ErrorBanner message={t('lifecycle.failed')} />
          </div>
        )}

        {/* Selected / Non-active Context Warning */}
        {!organization.isActiveContext && (
          <div className="mt-5 border-t border-hairline pt-4">
            <OrganizationContextBanner
              isSwitching={isSwitchPending}
              onSwitchActive={handleSwitch}
            />
          </div>
        )}
      </header>

      {/* Lifecycle Confirmation Dialog */}
      <OrganizationLifecycleDialog
        organization={organization}
        targetStatus={lifecycleTarget}
        isOpen={Boolean(lifecycleTarget)}
        isPending={lifecycleMutation.isPending}
        onClose={() => setLifecycleTarget(null)}
        onConfirm={handleLifecycleConfirm}
      />
    </div>
  );
}
