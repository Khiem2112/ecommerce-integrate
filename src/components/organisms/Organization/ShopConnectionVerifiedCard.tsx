'use client';

import { useMemo, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { ShopVerifiedIdentity } from '@/types';

export type ShopConnectionVerifiedCardProps = {
  readonly identity: ShopVerifiedIdentity;
  readonly className?: string;
};

function formatExpiryDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function ShopConnectionVerifiedCard({
  identity,
  className,
}: ShopConnectionVerifiedCardProps): JSX.Element {
  const t = useTranslations('shops.connectDialog.step2');

  const expiryText = useMemo(() => {
    if (identity.platformCode === 'shopify' || !identity.tokenExpiresAt) {
      return t('tokenPermanent');
    }

    const expiryTime = new Date(identity.tokenExpiresAt).getTime();
    const now = Date.now();
    const days = Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)));
    const formattedDate = formatExpiryDate(identity.tokenExpiresAt);

    return t('tokenDaysRemaining', { days, date: formattedDate });
  }, [identity.platformCode, identity.tokenExpiresAt, t]);

  const isLazada = identity.platformCode === 'lazada';

  return (
    <div
      role="region"
      aria-live="polite"
      className={cn(
        'p-4 rounded-2xl border border-status-success/30 bg-status-success/10 space-y-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'size-10 rounded-xl font-extrabold flex items-center justify-center text-xs shrink-0 shadow-xs border',
              isLazada
                ? 'bg-white border-channel-lazada/20 text-channel-lazada'
                : 'bg-white border-channel-shopify/30 text-channel-shopify',
            )}
          >
            {isLazada ? 'LAZ' : 'SHO'}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-status-success-text block">
              {t('verifiedTitle')}
            </span>
            <h4 className="text-sm font-extrabold text-foreground leading-snug">
              {identity.shopName}
            </h4>
            <p className="text-[11px] text-muted font-mono mt-0.5">
              {t('sellerIdLabel')}:{' '}
              <span className="text-foreground font-semibold">
                {identity.externalShopId}
              </span>
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-surface-card text-status-success-text text-[11px] font-bold border border-status-success/30 shrink-0">
          ● {t('verifiedBadge')}
        </span>
      </div>

      <div className="pt-2.5 border-t border-status-success/20 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <svg
            aria-hidden="true"
            className="size-4 text-status-success-text shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{t('tokenExpiryLabel')}:</span>
        </div>
        <div className="font-mono font-bold text-foreground bg-surface-card px-2.5 py-0.5 rounded-md border border-status-success/20 text-[11px]">
          {expiryText}
        </div>
      </div>
    </div>
  );
}
