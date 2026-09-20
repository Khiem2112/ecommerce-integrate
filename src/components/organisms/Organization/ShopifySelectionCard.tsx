'use client';

import { type ReactNode, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { SelectionCard } from '@/components/atoms';

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
    <SelectionCard
      value="shopify"
      title="Shopify"
      description={description ?? t('shopifyDesc')}
      icon="S"
      checked={isSelected}
      disabled={disabled}
      onChange={onSelect}
      containerClassName={isSelected ? 'ring-2 ring-primary/20' : undefined}
    />
  );
}
