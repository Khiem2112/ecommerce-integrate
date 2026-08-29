import { cn } from '@/lib/cn';

type VipTierBadgeProps = {
  readonly code: string;
  readonly name: string;
};

const badgeClasses: Record<string, string> = {
  platinum: 'border-foreground bg-foreground text-background',
  gold: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
  silver: 'border-status-info/25 bg-status-info/10 text-status-info',
  standard: 'border-hairline bg-foreground/5 text-muted',
};

const icons: Record<string, string> = {
  platinum: '◆',
  gold: '★',
  silver: '●',
  standard: '○',
};

export function VipTierBadge({ code, name }: VipTierBadgeProps) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold', badgeClasses[code] ?? badgeClasses.standard)}>
      <span aria-hidden="true">{icons[code] ?? icons.standard}</span>
      {name}
    </span>
  );
}
