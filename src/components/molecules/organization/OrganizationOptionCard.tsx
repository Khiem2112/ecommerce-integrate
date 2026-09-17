'use client';

import { OrganizationRoleBadge } from './OrganizationRoleBadge';
import { cn } from '@/lib/cn';
import type { OrganizationSummary } from '@/types';

export type OrganizationOptionCardProps = {
  readonly organization: OrganizationSummary;
  readonly isSelected?: boolean;
  readonly onSelect: (id: number) => void;
  readonly disabled?: boolean;
};

export function OrganizationOptionCard({
  organization,
  isSelected = false,
  onSelect,
  disabled = false,
}: OrganizationOptionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(organization.id)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isSelected
          ? 'border-primary/70 bg-primary/5 shadow-xs ring-1 ring-primary/20'
          : 'border-hairline bg-surface-card hover:border-hairline-strong hover:bg-surface-lifted/60',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-lifted text-sm font-semibold text-foreground">
          {organization.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {organization.displayName}
          </p>
          <p className="font-mono text-[11px] text-muted">
            {organization.slug}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        <OrganizationRoleBadge role={organization.role} />
      </div>
    </button>
  );
}
