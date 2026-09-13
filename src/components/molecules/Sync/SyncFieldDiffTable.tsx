'use client';

/**
 * Reusable Field Diff Table Component for Synchronization Audit (Phase 1.5).
 * Displays a 3-column comparison table: Field Name | Before | After.
 */

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/atoms';
import { formatSyncFieldValue } from '@/utils';
import { cn } from '@/lib/cn';
import type { FieldDiff } from '@/types';

export type SyncFieldDiffTableProps = {
  readonly diffs: Record<string, FieldDiff>;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  readonly title?: string;
};

export function SyncFieldDiffTable({
  diffs,
  size = 'md',
  className,
  title,
}: SyncFieldDiffTableProps) {
  const t = useTranslations('integrations.diff');
  const tFields = useTranslations('integrations.diff.fields');
  const locale = useLocale() === 'vi' ? 'vi-VN' : 'en-US';
  const formatOptions = {
    locale,
    activeLabel: t('active'),
    inactiveLabel: t('inactive'),
  } as const;
  const fieldLabels: Readonly<Record<string, string>> = {
    status: tFields('status'),
    totalValue: tFields('totalValue'),
    shippingFee: tFields('shippingFee'),
    discountAmount: tFields('discountAmount'),
    quantity: tFields('quantity'),
    unitPrice: tFields('unitPrice'),
    discount: tFields('discount'),
    productName: tFields('productName'),
    sku: tFields('sku'),
    isActive: tFields('isActive'),
  };
  const entries = Object.entries(diffs);

  if (entries.length === 0) {
    return null;
  }

  const isSmall = size === 'sm';

  return (
    <div className={cn('space-y-1.5', className)}>
      {title && (
        <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
          {title}
        </span>
      )}
      <div className="rounded-lg border border-hairline overflow-hidden bg-surface-card">
        <Table>
          <TableHeader>
            <TableRow className={cn(isSmall && 'bg-surface-lifted')}>
              <TableHead className={cn('w-1/3 text-muted', isSmall && 'py-1.5 text-[11px]')}>
                {t('fieldName')}
              </TableHead>
              <TableHead className={cn('w-1/3 text-muted', isSmall && 'py-1.5 text-[11px]')}>
                {t('before')}
              </TableHead>
              <TableHead className={cn('w-1/3 text-foreground font-semibold', isSmall && 'py-1.5 text-[11px]')}>
                {t('after')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {entries.map(([fieldKey, diff]) => (
              <TableRow key={fieldKey}>
                <TableCell className={cn('font-medium text-foreground', isSmall && 'py-1.5 text-[11px]')}>
                  {fieldLabels[fieldKey] ?? fieldKey}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-muted',
                    diff.before !== null && diff.before !== undefined && 'line-through decoration-muted/40',
                    isSmall && 'py-1.5 text-[11px]',
                  )}
                >
                  {formatSyncFieldValue(fieldKey, diff.before, formatOptions)}
                </TableCell>
                <TableCell className={cn('text-status-success font-semibold', isSmall && 'py-1.5 text-[11px]')}>
                  {formatSyncFieldValue(fieldKey, diff.after, formatOptions)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
