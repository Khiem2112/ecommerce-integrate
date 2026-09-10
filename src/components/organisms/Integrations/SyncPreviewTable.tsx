'use client';

/**
 * Quick Preview Table for Lazada Orders.
 * Displays preview rows with in-memory diff badges ('new' | 'existing_changed' | 'existing_unchanged').
 * Supports lazy-loading order items per row via IndexedDB-cached hook.
 */

import React, { useState } from 'react';
import {
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Select,
} from '@/components/atoms';
import { formatVND } from '@/utils';
import { useOrderItemsPreview } from '@/hooks';

import type { OrderPreviewPage, OrderPreviewRow, OrderPreviewItemRow } from '@/types';

type SyncPreviewTableProps = {
  readonly platform?: string;
  readonly platformName?: string;
  readonly data?: OrderPreviewPage | null;
  readonly isLoading: boolean;
  readonly isFetching?: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (newPage: number) => void;
  readonly onPageSizeChange?: (newPageSize: number) => void;
  readonly onForceRefresh?: () => void;
};

export function SyncPreviewTable({
  platform = 'lazada',
  platformName = 'Lazada',
  data,
  isLoading,
  isFetching = false,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onForceRefresh,
}: SyncPreviewTableProps) {

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const handleToggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-6 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-56 rounded bg-surface-lifted" />
          <div className="h-8 w-28 rounded bg-surface-lifted" />
        </div>
        <div className="h-48 rounded-lg bg-surface-lifted" />
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-8 text-center shadow-card space-y-2">
        <p className="text-sm font-medium text-foreground">Không tìm thấy đơn hàng nào trong khoảng thời gian này.</p>
        <p className="text-xs text-muted">Vui lòng điều chỉnh lại bộ lọc ngày hoặc trạng thái để xem trước.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden shadow-card space-y-3 p-4">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-foreground">
            Bản xem trước ({totalCount.toLocaleString('vi-VN')} đơn trên {platformName})
          </span>

          {data?.cachedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-lifted px-2.5 py-0.5 text-[11px] font-medium text-muted border border-hairline">
              <span className="size-1.5 rounded-full bg-status-success" />
              Đệm IndexedDB: {new Date(data.cachedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {isFetching && (
            <span className="text-[11px] text-muted animate-pulse">Đang cập nhật...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onForceRefresh && (
            <Button
              variant="outline"
              size="xs"
              onClick={onForceRefresh}
              disabled={isFetching}
              className="gap-1.5 text-xs text-muted hover:text-foreground"
            >
              <svg
                aria-hidden="true"
                className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Làm mới từ {platformName}
            </Button>
          )}

          {onPageSizeChange && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>Hiển thị:</span>
              <div className="w-16">
                <Select
                  size="sm"
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-7 text-xs py-0.5 pl-2 pr-6"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Mã đơn hàng</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Trạng thái sàn</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead className="text-center">Đối soát cục bộ</TableHead>
              <TableHead>Ngày tạo sàn</TableHead>
              <TableHead className="text-right">Chi tiết</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const isExpanded = expandedOrderId === row.externalOrderId;

              return (
                <React.Fragment key={row.externalOrderId}>
                  <TableRow className={isExpanded ? 'bg-surface-lifted/40' : undefined}>
                    <TableCell className="w-8 text-center p-2">
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(row.externalOrderId)}
                        className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-lifted transition-colors"
                        title={isExpanded ? 'Thu gọn sản phẩm' : 'Mở xem sản phẩm'}
                      >
                        <svg
                          aria-hidden="true"
                          className={`size-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </TableCell>

                    <TableCell className="font-mono text-xs font-medium text-foreground">
                      {row.orderNumber}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <div className="font-medium text-foreground">
                          {row.buyer.firstName} {row.buyer.lastName}
                        </div>
                        {row.buyer.phone && (
                          <div className="text-[11px] text-muted font-mono">{row.buyer.phone}</div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium bg-surface-lifted text-muted border border-hairline capitalize">
                        {row.status}
                      </span>
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatVND(row.totalAmount)}
                    </TableCell>


                    <TableCell className="text-center">
                      <PreviewStatusBadge status={row.previewStatus} diff={row.diffSummary} />
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-xs text-muted">
                      {new Date(row.createdAt).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleToggleExpand(row.externalOrderId)}
                        className="text-xs text-primary hover:text-primary-focus"
                      >
                        {isExpanded ? 'Đóng items' : 'Xem items'}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Lazy Items Row */}
                  {isExpanded && (
                    <TableRow className="bg-surface-lifted/20">
                      <TableCell colSpan={8} className="p-0">
                        <LazyOrderItemsPanel
                          platform={platform}
                          externalOrderId={row.externalOrderId}
                          platformName={platformName}
                        />
                      </TableCell>
                    </TableRow>
                  )}

                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t border-hairline pt-3 text-xs text-muted">
        <div>
          Trang <span className="font-medium text-foreground">{page}</span> / {totalPages} (tổng {totalCount.toLocaleString('vi-VN')} đơn)
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            Trang trước
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Trang sau
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Status Badge helper showing diff information if changed.
 */
function PreviewStatusBadge({
  status,
  diff,
}: {
  readonly status: OrderPreviewRow['previewStatus'];
  readonly diff?: OrderPreviewRow['diffSummary'];
}) {
  if (status === 'new') {
    return (
      <Badge variant="success" size="xs">
        + Đơn mới
      </Badge>
    );
  }

  if (status === 'existing_changed') {
    const changedFields = diff ? Object.keys(diff) : [];
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <Badge variant="warning" size="xs">
          ~ Có thay đổi
        </Badge>
        {changedFields.length > 0 && (
          <span className="text-[10px] text-muted font-mono" title={JSON.stringify(diff)}>
            ({changedFields.join(', ')})
          </span>
        )}
      </div>
    );
  }

  return (
    <Badge variant="secondary" size="xs">
      = Không đổi
    </Badge>
  );
}

/**
 * Lazy-loads line items on-demand when an order row is expanded by the user.
 * Reads from browser cache to protect channel API limits.
 */
function LazyOrderItemsPanel({
  platform,
  externalOrderId,
  platformName,
}: {
  readonly platform: string;
  readonly externalOrderId: string;
  readonly platformName: string;
}) {
  const { data: items, isLoading, isError } = useOrderItemsPreview(platform, externalOrderId, true);

  if (isLoading) {
    return (
      <div className="p-4 bg-surface-lifted/30 space-y-2 animate-pulse border-y border-hairline">
        <div className="h-4 w-40 rounded bg-surface-lifted" />
        <div className="h-12 rounded bg-surface-lifted" />
      </div>
    );
  }

  if (isError || !items || items.length === 0) {
    return (
      <div className="p-4 bg-surface-lifted/30 text-center text-xs text-muted border-y border-hairline">
        Không có thông tin chi tiết sản phẩm hoặc không thể tải từ {platformName}.
      </div>
    );
  }


  return (
    <div className="p-4 bg-surface-lifted/30 border-y border-hairline">
      <div className="mb-2 text-xs font-semibold text-foreground">
        Danh sách sản phẩm ({items.length} món):
      </div>

      <div className="rounded-lg border border-hairline bg-surface overflow-hidden">
        <Table className="w-full text-xs">
          <TableHeader className="bg-surface-lifted/50 text-muted font-medium">
            <TableRow>
              <TableHead className="py-2 px-3">Tên sản phẩm</TableHead>
              <TableHead className="py-2 px-3">SKU</TableHead>
              <TableHead className="py-2 px-3 text-right">Đơn giá</TableHead>
              <TableHead className="py-2 px-3 text-center">Số lượng</TableHead>
              <TableHead className="py-2 px-3 text-right">Giá thanh toán</TableHead>
              <TableHead className="py-2 px-3 text-center">Trạng thái item</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: OrderPreviewItemRow) => (
              <TableRow key={item.externalItemId} className="hover:bg-surface-lifted/30">
                <TableCell className="py-2 px-3 font-medium text-foreground max-w-xs truncate">
                  {item.name}
                </TableCell>
                <TableCell className="py-2 px-3 font-mono text-[11px] text-muted">
                  {item.sku || '—'}
                </TableCell>
                <TableCell className="py-2 px-3 text-right font-mono text-muted">
                  {formatVND(item.unitPrice)}
                </TableCell>
                <TableCell className="py-2 px-3 text-center font-mono font-medium text-foreground">
                  x{item.quantity}
                </TableCell>
                <TableCell className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                  {formatVND(item.paidPrice)}
                </TableCell>
                <TableCell className="py-2 px-3 text-center">
                  <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface-lifted text-muted border border-hairline">
                    {item.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
