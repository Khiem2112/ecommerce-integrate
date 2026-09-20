'use client';

import { type JSX } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Tooltip, type BadgeSize, type BadgeVariant } from '@/components/atoms';
import type { ShopConnectionHealthStatusCode } from '@/types';

export type ShopConnectionStatusBadgeProps = {
  readonly status: ShopConnectionHealthStatusCode | string;
  readonly expiresAt?: string | null;
  readonly size?: BadgeSize;
  readonly className?: string;
  readonly useDot?: boolean;
  readonly onRemove?: () => void;
  readonly removePlacement?: 'top-right' | 'inline';
  readonly removeAriaLabel?: string;
};

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  connected: 'success',
  reconnect_required: 'destructive',
  expiring_soon: 'warning',
  disconnecting: 'secondary',
  reassigning: 'warning',
  disconnected: 'destructive',
};

const STATUS_DOT_COLOR_MAP: Record<string, string> = {
  connected: 'bg-status-success',
  reconnect_required: 'bg-semantic-error',
  expiring_soon: 'bg-status-warning',
  disconnecting: 'bg-muted animate-pulse',
  reassigning: 'bg-status-warning animate-pulse',
  disconnected: 'bg-semantic-error',
};

const VALID_STATUSES: readonly ShopConnectionHealthStatusCode[] = [
  'connected',
  'expiring_soon',
  'reconnect_required',
  'disconnecting',
  'reassigning',
  'disconnected',
];

function isKnownStatus(value: string): value is ShopConnectionHealthStatusCode {
  return VALID_STATUSES.includes(value as ShopConnectionHealthStatusCode);
}

export function ShopConnectionStatusBadge({
  status,
  expiresAt,
  size = 'xs',
  className,
  useDot = true,
  onRemove,
  removePlacement = 'top-right',
  removeAriaLabel,
}: ShopConnectionStatusBadgeProps): JSX.Element {
  const t = useTranslations('shops.statuses');
  const locale = useLocale();
  const variant = STATUS_VARIANT_MAP[status] ?? 'secondary';
  const dotClassName = STATUS_DOT_COLOR_MAP[status];

  const label = isKnownStatus(status) ? t(status) : status;
  const badge = (
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

  if (status !== 'expiring_soon' || !expiresAt) {
    return badge;
  }

  return (
    <Tooltip content={t('expiringSoonTooltip', { expiresAt: new Intl.DateTimeFormat(locale).format(new Date(expiresAt)) })}>
      {badge}
    </Tooltip>
  );
}
