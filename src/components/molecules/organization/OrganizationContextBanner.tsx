'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms';

export type OrganizationContextBannerProps = {
  readonly isSwitching?: boolean;
  readonly onSwitchActive: () => void;
};

export function OrganizationContextBanner({
  isSwitching = false,
  onSwitchActive,
}: OrganizationContextBannerProps) {
  const t = useTranslations('organizations');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-status-warning-text">
      <div className="flex items-center gap-2.5">
        <svg
          aria-hidden="true"
          className="size-4 shrink-0 text-status-warning"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-xs font-medium">{t('context.selected')}</span>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        isLoading={isSwitching}
        onClick={onSwitchActive}
        className="border-status-warning/40 bg-surface-card text-xs text-foreground hover:bg-surface-lifted"
      >
        {isSwitching ? t('context.switching') : t('context.switch')}
      </Button>
    </div>
  );
}
