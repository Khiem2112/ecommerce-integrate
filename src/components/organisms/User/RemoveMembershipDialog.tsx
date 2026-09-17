'use client';

import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms';

export type RemoveMembershipDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly userName: string;
  readonly orgName?: string;
  readonly isPending?: boolean;
  readonly onConfirm: () => void;
};

export function RemoveMembershipDialog({
  isOpen,
  onOpenChange,
  userName,
  orgName,
  isPending = false,
  onConfirm,
}: RemoveMembershipDialogProps) {
  const t = useTranslations('users.removeModal');
  const tUsers = useTranslations('users');
  const effectiveOrgName = orgName ?? tUsers('thisOrg');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex size-11 items-center justify-center rounded-xl bg-semantic-error/10 text-semantic-error mb-2">
            <svg
              aria-hidden="true"
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
          </div>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-muted">
            {t('description', { name: userName, org: effectiveOrgName })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            autoFocus
          >
            {t('cancelButton')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? t('removing') : t('confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
