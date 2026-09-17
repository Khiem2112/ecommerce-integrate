'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms';
import { OrganizationRoleBadge } from '@/components/molecules/organization/OrganizationRoleBadge';
import { useRemoveUserAccess, useUserAccessDetail, useUserAccessHistory } from '@/hooks';
import { Link, useRouter } from '@/i18n/navigation';
import { UserAccessStatusBadge } from '@/components/molecules/user/UserAccessStatusBadge';
import { EditUserDialog } from './EditUserDialog';
import { RemoveMembershipDialog } from './RemoveMembershipDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

export type UserAccessDetailProps = {
  readonly userId: number;
};

export function UserAccessDetail({ userId }: UserAccessDetailProps) {
  const t = useTranslations('users');
  const tDetail = useTranslations('users.detail');
  const tTable = useTranslations('users.table');
  const router = useRouter();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [auditPage, setAuditPage] = useState(1);

  const { data: member, isLoading, error, refetch } = useUserAccessDetail(userId);
  const {
    data: auditData,
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useUserAccessHistory(userId, auditPage, 10);

  const removeMutation = useRemoveUserAccess();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-surface-card border border-hairline" />
        <div className="h-64 rounded-2xl bg-surface-card border border-hairline" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="rounded-2xl border border-semantic-error/20 bg-semantic-error/10 p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-semantic-error">
          {error?.message || t('errors.notFound')}
        </p>
        <Link href="/users">
          <Button variant="outline" size="sm">
            {t('backToUsers')}
          </Button>
        </Link>
      </div>
    );
  }

  const handleConfirmRemove = async () => {
    try {
      await removeMutation.mutateAsync({
        userId: member.userId,
        expectedVersion: member.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setIsRemoveOpen(false);
      router.push('/users');
    } catch {
      // Error handled by mutation
    }
  };

  const initials = member.displayName
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link href="/users">
          <Button type="button" variant="ghost" size="sm">
            ← {t('backToUsers')}
          </Button>
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-hairline bg-surface-lifted text-base font-bold text-foreground shadow-sm">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatarUrl}
                  alt={member.displayName}
                  className="size-full rounded-2xl object-cover"
                />
              ) : (
                initials || 'U'
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">
                  {member.displayName}
                </h1>
                <OrganizationRoleBadge role={member.role} size="sm" />
                <UserAccessStatusBadge status={member.membershipStatus} size="sm" />
              </div>
              <p className="mt-1 text-xs text-muted">
                {member.organizationDisplayName}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {member.capabilities.canEditProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(true)}
              >
                {tTable('edit')}
              </Button>
            )}

            {member.capabilities.canResetPassword && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetOpen(true)}
              >
                {tTable('resetPassword')}
              </Button>
            )}

            {member.capabilities.canRemove && member.membershipStatus === 'active' && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsRemoveOpen(true)}
              >
                {tTable('remove')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-card space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          {tDetail('profileTitle')}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-hairline bg-surface-lifted/40 p-4 space-y-1">
            <span className="text-xs text-muted block">{tTable('displayName')}</span>
            <span className="text-sm font-semibold text-foreground block">
              {member.displayName}
            </span>
          </div>

          {member.capabilities.canViewLoginEmail && (
            <div className="rounded-xl border border-hairline bg-surface-lifted/40 p-4 space-y-1">
              <span className="text-xs text-muted block">{tTable('email')}</span>
              <span className="text-sm font-mono text-foreground block">
                {member.loginEmail || '—'}
              </span>
            </div>
          )}

          {member.capabilities.canViewContactEmail && (
            <div className="rounded-xl border border-hairline bg-surface-lifted/40 p-4 space-y-1">
              <span className="text-xs text-muted block">{tTable('contactEmail')}</span>
              <span className="text-sm font-mono text-foreground block">
                {member.contactEmail || '—'}
              </span>
            </div>
          )}

          <div className="rounded-xl border border-hairline bg-surface-lifted/40 p-4 space-y-1">
            <span className="text-xs text-muted block">{tDetail('joinedAt')}</span>
            <span className="text-sm text-foreground block">
              {new Date(member.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="rounded-xl border border-hairline bg-surface-lifted/40 p-4 space-y-1">
            <span className="text-xs text-muted block">{tDetail('lastUpdated')}</span>
            <span className="text-sm text-foreground block">
              {new Date(member.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Audit Log Section (if capability permits) */}
      {member.capabilities.canViewAudit && (
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {tDetail('auditTitle')}
            </h2>
            {auditData && auditData.total > 0 && (
              <span className="text-xs text-muted">
                {tDetail('eventsCount', { count: auditData.total })}
              </span>
            )}
          </div>

          {isAuditLoading ? (
            <div className="space-y-2">
              <div className="h-10 rounded-lg bg-surface-lifted animate-pulse" />
              <div className="h-10 rounded-lg bg-surface-lifted animate-pulse" />
            </div>
          ) : auditData && auditData.items.length > 0 ? (
            <div className="divide-y divide-hairline rounded-xl border border-hairline overflow-hidden">
              {auditData.items.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs bg-surface-card hover:bg-surface-lifted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-foreground">
                      {log.action}
                    </span>
                    {log.actorDisplayName && (
                      <span className="text-muted">
                        {tDetail('byActor', { actor: log.actorDisplayName })}
                      </span>
                    )}
                  </div>
                  <span className="text-muted font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted py-4 text-center">
              {tDetail('noAudit')}
            </p>
          )}

          {auditData && auditData.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
              >
                ←
              </Button>
              <span className="text-xs text-muted">
                {auditPage} / {auditData.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={auditPage >= auditData.totalPages}
                onClick={() => setAuditPage((p) => Math.min(auditData.totalPages, p + 1))}
              >
                →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <EditUserDialog
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        detail={member}
        onSuccess={() => {
          refetch();
          refetchAudit();
        }}
      />

      <ResetPasswordDialog
        isOpen={isResetOpen}
        onOpenChange={setIsResetOpen}
        userId={member.userId}
        userName={member.displayName}
      />

      <RemoveMembershipDialog
        isOpen={isRemoveOpen}
        onOpenChange={setIsRemoveOpen}
        userName={member.displayName}
        orgName={member.organizationDisplayName}
        isPending={removeMutation.isPending}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
