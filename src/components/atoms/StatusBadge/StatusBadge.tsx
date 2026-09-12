'use client';

import { type ReactNode } from 'react';
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
  if (!status) return null;

  switch (status) {
    case 'queued':
      return (
        <Badge variant="secondary" size={size} className={className}>
          {label ?? 'Đang chờ'}
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
          {label ?? 'Đang chạy'}
        </span>
      );
    case 'completed':
      return (
        <Badge variant="success" size={size} className={className}>
          {label ?? 'Hoàn tất'}
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="warning" size={size} className={className}>
          {label ?? 'Hoàn tất một phần'}
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="error" size={size} className={className}>
          {label ?? 'Thất bại'}
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary" size={size} className={className}>
          {label ?? 'Đã hủy'}
        </Badge>
      );
    default: {
      const orderStatus = getStatusBadgeVariant(status);
      return (
        <Badge variant={orderStatus.variant} size={size} className={className}>
          {label ?? orderStatus.label}
        </Badge>
      );
    }
  }
}
