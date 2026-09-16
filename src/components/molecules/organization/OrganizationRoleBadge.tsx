'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeSize, type BadgeVariant } from '@/components/atoms';
import type { OrganizationRoleCode } from '@/types';

export type OrganizationRoleBadgeProps = {
  readonly role: OrganizationRoleCode | string;
  readonly size?: BadgeSize;
  readonly className?: string;
};

const ROLE_VARIANT_MAP: Record<string, BadgeVariant> = {
  owner: 'purple',
  admin: 'teal',
  operations_manager: 'cyan',
  integration_operator: 'outline',
  data_steward: 'outline',
  viewer: 'secondary',
};

export function OrganizationRoleBadge({
  role,
  size = 'xs',
  className,
}: OrganizationRoleBadgeProps) {
  const t = useTranslations('organizations.roles');
  const variant = ROLE_VARIANT_MAP[role] ?? 'secondary';
  const label = t(
    role as
      | 'owner'
      | 'admin'
      | 'operations_manager'
      | 'integration_operator'
      | 'data_steward'
      | 'viewer',
  );

  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  );
}
