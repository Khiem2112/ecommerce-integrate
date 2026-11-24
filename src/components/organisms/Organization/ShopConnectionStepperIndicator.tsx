'use client';

import { type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { ShopConnectionStepperStep } from '@/types';

export type ShopConnectionStepperIndicatorProps = {
  readonly currentStep: ShopConnectionStepperStep;
  readonly className?: string;
};

export function ShopConnectionStepperIndicator({
  currentStep,
  className,
}: ShopConnectionStepperIndicatorProps): JSX.Element {
  const t = useTranslations('shops.connectDialog.stepper');

  return (
    <nav
      role="navigation"
      aria-label={t('navLabel')}
      className={cn(
        'px-6 sm:px-7 py-3.5 bg-surface-lifted border-b border-border-subtle select-none',
        className,
      )}
    >
      <div className="flex items-center justify-between relative">
        {/* Connector lines */}
        <div
          aria-hidden="true"
          className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-border-subtle -z-0"
        />
        <div
          aria-hidden="true"
          className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-ink-black -z-0 transition-all duration-300"
          style={{ width: currentStep === 2 ? 'calc(100% - 64px)' : '0%' }}
        />

        {/* Step 1 Item */}
        <div
          className="flex items-center gap-2.5 z-10 bg-surface-lifted pr-3"
          aria-current={currentStep === 1 ? 'step' : undefined}
        >
          <div
            className={cn(
              'size-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
              currentStep === 1 && 'bg-ink-black text-white',
              currentStep === 2 && 'bg-status-success text-white',
            )}
          >
            {currentStep === 2 ? '✓' : '1'}
          </div>
          <div className="text-left">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-gray block">
              {t('step1Badge')}
            </span>
            <span
              className={cn(
                'text-xs',
                currentStep === 1
                  ? 'font-bold text-ink-black'
                  : 'font-semibold text-slate-gray',
              )}
            >
              {t('step1Title')}
            </span>
          </div>
        </div>

        {/* Step 2 Item */}
        <div
          className="flex items-center gap-2.5 z-10 bg-surface-lifted pl-3"
          aria-current={currentStep === 2 ? 'step' : undefined}
        >
          <div
            className={cn(
              'size-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
              currentStep === 2
                ? 'bg-ink-black text-white'
                : 'bg-border-subtle text-slate-gray',
            )}
          >
            2
          </div>
          <div className="text-left">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-gray block">
              {t('step2Badge')}
            </span>
            <span
              className={cn(
                'text-xs',
                currentStep === 2
                  ? 'font-bold text-ink-black'
                  : 'font-medium text-slate-gray',
              )}
            >
              {t('step2Title')}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
