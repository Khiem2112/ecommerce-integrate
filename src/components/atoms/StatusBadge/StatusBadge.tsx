'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, type BadgeSize } from '@/components/atoms/Badge/Badge';
import { getStatusBadgeVariant } from '@/utils';
import { cn } from '@/lib/cn';

export type StatusBadgeType =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | string;

export type StatusBadgeProps = {
  readonly status?: StatusBadgeType;
  readonly label?: ReactNode;
  readonly size?: BadgeSize;
  readonly className?: string;
};

export function StatusBadge({
  status,
  label,
  size = 'xs',
  className,
}: StatusBadgeProps) {
  const t = useTranslations('common.status');
  if (!status) return null;

  switch (status) {
    case 'queued':
      return (
        <Badge variant="secondary" size={size} className={className}>
          {label ?? t('queued')}
        </Badge>
      );
    case 'running':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-600 dark:text-teal-400',
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
          {label ?? t('running')}
        </span>
      );
    case 'completed':
      return (
        <Badge variant="success" size={size} className={className}>
          {label ?? t('completed')}
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="warning" size={size} className={className}>
          {label ?? t('partial')}
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="error" size={size} className={className}>
          {label ?? t('failed')}
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary" size={size} className={className}>
          {label ?? t('cancelled')}
        </Badge>
      );
    default: {
      const orderStatus = getStatusBadgeVariant(status);
      let localizedLabel: ReactNode = orderStatus.label;
      if (status === 'delivered') localizedLabel = t('delivered');
      else if (status === 'shipped') localizedLabel = t('shipped');
      else if (status === 'paid') localizedLabel = t('paid');
      else if (status === 'unpaid') localizedLabel = t('unpaid');
      else if (status === 'cancelled') localizedLabel = t('cancelled');
      else if (status === 'returned' || status === 'refunded') localizedLabel = t('refunded');

      return (
        <Badge variant={orderStatus.variant} size={size} className={className}>
          {label ?? localizedLabel}
        </Badge>
      );
    }
  }
}
