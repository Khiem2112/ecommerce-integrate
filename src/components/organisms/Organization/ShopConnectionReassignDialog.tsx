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
import { ShopConnectionReassignForm } from './ShopConnectionReassignForm';
import type { ShopConnectionDetail, ShopConnectionSummary } from '@/types';

export type ShopConnectionReassignDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose?: () => void;
  readonly connection: ShopConnectionSummary | ShopConnectionDetail;
  readonly onSuccess?: () => void;
};

export function ShopConnectionReassignDialog({
  isOpen,
  onOpenChange,
  onClose,
  connection,
  onSuccess,
}: ShopConnectionReassignDialogProps): JSX.Element {
  const t = useTranslations('shops.reassignDialog');

  const handleOpenChange = (open: boolean) => {
    onOpenChange?.(open);
    if (!open) {
      onClose?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { name: connection.displayLabel ?? connection.shopName ?? connection.platformName })}
          </DialogDescription>
        </DialogHeader>

        <ShopConnectionReassignForm
          embedded
          connection={connection}
          onSuccess={() => {
            onSuccess?.();
            handleOpenChange(false);
          }}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
