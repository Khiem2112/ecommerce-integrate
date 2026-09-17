'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms';
import { useClipboard } from '@/hooks';
import { Link } from '@/i18n/navigation';

export type TemporaryCredentialHandoffProps = {
  readonly password: string;
  readonly userId?: number;
  readonly onClose?: () => void;
};

export function TemporaryCredentialHandoff({
  password,
  userId,
  onClose,
}: TemporaryCredentialHandoffProps) {
  const t = useTranslations('users.handoff');
  const { copy, hasCopied } = useClipboard();

  // Local secret holder that scrubs on unmount
  const [localSecret, setLocalSecret] = useState<string | null>(password);

  useEffect(() => {
    setLocalSecret(password);
    return () => {
      // Memory scrub on component unmount
      setLocalSecret(null);
    };
  }, [password]);

  const handleCopy = () => {
    if (localSecret) {
      copy(localSecret);
    }
  };

  const handleClose = () => {
    setLocalSecret(null);
    onClose?.();
  };

  return (
    <div className="rounded-2xl border border-semantic-success/30 bg-semantic-success/5 p-6 shadow-card space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-semantic-success/15 text-semantic-success">
          <svg
            aria-hidden="true"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t('title')}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Secret Password Display Block */}
      <div className="rounded-xl border border-hairline bg-surface-card p-4 space-y-2">
        <span className="text-xs font-medium text-muted block">
          {t('passwordLabel')}
        </span>
        <div className="flex items-center justify-between gap-3">
          <code className="font-mono text-base font-semibold text-foreground tracking-wider select-all break-all">
            {localSecret ?? '••••••••••••'}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {hasCopied ? t('copied') : t('copyPassword')}
          </Button>
        </div>
      </div>

      {/* Security Warning */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{t('warning')}</span>
        </div>
      </div>

      {/* Destination Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        {userId && (
          <Link href={`/users/${userId}`}>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClose}
            >
              {t('finishAndGoToDetail')}
            </Button>
          </Link>
        )}
        <Link href="/users">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleClose}
          >
            {t('finishAndGoToDirectory')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
