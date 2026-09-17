'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeSize } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { UserAccessStatusCode } from '@/types';

export type UserAccessStatusBadgeProps = {
  readonly status: UserAccessStatusCode;
  readonly size?: BadgeSize;
  readonly className?: string;
};

export function UserAccessStatusBadge({
  status,
  size = 'xs',
  className,
}: UserAccessStatusBadgeProps) {
  const t = useTranslations('users.statuses');

  const isRemoved = status === 'removed';
  const label = isRemoved ? t('removed') : t('active');

  return (
    <Badge
      variant={isRemoved ? 'secondary' : 'success'}
      size={size}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        isRemoved
          ? 'border-hairline bg-surface-lifted text-muted'
          : 'border-semantic-success/20 bg-semantic-success/10 text-semantic-success',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          isRemoved ? 'bg-muted' : 'bg-semantic-success',
        )}
      />
      {label}
    </Badge>
  );
}
