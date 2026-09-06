'use client';

import { useMemo } from 'react';
import { Combobox, type ComboboxItem } from '@/components/atoms';
import { cn } from '@/lib/cn';
import type { OrderLookupOptions } from '@/types';

export type OrderStatusItem = ComboboxItem;

export const DEFAULT_ORDER_STATUS_ITEMS: readonly ComboboxItem[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'unpaid', label: 'Chờ thanh toán (Unpaid)', dotColor: '#eab308' },
  { value: 'ready_to_ship', label: 'Sẵn sàng giao (Ready to Ship)', dotColor: '#3b82f6' },
  { value: 'shipped', label: 'Đang giao hàng (Shipped)', dotColor: '#06b6d4' },
  { value: 'delivered', label: 'Đã giao thành công (Delivered)', dotColor: '#22c55e' },
  { value: 'canceled', label: 'Đã hủy (Canceled)', dotColor: '#ef4444' },
  { value: 'returned', label: 'Đổi trả / Hoàn tiền (Returned)', dotColor: '#f97316' },
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
  label = 'Lọc theo trạng thái đơn hàng',
  placeholder = 'Tất cả trạng thái',
  ariaLabel = 'Lọc theo trạng thái đơn hàng',
  disabled = false,
  size = 'md',
  searchable = true,
  className,
}: OrderStatusFilterProps) {
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
            subLabel: s.isFinal ? 'Kết thúc' : undefined,
            dotColor,
          };
        }),
      ];
    }

    return DEFAULT_ORDER_STATUS_ITEMS;
  }, [items, lookups?.statuses, placeholder]);

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
