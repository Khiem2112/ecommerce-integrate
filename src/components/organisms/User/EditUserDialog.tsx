'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms';
import type { UserAccessDetail } from '@/types';
import { UserAccessForm } from './UserAccessForm';

export type EditUserDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly detail: UserAccessDetail;
  readonly onSuccess?: () => void;
};

export function EditUserDialog({
  isOpen,
  onOpenChange,
  detail,
  onSuccess,
}: EditUserDialogProps) {
  const tForm = useTranslations('users.form');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>{tForm('editTitle')}</DialogTitle>
          <DialogDescription>{tForm('editDescription')}</DialogDescription>
        </DialogHeader>

        <UserAccessForm
          mode="edit"
          embedded
          initialDetail={detail}
          activeOrgName={detail.organizationDisplayName}
          allowedRoles={detail.capabilities.allowedRolesToAssign}
          onSuccess={() => {
            onOpenChange(false);
            onSuccess?.();
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
