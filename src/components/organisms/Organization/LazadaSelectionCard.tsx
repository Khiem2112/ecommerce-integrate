'use client';

import { type ReactNode, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { RadioGroup, RadioGroupItem, SelectionCard } from '@/components/atoms';
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
    <SelectionCard
      value="lazada"
      title="Lazada"
      description={description ?? t('lazadaDesc')}
      icon="L"
      checked={isSelected}
      disabled={disabled}
      onChange={onSelect}
      containerClassName={isSelected ? 'ring-2 ring-primary/20' : undefined}
    >
      {isSelected && (
        <div className="space-y-1.5 animate-in fade-in-50 duration-150">
          <p className="text-[11px] font-semibold text-foreground/80">
            {t('lazadaEnvLabel')}
          </p>
          <RadioGroup
            name="environment"
            value={environment}
            onChange={(val) => onEnvironmentChange(val as ShopEnvironment)}
            className="flex items-center gap-3 pt-0.5"
          >
            <RadioGroupItem
              value="production"
              label={t('lazadaEnvProduction')}
              disabled={disabled}
            />
            <RadioGroupItem
              value="sandbox"
              label={t('lazadaEnvSandbox')}
              disabled={disabled}
            />
          </RadioGroup>
        </div>
      )}
    </SelectionCard>
  );
}
