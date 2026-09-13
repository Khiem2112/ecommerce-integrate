'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useClipboard } from '@/hooks';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
  IconButton,
} from '@/components/atoms';
import { VipTierBadge, Pagination } from '@/components/molecules';
import { formatVND } from '@/utils';
import type { CustomerWithRelations, PaginationMeta } from '@/types';
import { cn } from '@/lib/cn';

export type CustomerTableProps = {
  readonly customers: readonly CustomerWithRelations[];
  readonly isLoading: boolean;
  readonly pagination?: PaginationMeta;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (size: number) => void;
  readonly onQuickEdit?: (customer: CustomerWithRelations) => void;
};

function CopyableBuyerId({ idText, platformName }: { readonly idText: string; readonly platformName: string }) {
  const { copy, hasCopied } = useClipboard({ timeout: 1500 });
  const t = useTranslations('customers');

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
        <span
          className="truncate max-w-[130px] group-hover/link:underline group-hover/link:text-primary transition-colors"
          title={idText}
        >
          {idText}
        </span>
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          ariaLabel={hasCopied ? t('table.copied') : t('table.copyBuyerId')}
          tooltip={hasCopied ? t('table.copied') : t('table.copyBuyerId')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            copy(idText);
          }}
          className="text-muted hover:text-foreground"
        >
          {hasCopied ? (
            <span className="text-xs text-semantic-success font-sans">✓</span>
          ) : (
            <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </IconButton>
      </div>
      <span className="text-[11px] text-muted">{platformName}</span>
    </div>
  );
}

function VipScoreMeter({ score }: { readonly score: number }) {
  const percentage = Math.min(100, Math.max(0, score));
  let barColor = 'bg-muted';
  if (percentage >= 90) barColor = 'bg-primary';
  else if (percentage >= 70) barColor = 'bg-amber-500';
  else if (percentage >= 40) barColor = 'bg-cyan-500';

  return (
    <div className="flex flex-col gap-1 w-24">
      <div className="flex items-baseline justify-between text-xs font-bold font-mono">
        <span className="text-foreground">{score.toFixed(1)}</span>
        <span className="text-[10px] text-muted font-normal">/ 100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-lifted border border-hairline">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function CustomerTable({
  customers,
  isLoading,
  pagination,
  onPageChange,
  onPageSizeChange,
  onQuickEdit,
}: CustomerTableProps) {
  const t = useTranslations('customers');
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-hairline-strong bg-surface-card/75 md:hidden">
        {isLoading ? (
          <div className="divide-y divide-hairline" aria-label={t('table.loading')}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`mobile-skeleton-${index}`} className="animate-pulse space-y-3 p-4">
                <div className="h-3 w-2/5 rounded bg-hairline" />
                <div className="h-3 w-4/5 rounded bg-hairline-soft" />
                <div className="h-3 w-3/5 rounded bg-hairline-soft" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">{t('table.emptyMobileTitle')}</p>
            <p className="mt-1 text-xs text-muted">{t('table.emptyMobileDescription')}</p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {customers.map((customer) => (
              <article key={customer.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/customers/${customer.id}`} className="min-w-0">
                    <span className="block truncate font-mono text-sm font-semibold text-foreground">
                      {customer.platformBuyerId}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{customer.platform.name}</span>
                  </Link>
                  <VipTierBadge code={customer.vipTier.code} name={customer.vipTier.name} />
                </div>

                <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-y border-hairline py-3 text-xs">
                  <div className="min-w-0">
                    <dt className="text-muted">{t('table.vipScore')}</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-foreground">
                      {customer.vipScore.toFixed(1)} / 100
                    </dd>
                  </div>
                  <div className="min-w-0 text-right">
                    <dt className="text-muted">{t('table.totalSpend')}</dt>
                    <dd className="mt-0.5 font-semibold text-foreground">
                      {formatVND(customer.totalSpend)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted">{t('table.orders')}</dt>
                    <dd className="mt-0.5 text-foreground">{t('table.orderCount', { count: customer.orderCount })}</dd>
                  </div>
                  <div className="min-w-0 text-right">
                    <dt className="text-muted">{t('table.lastPurchase')}</dt>
                    <dd className="mt-0.5 text-foreground">
                      {customer.daysSinceLastOrder === null || customer.daysSinceLastOrder === undefined
                        ? t('table.notPurchased')
                        : t('table.daysAgo', { count: customer.daysSinceLastOrder })}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-end gap-1">
                  <Link href={`/customers/${customer.id}`}>
                    <Button variant="ghost" size="xs">{t('table.viewProfile')}</Button>
                  </Link>
                  {onQuickEdit && (
                    <Button variant="ghost" size="xs" onClick={() => onQuickEdit(customer)}>
                      {t('table.edit')}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-hairline-strong bg-surface-card/75 md:block">
        <Table
          className="min-w-[1100px]"
          containerClassName="max-h-[calc(100vh-320px)] min-h-[360px] overflow-auto custom-scrollbar"
        >
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-48 whitespace-nowrap">{t('table.customer')}</TableHead>
              <TableHead className="w-32 whitespace-nowrap">{t('table.tier')}</TableHead>
              <TableHead className="w-32 whitespace-nowrap">{t('table.vipScore')}</TableHead>
              <TableHead className="w-36 text-right whitespace-nowrap">{t('table.totalSpend')}</TableHead>
              <TableHead className="w-44 whitespace-nowrap">{t('table.frequencyAndAov')}</TableHead>
              <TableHead className="w-32 whitespace-nowrap">{t('table.lastPurchase')}</TableHead>
              <TableHead className="w-36 whitespace-nowrap">{t('table.cancellationsRefunds')}</TableHead>
              <TableHead className="w-28 whitespace-nowrap">{t('table.privacy')}</TableHead>
              <TableHead className="w-32 text-right whitespace-nowrap">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={9}>
                    <div className="h-6 w-full animate-pulse rounded bg-surface-lifted" />
                  </TableCell>
                </TableRow>
              ))
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-48 text-center text-muted">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg
                      aria-hidden="true"
                      className="size-8 text-muted/60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                    <span>{t('table.emptyTitle')}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                const cancelPct = (customer.cancellationRate * 100).toFixed(0);
                const refundPct = (customer.refundRate * 100).toFixed(0);

                return (
                  <TableRow
                    key={customer.id}
                    className="group hover:bg-surface-lifted/60 transition-colors"
                  >
                    {/* Buyer ID & Platform */}
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="group/link flex flex-col gap-0.5"
                      >
                        <CopyableBuyerId
                          idText={customer.platformBuyerId}
                          platformName={customer.platform.name}
                        />
                      </Link>
                    </TableCell>

                    {/* VIP Tier Badge */}
                    <TableCell>
                      <VipTierBadge
                        code={customer.vipTier.code}
                        name={customer.vipTier.name}
                      />
                    </TableCell>

                    {/* VIP RFM Score Meter */}
                    <TableCell>
                      <VipScoreMeter score={customer.vipScore} />
                    </TableCell>

                    {/* Total Spend */}
                    <TableCell className="text-right">
                      <span className="font-semibold text-xs text-foreground">
                        {formatVND(customer.totalSpend)}
                      </span>
                    </TableCell>

                    {/* Order count & AOV */}
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="font-medium text-foreground">
                          {t('table.orders', { count: customer.orderCount })}
                        </span>
                        <span className="text-[11px] text-muted">
                          {t('table.aov', { value: formatVND(customer.avgOrderValue) })}
                        </span>
                      </div>
                    </TableCell>

                    {/* Recency */}
                    <TableCell>
                      <span className="text-xs text-muted">
                        {customer.daysSinceLastOrder === null || customer.daysSinceLastOrder === undefined
                          ? t('table.notPurchased')
                          : t('table.daysAgo', { count: customer.daysSinceLastOrder })}
                      </span>
                    </TableCell>

                    {/* Cancel & Refund Rate */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span
                          className={cn(
                            'text-[11px] font-medium',
                            customer.cancellationRate > 0.1
                              ? 'text-semantic-error'
                              : 'text-muted',
                          )}
                        >
                          {t('table.cancelRate', { rate: cancelPct })}
                        </span>
                        <span className="text-muted/40">•</span>
                        <span
                          className={cn(
                            'text-[11px] font-medium',
                            customer.refundRate > 0.05
                              ? 'text-semantic-error'
                              : 'text-muted',
                          )}
                        >
                          {t('table.refundRate', { rate: refundPct })}
                        </span>
                      </div>
                    </TableCell>

                    {/* Consent status */}
                    <TableCell>
                      {customer.consentStatus === 'granted' ? (
                        <Badge variant="success" size="sm">
                          {t('table.consentGranted')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">
                          {t('table.consentRevoked')}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/customers/${customer.id}`} title={t('table.viewProfile')}>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            ariaLabel={t('table.viewProfile')}
                            tooltip={t('table.viewProfile')}
                            className="text-muted hover:text-foreground"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          </IconButton>
                        </Link>

                        {onQuickEdit && (
                          <IconButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            ariaLabel={t('table.quickEdit')}
                            tooltip={t('table.editProfile')}
                            onClick={() => onQuickEdit(customer)}
                            className="text-muted hover:text-foreground"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </IconButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {pagination && pagination.total > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel={t('table.customer')}
        />
      )}
    </div>
  );
}
