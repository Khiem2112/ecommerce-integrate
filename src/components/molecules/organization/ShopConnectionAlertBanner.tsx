'use client';

import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms';

type ShopConnectionAlertBannerProps = {
  readonly reconnectRequiredCount: number;
  readonly onViewReconnectRequired: () => void;
};

export function ShopConnectionAlertBanner({
  reconnectRequiredCount,
  onViewReconnectRequired,
}: ShopConnectionAlertBannerProps): JSX.Element | null {
  const t = useTranslations('shops.alert');

  if (reconnectRequiredCount <= 0) {
    return null;
  }

  return (
    <section
      role="alert"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl border border-semantic-error/30 bg-semantic-error/10 p-4 text-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 size-5 shrink-0 text-semantic-error">
          <path d="M12 9v4m0 4h.01M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        </svg>
        <p className="text-sm font-medium">{t('reconnectRequiredMessage', { count: reconnectRequiredCount })}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onViewReconnectRequired} className="shrink-0 border-semantic-error/40 text-semantic-error hover:bg-semantic-error/10">
        {t('viewReconnectRequired')}
      </Button>
    </section>
  );
}
