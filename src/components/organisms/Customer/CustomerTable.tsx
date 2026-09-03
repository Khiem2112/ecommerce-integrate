'use client';

import Link from 'next/link';
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
import { VipTierBadge } from '@/components/molecules';
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
          ariaLabel={hasCopied ? 'Đã sao chép!' : 'Sao chép Buyer ID'}
          tooltip={hasCopied ? 'Đã sao chép!' : 'Sao chép Buyer ID'}
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
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-card">
        <Table
          className="min-w-[1100px]"
          containerClassName="max-h-[calc(100vh-320px)] min-h-[360px] overflow-auto custom-scrollbar"
        >
          <TableHeader className="sticky top-0 z-10 bg-surface-lifted border-b border-hairline">
            <TableRow>
              <TableHead className="w-48 whitespace-nowrap">Khách hàng</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Phân hạng</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Điểm VIP RFM</TableHead>
              <TableHead className="w-36 text-right whitespace-nowrap">Tổng chi tiêu</TableHead>
              <TableHead className="w-44 whitespace-nowrap">Tần suất & AOV</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Mua gần nhất</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Hủy / Hoàn</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Quyền riêng tư</TableHead>
              <TableHead className="w-32 text-right whitespace-nowrap">Thao tác</TableHead>
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
                    <span>Không tìm thấy khách hàng nào phù hợp với bộ lọc.</span>
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
                          {customer.orderCount} đơn hàng
                        </span>
                        <span className="text-[11px] text-muted">
                          AOV: {formatVND(customer.avgOrderValue)}
                        </span>
                      </div>
                    </TableCell>

                    {/* Recency */}
                    <TableCell>
                      <span className="text-xs text-muted">
                        {customer.daysSinceLastOrder === null || customer.daysSinceLastOrder === undefined
                          ? 'Chưa mua'
                          : `${customer.daysSinceLastOrder} ngày trước`}
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
                          Hủy: {cancelPct}%
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
                          Hoàn: {refundPct}%
                        </span>
                      </div>
                    </TableCell>

                    {/* Consent status */}
                    <TableCell>
                      {customer.consentStatus === 'granted' ? (
                        <Badge variant="success" size="sm">
                          Đã cấp quyền
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">
                          Thu hồi
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/customers/${customer.id}`} title="Xem hồ sơ 360°">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            ariaLabel="Xem hồ sơ 360°"
                            tooltip="Xem hồ sơ 360°"
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
                            ariaLabel="Chỉnh sửa nhanh"
                            tooltip="Chỉnh sửa hồ sơ"
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
          <div className="text-xs text-muted">
            Hiển thị{' '}
            <strong>
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
            </strong>{' '}
            -{' '}
            <strong>{Math.min(pagination.page * pagination.pageSize, pagination.total)}</strong> trong{' '}
            <strong>{pagination.total}</strong> khách hàng
          </div>

          <div className="flex items-center gap-2">
            {onPageSizeChange && (
              <div className="flex items-center gap-1.5 text-xs text-muted mr-3">
                <span>Hiển thị:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="rounded-md border border-hairline bg-surface-card px-2 py-1 text-xs text-foreground focus:outline-hidden"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={pagination.page <= 1}
                  onClick={() => onPageChange(pagination.page - 1)}
                >
                  Trang trước
                </Button>

                <span className="text-xs font-medium text-foreground px-1">
                  {pagination.page} / {pagination.totalPages}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => onPageChange(pagination.page + 1)}
                >
                  Trang sau
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
