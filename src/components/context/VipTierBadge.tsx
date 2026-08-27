import { cn } from '@/lib/cn';

type VipTierBadgeProps = {
  readonly code: string;
  readonly name: string;
};

const badgeClasses: Record<string, string> = {
  platinum: 'border-violet-400/35 bg-violet-500/15 text-violet-200',
  gold: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
  silver: 'border-slate-400/35 bg-slate-400/15 text-slate-200',
  standard: 'border-slate-600 bg-slate-800 text-slate-300',
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
