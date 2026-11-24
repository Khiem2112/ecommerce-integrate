'use client';

import { type ReactNode, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { ShopEnvironment } from '@/types';

export type LazadaSelectionCardProps = {
  readonly isSelected: boolean;
  readonly disabled?: boolean;
  readonly environment: ShopEnvironment;
  readonly onEnvironmentChange: (env: ShopEnvironment) => void;
  readonly onSelect: () => void;
  readonly description?: ReactNode;
};

export function LazadaSelectionCard({
  isSelected,
  disabled = false,
  environment,
  onEnvironmentChange,
  onSelect,
  description,
}: LazadaSelectionCardProps): JSX.Element {
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
          <div className="size-9 rounded-xl bg-channel-lazada/10 text-channel-lazada font-extrabold flex items-center justify-center text-xs shrink-0">
            LAZ
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-black">Lazada</h4>
            <p className="text-[11px] text-slate-gray">
              {description ?? t('lazadaDesc')}
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

      {/* Environment Switcher for Lazada */}
      {isSelected && (
        <div
          className="mt-3 pt-2.5 border-t border-border-subtle"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold text-slate-gray block mb-1.5">
            {t('lazadaEnvLabel')}:
          </span>
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-border-subtle/50 text-[11px]">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEnvironmentChange('production')}
              className={cn(
                'py-1 rounded-md transition-all text-center cursor-pointer',
                environment === 'production'
                  ? 'font-bold bg-white text-ink-black shadow-xs'
                  : 'font-medium text-slate-gray hover:text-ink-black',
              )}
            >
              {t('lazadaEnvProduction')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEnvironmentChange('sandbox')}
              className={cn(
                'py-1 rounded-md transition-all text-center cursor-pointer',
                environment === 'sandbox'
                  ? 'font-bold bg-white text-ink-black shadow-xs'
                  : 'font-medium text-slate-gray hover:text-ink-black',
              )}
            >
              {t('lazadaEnvSandbox')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
