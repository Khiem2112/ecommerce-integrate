'use client';

import { useTranslations } from 'next-intl';
import { Badge, Button } from '@/components/atoms';
import { OrganizationRoleBadge } from '@/components/molecules/organization/OrganizationRoleBadge';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type { UserAccessSummary } from '@/types';
import { UserAccessStatusBadge } from './UserAccessStatusBadge';

export type UserAccessRowProps = {
  readonly member: UserAccessSummary;
  readonly variant?: 'row' | 'card';
  readonly onEdit?: (member: UserAccessSummary) => void;
  readonly onResetPassword?: (member: UserAccessSummary) => void;
  readonly onRemove?: (member: UserAccessSummary) => void;
  readonly className?: string;
};

export function UserAccessRow({
  member,
  variant = 'row',
  onEdit,
  onResetPassword,
  onRemove,
  className,
}: UserAccessRowProps) {
  const t = useTranslations('users');
  const tTable = useTranslations('users.table');

  const initials = member.displayName
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isCard = variant === 'card';

  return (
    <div
      className={cn(
        isCard
          ? 'flex flex-col gap-4 rounded-xl border border-hairline bg-surface-card/60 p-4 transition-colors hover:bg-surface-card'
          : 'flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-lifted/40',
        className,
      )}
    >
      {/* Identity block */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-lifted text-xs font-bold text-foreground shadow-xs">
          {member.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatarUrl}
              alt={member.displayName}
              className="size-full rounded-full object-cover"
            />
          ) : (
            initials || 'U'
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${member.userId}`}
              className="truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
            >
              {member.displayName}
            </Link>
            {member.isCurrentUser && (
              <Badge variant="secondary" size="xs">
                {tTable('currentUser')}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {member.loginEmail && (
              <span className="truncate font-mono text-xs text-muted">
                {member.loginEmail}
              </span>
            )}
            {member.contactEmail && (
              <span className="truncate text-xs text-muted/80">
                ({member.contactEmail})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Role, Status & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <OrganizationRoleBadge role={member.role} size="sm" />
        <UserAccessStatusBadge status={member.membershipStatus} size="sm" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {member.canEdit && onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(member)}
              className="text-xs"
            >
              {tTable('edit')}
            </Button>
          )}

          {member.canResetPassword && onResetPassword && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(member)}
              className="text-xs text-muted hover:text-foreground"
            >
              {tTable('resetPassword')}
            </Button>
          )}

          {member.canRemove && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(member)}
              className="text-xs text-muted hover:text-semantic-error"
            >
              {tTable('remove')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
