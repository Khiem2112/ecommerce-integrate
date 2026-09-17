'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms';
import { PasswordChangeForm } from './PasswordChangeForm';

export type PasswordChangeModalProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function PasswordChangeModal({
  open,
  onOpenChange,
}: PasswordChangeModalProps) {
  const t = useTranslations('settings');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="mb-4 text-left">
          <DialogTitle>{t('securityModalTitle')}</DialogTitle>
          <DialogDescription className="mt-1">
            {t('securityModalDescription')}
          </DialogDescription>
        </DialogHeader>

        <PasswordChangeForm
          mode="voluntary"
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
