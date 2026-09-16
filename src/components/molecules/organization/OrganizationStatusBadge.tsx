'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeSize, type BadgeVariant } from '@/components/atoms';
import type { OrganizationStatusCode } from '@/types';

export type OrganizationStatusBadgeProps = {
  readonly status: OrganizationStatusCode | string;
  readonly size?: BadgeSize;
  readonly className?: string;
  readonly useDot?: boolean;
};

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  active: 'success',
  suspended: 'warning',
  archived: 'secondary',
  pending_deletion: 'error',
  deleted: 'destructive',
};

const STATUS_DOT_COLOR_MAP: Record<string, string> = {
  active: 'bg-status-success',
  suspended: 'bg-status-warning',
  archived: 'bg-muted',
  pending_deletion: 'bg-semantic-error',
  deleted: 'bg-semantic-error',
};

export function OrganizationStatusBadge({
  status,
  size = 'xs',
  className,
  useDot = true,
}: OrganizationStatusBadgeProps) {
  const t = useTranslations('organizations.statuses');
  const variant = STATUS_VARIANT_MAP[status] ?? 'secondary';
  const dotClassName = STATUS_DOT_COLOR_MAP[status];

  // Try to localize the status label if key exists, otherwise fallback to raw status
  const label = t(status as 'active' | 'suspended' | 'archived');

  return (
    <Badge
      variant={variant}
      size={size}
      useDot={useDot}
      dotClassName={dotClassName}
      className={className}
    >
      {label}
    </Badge>
  );
}
