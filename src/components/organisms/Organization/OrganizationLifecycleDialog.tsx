'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/atoms';
import type { OrganizationDetail, OrganizationStatusCode } from '@/types';

export type OrganizationLifecycleDialogProps = {
  readonly organization: OrganizationDetail;
  readonly targetStatus: OrganizationStatusCode | null;
  readonly isOpen: boolean;
  readonly isPending?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (
    targetStatus: 'active' | 'suspended' | 'archived',
    confirmation?: string,
  ) => Promise<void>;
};

export function OrganizationLifecycleDialog({
  organization,
  targetStatus,
  isOpen,
  isPending = false,
  onClose,
  onConfirm,
}: OrganizationLifecycleDialogProps) {
  const t = useTranslations('organizations');
  const [confirmationInput, setConfirmationInput] = useState('');

  if (!targetStatus) return null;

  const isArchive = targetStatus === 'archived';
  const isSuspend = targetStatus === 'suspended';
  const isRestore = targetStatus === 'active';

  const canConfirm = !isArchive || confirmationInput.trim() === organization.displayName.trim();

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm(
      targetStatus as 'active' | 'suspended' | 'archived',
      isArchive ? confirmationInput : undefined,
    );
    setConfirmationInput('');
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmationInput('');
      onClose();
    }
  };

  const dialogTitle = isArchive
    ? t('lifecycle.archive')
    : isSuspend
      ? t('lifecycle.suspend')
      : t('lifecycle.restore');

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {dialogTitle}: {organization.displayName}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted">
            {isArchive && t('lifecycle.archiveDescription')}
            {isSuspend && t('lifecycle.suspend')}
            {isRestore && t('lifecycle.restore')}
          </DialogDescription>
        </DialogHeader>

        {isArchive && (
          <div className="my-4 space-y-2">
            <label
              htmlFor="archive-confirmation-input"
              className="block text-xs font-medium text-foreground"
            >
              {t('lifecycle.confirmation')} (
              <span className="font-semibold text-foreground">
                {organization.displayName}
              </span>
              ):
            </label>
            <Input
              id="archive-confirmation-input"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={organization.displayName}
              aria-label={t('lifecycle.confirmation')}
              disabled={isPending}
              className="w-full"
            />
          </div>
        )}

        <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isPending}
            onClick={onClose}
          >
            {t('lifecycle.cancel')}
          </Button>
          <Button
            type="button"
            variant={isArchive ? 'destructive' : isSuspend ? 'secondary' : 'primary'}
            size="md"
            isLoading={isPending}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {t('lifecycle.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
