'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Combobox, type ComboboxItem } from '@/components/atoms';
import { cn } from '@/lib/cn';
import { OrganizationRoleBadge } from './OrganizationRoleBadge';
import type { OrganizationMember, OrganizationRoleCode } from '@/types';

export type OrganizationMemberRowProps = {
  readonly member: OrganizationMember;
  readonly canManage: boolean;
  readonly isPending?: boolean;
  readonly variant?: 'row' | 'card';
  readonly className?: string;
  readonly onRoleChange?: (role: OrganizationRoleCode) => void;
  readonly onRemove?: () => void;
};

const MANAGEABLE_ROLES: readonly OrganizationRoleCode[] = [
  'admin',
  'operations_manager',
  'integration_operator',
  'data_steward',
  'viewer',
];

export function OrganizationMemberRow({
  member,
  canManage,
  isPending = false,
  variant = 'row',
  className,
  onRoleChange,
  onRemove,
}: OrganizationMemberRowProps) {
  const t = useTranslations('organizations');

  const roleOptions: readonly ComboboxItem[] = useMemo(
    () =>
      MANAGEABLE_ROLES.map((role) => ({
        value: role,
        label: t(`roles.${role}`),
      })),
    [t],
  );

  const initials = member.displayName
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        variant === 'card'
          ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-card/60 p-6 transition-colors hover:bg-surface-card'
          : 'flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-lifted/50',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        {/* Member Avatar / Initial */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-lifted text-xs font-bold text-foreground shadow-xs">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={member.displayName}
              className="size-full rounded-full object-cover"
            />
          ) : (
            initials || 'U'
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {member.displayName}
            </p>
            {member.isCurrentUser && (
              <Badge variant="secondary" size="xs">
                {t('membersTab.currentUser')}
              </Badge>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canManage && member.role !== 'owner' ? (
          <div className="w-40">
            <Combobox
              items={roleOptions}
              value={member.role}
              onChange={(value) => onRoleChange?.(value as OrganizationRoleCode)}
              size="sm"
              searchable={false}
              disabled={isPending}
              ariaLabel={t('membersTab.selectRole')}
            />
          </div>
        ) : (
          <OrganizationRoleBadge role={member.role} size="sm" />
        )}

        {canManage && member.role !== 'owner' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={onRemove}
            className="text-xs text-muted hover:text-semantic-error"
          >
            {t('membersTab.remove')}
          </Button>
        )}
      </div>
    </div>
  );
}
