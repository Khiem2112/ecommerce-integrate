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
import { useToast } from '@/hooks';
import { ShopConnectionLabelForm } from './ShopConnectionLabelForm';
import type { ShopConnectionDetail, ShopConnectionSummary } from '@/types';

export type ShopConnectionLabelDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose?: () => void;
  readonly connection: ShopConnectionSummary | ShopConnectionDetail;
  readonly onSuccess?: () => void;
};

export function ShopConnectionLabelDialog({
  isOpen,
  onOpenChange,
  onClose,
  connection,
  onSuccess,
}: ShopConnectionLabelDialogProps): JSX.Element {
  const t = useTranslations('shops.labelDialog');
  const { toast } = useToast();

  const handleOpenChange = (open: boolean) => {
    onOpenChange?.(open);
    if (!open) {
      onClose?.();
    }
  };

  const handleSuccess = () => {
    toast.success(t('success'));
    onSuccess?.();
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <ShopConnectionLabelForm
          embedded
          connection={connection}
          onSuccess={handleSuccess}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
