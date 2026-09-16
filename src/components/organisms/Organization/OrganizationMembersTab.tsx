'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Combobox, type ComboboxItem } from '@/components/atoms';
import { ErrorBanner, OrganizationMemberRow } from '@/components/molecules';
import { useMockUsers, useMutateOrganizationMember } from '@/hooks';
import type { OrganizationDetail, OrganizationRoleCode } from '@/types';

export type OrganizationMembersTabProps = {
  readonly organization: OrganizationDetail;
};

const MANAGEABLE_ROLES: readonly OrganizationRoleCode[] = [
  'admin',
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
];

export function OrganizationMembersTab({
  organization,
}: OrganizationMembersTabProps) {
  const t = useTranslations('organizations');
  const { data: users, isLoading: isUsersLoading } = useMockUsers();
  const mutation = useMutateOrganizationMember();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<OrganizationRoleCode>('viewer');

  // Filter users not already in this organization
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
    <section className="rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t('membersTab.title')}
        </h2>
        <span className="inline-flex items-center rounded-full border border-hairline bg-surface-lifted px-2.5 py-0.5 font-mono text-xs font-medium text-muted">
          {organization.members.length}
        </span>
      </div>

      {mutation.error && (
        <div className="border-b border-hairline px-5 py-3 bg-semantic-error/5">
          <ErrorBanner message={t('membersTab.mutationFailed')} />
        </div>
      )}

      {/* Add member toolbar for managers */}
      {organization.canManage && (
        <div className="border-b border-hairline bg-surface-lifted/30 px-5 py-3.5">
          <div className="grid gap-3 sm:grid-cols-[1fr_13rem_auto]">
            <div className="min-w-0">
              <Combobox
                items={userComboboxItems}
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder={t('membersTab.selectUser')}
                disabled={isUsersLoading || mutation.isPending}
                searchable
                searchPlaceholder={t('search')}
                ariaLabel={t('membersTab.selectUser')}
                size="md"
              />
            </div>

            <div className="min-w-0">
              <Combobox
                items={roleComboboxItems}
                value={selectedRole}
                onChange={(value) => setSelectedRole(value as OrganizationRoleCode)}
                disabled={mutation.isPending}
                searchable={false}
                ariaLabel={t('membersTab.selectRole')}
                size="md"
              />
            </div>

            <Button
              type="button"
              size="md"
              disabled={!selectedUserId}
              isLoading={mutation.isPending}
              onClick={handleAddMember}
            >
              {t('membersTab.addAction')}
            </Button>
          </div>
        </div>
      )}

      {/* Member list */}
      {organization.members.length > 0 ? (
        <div className="divide-y divide-hairline">
          {organization.members.map((member) => (
            <OrganizationMemberRow
              key={member.id}
              member={member}
              canManage={organization.canManage}
              isPending={mutation.isPending}
              variant="row"
              onRoleChange={(newRole) => handleRoleChange(member.userId, newRole)}
              onRemove={() => handleRemoveMember(member.userId)}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 px-6 text-center">
          <p className="text-sm text-muted">
            {t('membersTab.empty')}
          </p>
        </div>
      )}
    </section>
  );
}
