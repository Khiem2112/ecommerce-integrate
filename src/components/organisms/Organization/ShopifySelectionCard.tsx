'use client';

import { type ReactNode, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

export type ShopifySelectionCardProps = {
  readonly isSelected: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
  readonly description?: ReactNode;
};

export function ShopifySelectionCard({
  isSelected,
  disabled = false,
  onSelect,
  description,
}: ShopifySelectionCardProps): JSX.Element {
  const t = useTranslations('shops.connectDialog');

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'p-4 rounded-2xl cursor-pointer transition-all relative flex flex-col justify-between select-none text-left',
        isSelected
          ? 'border-2 border-ink-black bg-surface-lifted shadow-xs'
          : 'border border-border-subtle bg-surface-card hover:border-dust-taupe',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-channel-shopify/15 text-channel-shopify font-extrabold flex items-center justify-center text-xs shrink-0">
            SHO
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-black">Shopify</h4>
            <p className="text-[11px] text-slate-gray">
              {description ?? t('step1.shopifySub')}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'size-4 rounded-full flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-ink-black text-white'
              : 'border border-border-subtle hidden',
          )}
        >
          <svg
            className="size-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>
      <div className="mt-4 text-[11px] text-slate-gray leading-tight">
        {t('step1.shopifyDescription')}
      </div>
    </div>
  );
}
