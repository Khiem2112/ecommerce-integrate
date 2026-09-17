'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms';
import { UserAccessForm } from './UserAccessForm';

export type CreateUserDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly activeOrgName?: string;
  readonly onSuccess?: () => void;
};

export function CreateUserDialog({
  isOpen,
  onOpenChange,
  activeOrgName,
  onSuccess,
}: CreateUserDialogProps) {
  const tForm = useTranslations('users.form');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>{tForm('newTitle')}</DialogTitle>
          <DialogDescription>{tForm('newDescription')}</DialogDescription>
        </DialogHeader>

        <UserAccessForm
          mode="create"
          embedded
          activeOrgName={activeOrgName}
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
