'use client';

import { useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/atoms';
import { ShopConnectionAuthorizationForm } from './ShopConnectionAuthorizationForm';
import { ShopConnectionStepperIndicator } from './ShopConnectionStepperIndicator';
import type {
  ShopConnectionAuthState,
  ShopConnectionStepperStep,
  SupportedShopPlatformCode,
} from '@/types';

export type ShopConnectionAuthorizationDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose?: () => void;
  readonly defaultPlatform?: SupportedShopPlatformCode;
  readonly fixedOrganizationId?: number;
  readonly fixedOrganizationName?: string;
  readonly reconnectConnectionId?: number;
  readonly onAuthorizationStarted?: (result: { authorizationUrl: string }) => void;
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
  onAuthorizationStarted,
  onSuccess,
}: ShopConnectionAuthorizationDialogProps): JSX.Element {
  const t = useTranslations('shops.connectDialog');
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<ShopConnectionStepperStep>(1);
  const [authState, setAuthState] = useState<ShopConnectionAuthState>('idle');

  const handleOpenChange = (open: boolean) => {
    if (!open && authState === 'verified') {
      // Rule 3: Safe dismissal - Invalidate queries so /shops updates
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'stats'] });
    }

    onOpenChange?.(open);
    if (!open) {
      onClose?.();
      // Reset state for next open
      setCurrentStep(1);
      setAuthState('idle');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-3xl border border-border-subtle shadow-modal bg-surface-card">
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-4 border-b border-border-subtle pr-12">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-bold tracking-tight text-ink-black">
              {reconnectConnectionId ? t('reconnectTitle') : t('title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-gray">
              {reconnectConnectionId
                ? t('reconnectDescription')
                : fixedOrganizationName
                  ? t('descriptionWithOrg', { orgName: fixedOrganizationName })
                  : t('description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Stepper Progress Indicator */}
        <ShopConnectionStepperIndicator currentStep={currentStep} />

        {/* Body Form */}
        <div className="px-6 sm:px-7 py-6 overflow-y-auto flex-1">
          <ShopConnectionAuthorizationForm
            embedded
            defaultPlatform={defaultPlatform}
            fixedOrganizationId={fixedOrganizationId}
            fixedOrganizationName={fixedOrganizationName}
            reconnectConnectionId={reconnectConnectionId}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            authState={authState}
            onAuthStateChange={setAuthState}
            onAuthorizationStarted={(result) => {
              const handleStarted = onAuthorizationStarted ?? onSuccess;
              handleStarted?.(result);
            }}
            onSuccess={(result) => {
              onSuccess?.(result);
              handleOpenChange(false);
            }}
            onCancel={() => handleOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
