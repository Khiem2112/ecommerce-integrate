'use client';

import { OrganizationRoleBadge } from '@/components/molecules';
import { cn } from '@/lib/cn';
import type { UserSessionProjection } from '@/types';

export type UserIdentityBadgeProps = {
  readonly user: UserSessionProjection;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly showRole?: boolean;
  readonly className?: string;
};

export function UserIdentityBadge({
  user,
  size = 'md',
  showRole = false,
  className,
}: UserIdentityBadgeProps) {
  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

  const sizeClasses = {
    sm: {
      avatar: 'size-7 text-xs',
      name: 'text-xs',
      email: 'text-[10px]',
    },
    md: {
      avatar: 'size-9 text-sm',
      name: 'text-sm font-medium',
      email: 'text-xs',
    },
    lg: {
      avatar: 'size-12 text-base',
      name: 'text-base font-semibold',
      email: 'text-xs',
    },
  }[size];

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-lifted font-semibold text-foreground select-none',
          sizeClasses.avatar,
        )}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className={cn('truncate text-foreground leading-tight', sizeClasses.name)}>
            {user.displayName}
          </p>
          {showRole && user.role && (
            <OrganizationRoleBadge role={user.role} />
          )}
        </div>
        <p className={cn('truncate text-muted leading-tight mt-0.5', sizeClasses.email)}>
          {user.email}
        </p>
      </div>
    </div>
  );
}
