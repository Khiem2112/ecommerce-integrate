'use client';

import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/atoms';
import { OrganizationForm } from './OrganizationForm';
import type { OrganizationDetail } from '@/types';

export type OrganizationDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose?: () => void;
  readonly organization?: OrganizationDetail;
  readonly onSuccess?: (organization: { id: number }) => void;
};

export function OrganizationDialog({
  isOpen,
  onOpenChange,
  onClose,
  organization,
  onSuccess,
}: OrganizationDialogProps): JSX.Element {
  const t = useTranslations('organizations');
  const isEditing = Boolean(organization);

  const handleOpenChange = (open: boolean) => {
    onOpenChange?.(open);
    if (!open) {
      onClose?.();
    }
  };

  const handleSuccess = (savedOrg: { id: number }) => {
    onSuccess?.(savedOrg);
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>{isEditing ? t('edit') : t('new')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <OrganizationForm
          key={organization ? `edit-${organization.id}-${isOpen}` : `new-${isOpen}`}
          embedded
          organization={organization}
          onSuccess={handleSuccess}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
