/**
 * Shared utility functions and label dictionary for Synchronization Audit Diffs (Phase 1.5).
 */

import React from 'react';
import { Badge } from '@/components/atoms';

export type SyncFieldValueFormatOptions = {
  readonly locale: string;
  readonly activeLabel: string;
  readonly inactiveLabel: string;
};

/**
 * Formats diff field value into a readable ReactNode with semantic badges and currency formatting.
 */
export function formatSyncFieldValue(
  key: string,
  val: unknown,
  options: SyncFieldValueFormatOptions,
): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-muted/60 font-mono">—</span>;
  }

  if (typeof val === 'boolean') {
    return val ? (
      <Badge variant="success" size="xs">{options.activeLabel}</Badge>
    ) : (
      <Badge variant="error" size="xs">{options.inactiveLabel}</Badge>
    );
  }

  if (key === 'status' && typeof val === 'string') {
    return (
      <Badge variant="primary" size="xs" className="uppercase font-mono text-[10px]">
        {val}
      </Badge>
    );
  }

  const numericValue = typeof val === 'number'
    ? val
    : typeof val === 'string' && val.trim() !== '' && Number.isFinite(Number(val))
      ? Number(val)
      : null;

  if (
    (key === 'totalValue' ||
      key === 'shippingFee' ||
      key === 'discountAmount' ||
      key === 'unitPrice' ||
      key === 'discount') &&
    numericValue !== null
  ) {
    return (
      <span className="font-mono font-medium">
        {new Intl.NumberFormat(options.locale, { style: 'currency', currency: 'VND' }).format(numericValue)}
      </span>
    );
  }

  if (key === 'quantity' && typeof val === 'number') {
    return <span className="font-mono font-bold">{val}</span>;
  }

  return <span className="font-mono text-xs">{String(val)}</span>;
}
