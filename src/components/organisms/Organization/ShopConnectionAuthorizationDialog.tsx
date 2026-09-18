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
import { ShopConnectionAuthorizationForm } from './ShopConnectionAuthorizationForm';
import type { SupportedShopPlatformCode } from '@/types';

export type ShopConnectionAuthorizationDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose?: () => void;
  readonly defaultPlatform?: SupportedShopPlatformCode;
  readonly fixedOrganizationId?: number;
  readonly fixedOrganizationName?: string;
  readonly reconnectConnectionId?: number;
  readonly onSuccess?: (result: { authorizationUrl: string }) => void;
};

export function ShopConnectionAuthorizationDialog({
  isOpen,
  onOpenChange,
  onClose,
  defaultPlatform = 'lazada',
  fixedOrganizationId,
  fixedOrganizationName,
  reconnectConnectionId,
  onSuccess,
}: ShopConnectionAuthorizationDialogProps): JSX.Element {
  const t = useTranslations('shops.connectDialog');

  const handleOpenChange = (open: boolean) => {
    onOpenChange?.(open);
    if (!open) {
      onClose?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-4">
          <DialogTitle>
            {reconnectConnectionId ? t('reconnectTitle') : t('title')}
          </DialogTitle>
          <DialogDescription>
            {reconnectConnectionId ? t('reconnectDescription') : t('description')}
          </DialogDescription>
        </DialogHeader>

        <ShopConnectionAuthorizationForm
          embedded
          defaultPlatform={defaultPlatform}
          fixedOrganizationId={fixedOrganizationId}
          fixedOrganizationName={fixedOrganizationName}
          reconnectConnectionId={reconnectConnectionId}
          onSuccess={(result) => {
            onSuccess?.(result);
            handleOpenChange(false);
          }}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
