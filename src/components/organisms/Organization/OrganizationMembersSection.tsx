'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Combobox, type ComboboxItem } from '@/components/atoms';
import { ErrorBanner, OrganizationMemberRow } from '@/components/molecules';
import { useMockUsers, useMutateOrganizationMember } from '@/hooks';
import { cn } from '@/lib/cn';
import type { OrganizationDetail, OrganizationRoleCode } from '@/types';

export type OrganizationMembersSectionProps = {
  readonly organization: OrganizationDetail;
};

const MANAGEABLE_ROLES: readonly OrganizationRoleCode[] = [
  'admin',
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
];

export function OrganizationMembersSection({
  organization,
}: OrganizationMembersSectionProps) {
  const t = useTranslations('organizations');
  const { data: users, isLoading: isUsersLoading } = useMockUsers();
  const mutation = useMutateOrganizationMember();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<OrganizationRoleCode>('viewer');

  // Filter users who are not already members of this organization
  const availableUsers = useMemo(
    () =>
      users?.filter(
        (user) => !organization.members.some((m) => m.userId === user.id),
      ) ?? [],
    [users, organization.members],
  );

  const userComboboxItems: readonly ComboboxItem[] = useMemo(
    () =>
      availableUsers.map((user) => ({
        value: String(user.id),
        label: user.displayName,
        subLabel: user.email,
      })),
    [availableUsers],
  );

  const roleComboboxItems: readonly ComboboxItem[] = useMemo(
    () =>
      MANAGEABLE_ROLES.map((role) => ({
        value: role,
        label: t(`roles.${role}`),
      })),
    [t],
  );

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await mutation.mutateAsync({
        organizationId: organization.id,
        userId: Number(selectedUserId),
        operation: 'add',
        role: selectedRole,
      });
      setSelectedUserId('');
      setSelectedRole('viewer');
    } catch {
      // Error handled by mutation state
    }
  };

  const handleRoleChange = (userId: number, newRole: OrganizationRoleCode) => {
    mutation.mutate({
      organizationId: organization.id,
      userId,
      operation: 'change_role',
      role: newRole,
    });
  };

  const handleRemoveMember = (userId: number) => {
    mutation.mutate({
      organizationId: organization.id,
      userId,
      operation: 'remove',
    });
  };

  return (
    <section className="space-y-4">
      {/* Mutation Error Notification */}
      {mutation.error && (
        <ErrorBanner message={t('membersTab.mutationFailed')} />
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-6 lg:gap-8 lg:items-start',
          organization.canManage ? 'lg:grid-cols-12' : '',
        )}
      >
        {/* Left Column: Add Member Form (Combobox Người dùng + Combobox Trạng thái + Nút Thêm) */}
        {organization.canManage && (
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-card">
              <div className="border-b border-hairline pb-4">
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" x2="19" y1="8" y2="14" />
                    <line x1="22" x2="16" y1="11" y2="11" />
                  </svg>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('membersTab.add')}
                  </h3>
                </div>
                <p className="mt-1.5 text-xs text-muted leading-relaxed">
                  {t('membersTab.addDescription')}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {/* Combobox người dùng with label */}
                <div>
                  <Combobox
                    items={userComboboxItems}
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    label={t('membersTab.userLabel')}
                    placeholder={t('membersTab.selectUser')}
                    disabled={isUsersLoading || mutation.isPending}
                    searchable
                    searchPlaceholder={t('search')}
                    ariaLabel={t('membersTab.userLabel')}
                    size="md"
                  />
                </div>

                {/* Combobox trạng thái / vai trò with label */}
                <div>
                  <Combobox
                    items={roleComboboxItems}
                    value={selectedRole}
                    onChange={(value) => setSelectedRole(value as OrganizationRoleCode)}
                    label={t('membersTab.roleLabel')}
                    disabled={mutation.isPending}
                    searchable={false}
                    ariaLabel={t('membersTab.roleLabel')}
                    size="md"
                  />
                </div>

                {/* Nút thêm with increased spacing */}
                <div className="pt-2">
                  <Button
                    type="button"
                    size="md"
                    className="w-full justify-center gap-2 shadow-xs"
                    disabled={!selectedUserId || mutation.isPending}
                    isLoading={mutation.isPending}
                    onClick={handleAddMember}
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
                      <line x1="12" x2="12" y1="5" y2="19" />
                      <line x1="5" x2="19" y1="12" y2="12" />
                    </svg>
                    <span>{t('membersTab.addAction')}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Danh sách các người dùng đang được thêm */}
        <div
          className={cn(
            organization.canManage ? 'lg:col-span-7 xl:col-span-8' : 'w-full',
          )}
        >
          <div className="rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <div className="flex items-center gap-2.5">
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
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <h3 className="text-sm font-semibold text-foreground sm:text-base">
                  {t('membersSectionTitle')}
                </h3>
                <span className="inline-flex items-center rounded-full border border-hairline bg-surface-lifted px-2.5 py-0.5 font-mono text-xs font-semibold text-muted">
                  {organization.members.length}
                </span>
              </div>
            </div>

            {/* Member list with increased line height and row spacing */}
            {organization.members.length > 0 ? (
              <div className="divide-y divide-hairline">
                {organization.members.map((member) => (
                  <OrganizationMemberRow
                    key={member.id}
                    member={member}
                    canManage={organization.canManage}
                    isPending={mutation.isPending}
                    variant="row"
                    onRoleChange={(newRole) =>
                      handleRoleChange(member.userId, newRole)
                    }
                    onRemove={() => handleRemoveMember(member.userId)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-16 px-6 text-center">
                <p className="text-sm text-muted">
                  {t('membersTab.empty')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
