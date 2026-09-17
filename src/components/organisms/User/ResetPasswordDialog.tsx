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
import { useResetUserPassword } from '@/hooks';
import type { PasswordResetResult } from '@/types';
import { TemporaryCredentialHandoff } from './TemporaryCredentialHandoff';

export type ResetPasswordDialogProps = {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly userId: number;
  readonly userName: string;
};

export function ResetPasswordDialog({
  isOpen,
  onOpenChange,
  userId,
  userName,
}: ResetPasswordDialogProps) {
  const t = useTranslations('users.resetModal');
  const tUsers = useTranslations('users');
  const [isManual, setIsManual] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [resetResult, setResetResult] = useState<PasswordResetResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetMutation = useResetUserPassword();

  const handleReset = async () => {
    setErrorMessage(null);
    if (isManual && customPassword.trim().length < 8) {
      setErrorMessage(tUsers('errors.minPasswordLength'));
      return;
    }

    try {
      const result = await resetMutation.mutateAsync({
        userId,
        customPassword: isManual ? customPassword.trim() : null,
        idempotencyKey: crypto.randomUUID(),
      });
      setResetResult(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : tUsers('errors.resetFailed'),
      );
    }
  };

  const handleClose = () => {
    setResetResult(null);
    setCustomPassword('');
    setIsManual(false);
    setErrorMessage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-6">
        {resetResult ? (
          <div className="space-y-4">
            <TemporaryCredentialHandoff
              password={resetResult.temporaryPassword}
              userId={resetResult.userId}
              onClose={handleClose}
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
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
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription className="text-sm text-muted">
                {t('description', { name: userName })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {errorMessage && (
                <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/10 p-3 text-xs text-semantic-error">
                  {errorMessage}
                </div>
              )}

              {/* Toggle auto vs manual */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="resetPasswordMode"
                    checked={!isManual}
                    onChange={() => setIsManual(false)}
                    className="accent-primary"
                  />
                  <span>{t('autoPassword')}</span>
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="resetPasswordMode"
                    checked={isManual}
                    onChange={() => setIsManual(true)}
                    className="accent-primary"
                  />
                  <span>{t('manualPassword')}</span>
                </label>
              </div>

              {isManual && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-reset-password"
                    className="text-xs font-medium text-foreground block"
                  >
                    {t('customPasswordLabel')}
                  </label>
                  <Input
                    id="custom-reset-password"
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder={t('customPasswordPlaceholder')}
                    className="text-sm font-mono"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={resetMutation.isPending}
                onClick={handleClose}
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={resetMutation.isPending}
                onClick={handleReset}
              >
                {resetMutation.isPending ? t('resetting') : t('confirmButton')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
