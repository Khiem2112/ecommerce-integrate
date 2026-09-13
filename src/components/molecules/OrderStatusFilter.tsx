'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Combobox, type ComboboxItem } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { OrderLookupOptions } from '@/types';

export type OrderStatusItem = ComboboxItem;

export const DEFAULT_ORDER_STATUS_ITEMS: readonly ComboboxItem[] = [
  { value: '', label: 'All' },
  { value: 'unpaid', label: 'Unpaid', dotColor: '#eab308' },
  { value: 'ready_to_ship', label: 'Ready to Ship', dotColor: '#3b82f6' },
  { value: 'shipped', label: 'Shipped', dotColor: '#06b6d4' },
  { value: 'delivered', label: 'Delivered', dotColor: '#22c55e' },
  { value: 'canceled', label: 'Canceled', dotColor: '#ef4444' },
  { value: 'returned', label: 'Returned', dotColor: '#f97316' },
];

export type OrderStatusFilterProps = {
  readonly value?: string;
  readonly onChange: (status: string) => void;
  readonly lookups?: OrderLookupOptions | { readonly statuses: readonly { readonly id: number; readonly code: string; readonly name: string; readonly isFinal?: boolean }[] };
  readonly items?: readonly ComboboxItem[];
  readonly label?: string;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md';
  readonly searchable?: boolean;
  readonly className?: string;
  readonly id?: string;
};

export function OrderStatusFilter({
  value = '',
  onChange,
  lookups,
  items,
  label,
  placeholder: placeholderProp,
  ariaLabel: ariaLabelProp,
  disabled = false,
  size = 'md',
  searchable = true,
  className,
}: OrderStatusFilterProps) {
  const tFilters = useTranslations('orders.filters');
  const tStatuses = useTranslations('orders.statuses');

  const placeholder = placeholderProp ?? tFilters('allStatuses');
  const ariaLabel = ariaLabelProp ?? tFilters('statusAria');

  const defaultStatusItems: readonly ComboboxItem[] = useMemo(() => [
    { value: '', label: tStatuses('all') },
    { value: 'unpaid', label: tStatuses('pending'), dotColor: '#eab308' },
    { value: 'ready_to_ship', label: tStatuses('confirmed'), dotColor: '#3b82f6' },
    { value: 'shipped', label: tStatuses('shipped'), dotColor: '#06b6d4' },
    { value: 'delivered', label: tStatuses('delivered'), dotColor: '#22c55e' },
    { value: 'canceled', label: tStatuses('cancelled'), dotColor: '#ef4444' },
    { value: 'returned', label: tStatuses('return_requested'), dotColor: '#f97316' },
  ], [tStatuses]);

  const statusOptions: readonly ComboboxItem[] = useMemo(() => {
    if (items && items.length > 0) {
      return items;
    }

    if (lookups?.statuses && lookups.statuses.length > 0) {
      return [
        { value: '', label: placeholder },
        ...lookups.statuses.map((s) => {
          let dotColor: string | undefined = undefined;
          const code = (s.code || '').toLowerCase();
          if (code === 'unpaid') dotColor = '#eab308';
          else if (code === 'ready_to_ship' || code === 'paid') dotColor = '#3b82f6';
          else if (code === 'shipped') dotColor = '#06b6d4';
          else if (code === 'delivered') dotColor = '#22c55e';
          else if (code === 'canceled' || code === 'cancelled') dotColor = '#ef4444';
          else if (code === 'returned' || code === 'refunded') dotColor = '#f97316';

          return {
            value: s.code || String(s.id),
            label: s.name,
            subLabel: s.isFinal ? tFilters('finalStatus') : undefined,
            dotColor,
          };
        }),
      ];
    }

    return defaultStatusItems;
  }, [items, lookups?.statuses, placeholder, defaultStatusItems]);

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-xs font-semibold text-foreground">
          {label}
        </label>
      )}
      <Combobox
        items={statusOptions}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        disabled={disabled}
        size={size}
        searchable={searchable}
      />
    </div>
  );
}
