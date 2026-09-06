/**
 * Shared utility functions and label dictionary for Synchronization Audit Diffs (Phase 1.5).
 */

import React from 'react';
import { Badge } from '@/components/atoms';

export const SYNC_FIELD_LABELS: Record<string, string> = {
  status: 'Trạng thái đơn',
  totalValue: 'Tổng tiền đơn hàng',
  shippingFee: 'Phí vận chuyển',
  discountAmount: 'Giảm giá voucher',
  quantity: 'Số lượng sản phẩm',
  unitPrice: 'Đơn giá',
  discount: 'Tiền giảm giá',
  productName: 'Tên sản phẩm',
  sku: 'Mã SKU',
  isActive: 'Trạng thái kích hoạt',
};

/**
 * Formats diff field value into a readable ReactNode with semantic badges and currency formatting.
 */
export function formatSyncFieldValue(key: string, val: unknown): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-muted italic">trống</span>;
  }

  if (typeof val === 'boolean') {
    return val ? (
      <Badge variant="success" size="xs">Đang bán</Badge>
    ) : (
      <Badge variant="error" size="xs">Đã vô hiệu</Badge>
    );
  }

  if (key === 'status' && typeof val === 'string') {
    return (
      <Badge variant="primary" size="xs" className="uppercase font-mono text-[10px]">
        {val}
      </Badge>
    );
  }

  if (
    (key === 'totalValue' ||
      key === 'shippingFee' ||
      key === 'discountAmount' ||
      key === 'unitPrice' ||
      key === 'discount') &&
    typeof val === 'number'
  ) {
    return (
      <span className="font-mono font-medium">
        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)}
      </span>
    );
  }

  if (key === 'quantity' && typeof val === 'number') {
    return <span className="font-mono font-bold">{val}</span>;
  }

  return <span className="font-mono text-xs">{String(val)}</span>;
}
