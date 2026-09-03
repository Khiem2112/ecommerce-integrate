'use client';

import { Badge, type BadgeVariant } from '@/components/atoms';

type VipTierBadgeProps = {
  readonly code: string;
  readonly name: string;
  readonly className?: string;
};

const VIP_VARIANTS: Record<string, BadgeVariant> = {
  platinum: 'purple',
  gold: 'amber',
  silver: 'info',
  standard: 'secondary',
};

export function VipTierBadge({ code, name, className }: VipTierBadgeProps) {
  const normalizedCode = code.toLowerCase();
  const variant = VIP_VARIANTS[normalizedCode] ?? 'secondary';

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
    >
      {name}
    </Badge>
  );
}
