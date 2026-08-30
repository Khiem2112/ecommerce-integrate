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

const VIP_ICONS: Record<string, string> = {
  platinum: '◆',
  gold: '★',
  silver: '●',
  standard: '○',
};

export function VipTierBadge({ code, name, className }: VipTierBadgeProps) {
  const normalizedCode = code.toLowerCase();
  const variant = VIP_VARIANTS[normalizedCode] ?? 'secondary';
  const icon = VIP_ICONS[normalizedCode] ?? '○';

  return (
    <Badge
      variant={variant}
      size="sm"
      className={className}
    >
      <span aria-hidden="true" className="mr-0.5 font-bold">{icon}</span>
      {name}
    </Badge>
  );
}
