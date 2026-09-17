'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
} from '@/components/atoms';
import { ErrorBanner, Pagination } from '@/components/molecules';
import { OrganizationRoleBadge } from '@/components/molecules/organization/OrganizationRoleBadge';
import { UserAccessFilterBar } from '@/components/molecules/user/UserAccessFilterBar';
import { UserAccessStatusBadge } from '@/components/molecules/user/UserAccessStatusBadge';
import { useRemoveUserAccess, useUsers } from '@/hooks';
import { Link, useRouter } from '@/i18n/navigation';
import type {
  OrganizationRoleCode,
  UserAccessFilterValues,
  UserAccessStatusCode,
  UserAccessSummary,
} from '@/types';
import { CreateUserDialog } from './CreateUserDialog';
import { RemoveMembershipDialog } from './RemoveMembershipDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { UserDirectorySkeleton } from './UserDirectorySkeleton';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserDirectory() {
  const t = useTranslations('users');
  const tTable = useTranslations('users.table');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse filters from URL searchParams
  const q = searchParams.get('q') || undefined;
  const role = (searchParams.get('role') as OrganizationRoleCode) || undefined;
  const status = (searchParams.get('status') as UserAccessStatusCode) || 'active';
  const sort = searchParams.get('sort') || 'displayName:asc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  const filters: UserAccessFilterValues = {
    q,
    role,
    status,
    sort,
    page,
    limit,
  };

  const { data, isLoading, isFetching, error, refetch } = useUsers(filters);

  const [selectedUserForReset, setSelectedUserForReset] =
    useState<UserAccessSummary | null>(null);
  const [selectedUserForRemove, setSelectedUserForRemove] =
    useState<UserAccessSummary | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const removeMutation = useRemoveUserAccess();

  const updateFilters = useCallback(
    (newFilters: UserAccessFilterValues) => {
      const params = new URLSearchParams();
      if (newFilters.q) params.set('q', newFilters.q);
      if (newFilters.role) params.set('role', newFilters.role);
      if (newFilters.status && newFilters.status !== 'active') {
        params.set('status', newFilters.status);
      }
      if (newFilters.sort && newFilters.sort !== 'displayName:asc') {
        params.set('sort', newFilters.sort);
      }
      if (newFilters.page && newFilters.page > 1) {
        params.set('page', String(newFilters.page));
      }
      if (newFilters.limit && newFilters.limit !== 25) {
        params.set('limit', String(newFilters.limit));
      }

      router.push(`/users?${params.toString()}`);
    },
    [router],
  );

  const handleSortToggle = (field: string) => {
    const currentSort = filters.sort ?? 'displayName:asc';
    const [currentField, currentDir] = currentSort.split(':');
    let nextDir = 'asc';
    if (currentField === field && currentDir === 'asc') {
      nextDir = 'desc';
    }
    updateFilters({ ...filters, sort: `${field}:${nextDir}`, page: 1 });
  };

  const handleConfirmRemove = async () => {
    if (!selectedUserForRemove) return;
    try {
      await removeMutation.mutateAsync({
        userId: selectedUserForRemove.userId,
        expectedVersion: selectedUserForRemove.version,
        idempotencyKey: crypto.randomUUID(),
      });
      setSelectedUserForRemove(null);
    } catch {
      // Handled by TanStack mutation
    }
  };

  const handleEdit = (user: UserAccessSummary) => {
    router.push(`/users/${user.userId}`);
  };

  const hasActiveFilters = Boolean(
    filters.q || filters.role || (filters.status && filters.status !== 'active'),
  );

  return (
    <div className="space-y-6">
      {/* Header section with active organization and Add User button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            {isFetching && !isLoading && (
              <span className="rounded-full bg-surface-lifted border border-hairline px-2.5 py-0.5 text-xs text-muted">
                {t('refreshing')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{t('description')}</p>
        </div>

        {data?.canProvision && (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setIsCreateOpen(true)}
          >
            <svg
              aria-hidden="true"
              className="size-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            {t('addUser')}
          </Button>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-card">
        <UserAccessFilterBar
          filters={filters}
          onFiltersChange={updateFilters}
          canManageStatus={Boolean(data?.canProvision)}
        />
      </div>

      {/* Error state */}
      {error && (
        <ErrorBanner
          message={error.message || tTable('loadFailed')}
          onRetry={() => refetch()}
          className="rounded-2xl"
        />
      )}

      {/* Loading state */}
      {isLoading ? (
        <UserDirectorySkeleton />
      ) : data ? (
        <>
          {/* Integrity empty check: organization must have at least 1 owner */}
          {data.items.length === 0 && !hasActiveFilters && (
            <div className="rounded-2xl border border-hairline bg-surface-card p-12 text-center shadow-card space-y-3">
              <p className="text-sm text-muted">{tTable('emptyActive')}</p>
              {data.canProvision && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                >
                  {t('addUser')}
                </Button>
              )}
            </div>
          )}

          {/* Filtered empty state */}
          {data.items.length === 0 && hasActiveFilters && (
            <div className="rounded-2xl border border-hairline bg-surface-card p-12 text-center shadow-card space-y-3">
              <p className="text-sm font-medium text-foreground">
                {tTable('emptyFiltered')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateFilters({
                    q: undefined,
                    role: undefined,
                    status: 'active',
                    page: 1,
                  })
                }
              >
                {tTable('clearFilters')}
              </Button>
            </div>
          )}

          {/* User Table display */}
          {data.items.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[260px]">
                        <button
                          type="button"
                          onClick={() => handleSortToggle('displayName')}
                          className="inline-flex items-center gap-1.5 font-bold hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                          {tTable('displayName')}
                          {filters.sort?.startsWith('displayName') && (
                            <span className="text-xs">
                              {filters.sort.endsWith('desc') ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </TableHead>

                      <TableHead className="w-36">
                        <button
                          type="button"
                          onClick={() => handleSortToggle('role')}
                          className="inline-flex items-center gap-1.5 font-bold hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                          {tTable('role')}
                          {filters.sort?.startsWith('role') && (
                            <span className="text-xs">
                              {filters.sort.endsWith('desc') ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </TableHead>

                      <TableHead className="w-32">
                        <button
                          type="button"
                          onClick={() => handleSortToggle('status')}
                          className="inline-flex items-center gap-1.5 font-bold hover:text-foreground transition-colors cursor-pointer select-none"
                        >
                          {tTable('status')}
                          {filters.sort?.startsWith('status') && (
                            <span className="text-xs">
                              {filters.sort.endsWith('desc') ? '↓' : '↑'}
                            </span>
                          )}
                        </button>
                      </TableHead>

                      <TableHead className="w-32 text-right">
                        {tTable('actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {data.items.map((member) => (
                      <TableRow
                        key={member.membershipId}
                        className="hover:bg-surface-lifted/40 transition-colors"
                      >
                        {/* Member Identity */}
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-lifted text-xs font-bold text-foreground shadow-xs overflow-hidden">
                              {member.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={member.avatarUrl}
                                  alt={member.displayName}
                                  className="size-full rounded-full object-cover"
                                />
                              ) : (
                                getInitials(member.displayName) || 'U'
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/users/${member.userId}`}
                                  className="truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
                                >
                                  {member.displayName}
                                </Link>
                                {member.isCurrentUser && (
                                  <Badge variant="secondary" size="xs">
                                    {tTable('currentUser')}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {member.loginEmail && (
                                  <span className="truncate font-mono text-xs text-muted">
                                    {member.loginEmail}
                                  </span>
                                )}
                                {member.contactEmail && (
                                  <span className="truncate text-xs text-muted/80">
                                    ({member.contactEmail})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role */}
                        <TableCell className="py-3.5 whitespace-nowrap">
                          <OrganizationRoleBadge role={member.role} size="sm" />
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3.5 whitespace-nowrap">
                          <UserAccessStatusBadge
                            status={member.membershipStatus}
                            size="sm"
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {member.canEdit && (
                              <Tooltip content={tTable('edit')}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={tTable('edit')}
                                  onClick={() => handleEdit(member)}
                                  className="text-muted hover:text-foreground"
                                >
                                  <svg
                                    aria-hidden="true"
                                    className="size-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                  </svg>
                                </Button>
                              </Tooltip>
                            )}

                            {member.canResetPassword && (
                              <Tooltip content={tTable('resetPassword')}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={tTable('resetPassword')}
                                  onClick={() => setSelectedUserForReset(member)}
                                  className="text-muted hover:text-foreground"
                                >
                                  <svg
                                    aria-hidden="true"
                                    className="size-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="7.5" cy="15.5" r="5.5" />
                                    <path d="m21 2-9.6 9.6" />
                                    <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                                  </svg>
                                </Button>
                              </Tooltip>
                            )}

                            {member.canRemove && (
                              <Tooltip content={tTable('remove')}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={tTable('remove')}
                                  onClick={() => setSelectedUserForRemove(member)}
                                  className="text-muted hover:text-semantic-error hover:bg-semantic-error/10"
                                >
                                  <svg
                                    aria-hidden="true"
                                    className="size-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <line x1="17" y1="11" x2="23" y2="11" />
                                  </svg>
                                </Button>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {data.totalPages > 1 && (
                <div className="pt-2">
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    total={data.total}
                    pageSize={data.limit}
                    onPageChange={(p: number) => updateFilters({ ...filters, page: p })}
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Modals */}
      {selectedUserForReset && (
        <ResetPasswordDialog
          isOpen={Boolean(selectedUserForReset)}
          onOpenChange={(open) => !open && setSelectedUserForReset(null)}
          userId={selectedUserForReset.userId}
          userName={selectedUserForReset.displayName}
        />
      )}

      {selectedUserForRemove && (
        <RemoveMembershipDialog
          isOpen={Boolean(selectedUserForRemove)}
          onOpenChange={(open) => !open && setSelectedUserForRemove(null)}
          userName={selectedUserForRemove.displayName}
          isPending={removeMutation.isPending}
          onConfirm={handleConfirmRemove}
        />
      )}

      {/* Create User Modal */}
      <CreateUserDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
