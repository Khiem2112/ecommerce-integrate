'use client';

import Link from 'next/link';
import { useFlashingRow, useClipboard } from '@/hooks';
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
  MaskedBuyerId,
} from '@/components/atoms';
import { Pagination } from '@/components/molecules';
import {
  formatVND,
  formatDate,
  getStatusBadgeVariant,
  getVipBadgeVariant,
} from '@/utils';
import type { OrderWithRelations, PaginationMeta } from '@/types';
import { cn } from '@/lib/cn';

export type OrderTableProps = {
  readonly orders: readonly OrderWithRelations[];
  readonly isLoading: boolean;
  readonly pagination?: PaginationMeta;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (size: number) => void;
  readonly onDeleteClick: (order: OrderWithRelations) => void;
};

function CopyableOrderId({ idText }: { readonly idText: string }) {
  const { copy, hasCopied } = useClipboard({ timeout: 1500 });

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-foreground">
      <span>{idText}</span>
      <IconButton
        type="button"
        variant="ghost"
        size="xs"
        ariaLabel={hasCopied ? 'Đã sao chép!' : 'Sao chép mã đơn'}
        tooltip={hasCopied ? 'Đã sao chép!' : 'Sao chép mã đơn'}
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
  );
}

export function OrderTable({
  orders,
  isLoading,
  pagination,
  onPageChange,
  onPageSizeChange,
  onDeleteClick,
}: OrderTableProps) {
  const { isFlashing } = useFlashingRow(3000);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-hairline-strong bg-surface-card/75 md:hidden">
        {isLoading ? (
          <div className="divide-y divide-hairline" aria-label="Đang tải đơn hàng">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`mobile-skeleton-${index}`} className="animate-pulse space-y-3 p-4">
                <div className="h-3 w-2/5 rounded bg-hairline" />
                <div className="h-3 w-4/5 rounded bg-hairline-soft" />
                <div className="h-3 w-3/5 rounded bg-hairline-soft" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Không tìm thấy đơn hàng</p>
            <p className="mt-1 text-xs text-muted">Thử thay đổi từ khóa hoặc bộ lọc.</p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {orders.map((order) => {
              const statusInfo = getStatusBadgeVariant(order.currentStatus.code);

              return (
                <article
                  key={order.id}
                  className="p-4"
                  aria-labelledby={`order-card-${order.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/orders/${order.id}`} className="min-w-0">
                      <span
                        id={`order-card-${order.id}`}
                        className="block truncate font-mono text-sm font-semibold text-foreground"
                      >
                        {order.platformOrderId}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{order.platform.name}</span>
                    </Link>
                    <Badge variant={statusInfo.variant} size="sm">
                      {order.currentStatus.name || statusInfo.label}
                    </Badge>
                  </div>

                  <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-y border-hairline py-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted">Người mua</dt>
                      <dd className="mt-0.5 truncate">
                        <MaskedBuyerId value={order.customer?.platformBuyerId} />
                      </dd>
                    </div>
                    <div className="min-w-0 text-right">
                      <dt className="text-muted">Tổng tiền</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">
                        {formatVND(order.totalValue)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted">Sản phẩm</dt>
                      <dd className="mt-0.5 text-foreground">{order.items?.length || 0} sản phẩm</dd>
                    </div>
                    <div className="min-w-0 text-right">
                      <dt className="text-muted">Ngày tạo</dt>
                      <dd className="mt-0.5 break-words text-foreground">{formatDate(order.createdAt)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="ghost" size="xs">Xem</Button>
                    </Link>
                    <Link href={`/orders/${order.id}/edit`}>
                      <Button variant="ghost" size="xs">Sửa</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onDeleteClick(order)}
                      className="text-semantic-error"
                    >
                      Xóa
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-hairline-strong bg-surface-card/75 md:block">
        <Table
          className="min-w-[1050px]"
          containerClassName="max-h-[calc(100vh-320px)] min-h-[360px] overflow-auto custom-scrollbar"
        >
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-44 whitespace-nowrap">Mã đơn hàng</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Nền tảng</TableHead>
              <TableHead className="w-52 whitespace-nowrap">Khách hàng</TableHead>
              <TableHead className="w-28 text-center whitespace-nowrap">Sản phẩm</TableHead>
              <TableHead className="w-36 text-right whitespace-nowrap">Tổng tiền</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Trạng thái</TableHead>
              <TableHead className="w-40 whitespace-nowrap">Thời gian tạo</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={8}>
                    <div className="h-6 w-full animate-pulse rounded bg-surface-lifted" />
                  </TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex size-12 items-center justify-center rounded-full bg-surface-lifted text-muted">
                      <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground">Không tìm thấy đơn hàng nào</p>
                    <p className="text-xs text-muted">Thử thay đổi từ khóa hoặc bộ lọc để xem kết quả.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const flashing = isFlashing(order.id);
                const statusInfo = getStatusBadgeVariant(order.currentStatus.code);

                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      'transition-colors duration-500',
                      flashing && 'bg-status-warning/20 animate-pulse',
                    )}
                  >
                    {/* Platform Order ID */}
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="group flex flex-col gap-0.5"
                      >
                        <CopyableOrderId idText={order.platformOrderId} />
                        <span className="text-xs text-muted group-hover:text-primary transition-colors">
                          ID hệ thống: #{order.id}
                        </span>
                      </Link>
                    </TableCell>

                    {/* Platform Name */}
                    <TableCell>
                      <Badge variant="secondary" size="sm">
                        {order.platform.name}
                      </Badge>
                    </TableCell>

                    {/* Customer Info */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <MaskedBuyerId value={order.customer?.platformBuyerId} />
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={getVipBadgeVariant(order.customer?.vipTier?.code)}
                            size="sm"
                          >
                            {order.customer?.vipTier?.name ?? 'Standard'}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    {/* Item Count */}
                    <TableCell className="text-center">
                      <span className="rounded-md bg-surface-lifted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                        {order.items?.length || 0}
                      </span>
                    </TableCell>

                    {/* Total Value */}
                    <TableCell className="text-right font-medium text-foreground">
                      {formatVND(order.totalValue)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge variant={statusInfo.variant} size="sm">
                        {order.currentStatus.name || statusInfo.label}
                      </Badge>
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="text-xs text-muted">
                      {formatDate(order.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/orders/${order.id}`}>
                          <IconButton variant="ghost" size="sm" ariaLabel="Xem chi tiết" tooltip="Xem chi tiết">
                            <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          </IconButton>
                        </Link>
                        <Link href={`/orders/${order.id}/edit`}>
                          <IconButton variant="ghost" size="sm" ariaLabel="Chỉnh sửa" tooltip="Chỉnh sửa">
                            <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </IconButton>
                        </Link>
                        <IconButton
                          variant="ghost"
                          size="sm"
                          ariaLabel="Xóa"
                          onClick={() => onDeleteClick(order)}
                          className="text-muted hover:text-semantic-error"
                          tooltip="Xóa đơn hàng"
                        >
                          <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
