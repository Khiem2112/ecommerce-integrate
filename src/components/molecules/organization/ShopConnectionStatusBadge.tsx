'use client';

import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, type BadgeSize, type BadgeVariant } from '@/components/atoms';
import type { PlatformConnectionStatusCode } from '@/types';

export type ShopConnectionStatusBadgeProps = {
  readonly status: PlatformConnectionStatusCode | string;
  readonly size?: BadgeSize;
  readonly className?: string;
  readonly useDot?: boolean;
  readonly onRemove?: () => void;
  readonly removePlacement?: 'top-right' | 'inline';
  readonly removeAriaLabel?: string;
};

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  connected: 'success',
  reconnect_required: 'warning',
  disconnecting: 'secondary',
  reassigning: 'warning',
  disconnected: 'destructive',
};

const STATUS_DOT_COLOR_MAP: Record<string, string> = {
  connected: 'bg-status-success',
  reconnect_required: 'bg-status-warning',
  disconnecting: 'bg-muted animate-pulse',
  reassigning: 'bg-status-warning animate-pulse',
  disconnected: 'bg-semantic-error',
};

const VALID_STATUSES: readonly PlatformConnectionStatusCode[] = [
  'connected',
  'reconnect_required',
  'disconnecting',
  'reassigning',
  'disconnected',
];

function isKnownStatus(value: string): value is PlatformConnectionStatusCode {
  return VALID_STATUSES.includes(value as PlatformConnectionStatusCode);
}

export function ShopConnectionStatusBadge({
  status,
  size = 'xs',
  className,
  useDot = true,
  onRemove,
  removePlacement = 'top-right',
  removeAriaLabel,
}: ShopConnectionStatusBadgeProps): JSX.Element {
  const t = useTranslations('shops.statuses');
  const variant = STATUS_VARIANT_MAP[status] ?? 'secondary';
  const dotClassName = STATUS_DOT_COLOR_MAP[status];

  const label = isKnownStatus(status) ? t(status) : status;

  return (
    <Badge
      variant={variant}
      size={size}
      useDot={useDot}
      dotClassName={dotClassName}
      onRemove={onRemove}
      removePlacement={removePlacement}
      removeAriaLabel={removeAriaLabel}
      className={className}
    >
      {label}
    </Badge>
  );
}
