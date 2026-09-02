'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAtom } from 'jotai';
import {
  useBreadcrumb,
  useQueryFilters,
  useOrders,
  useOrderLookups,
  useDeleteOrder,
} from '@/hooks';
import { OrderFilterBar, OrderTable, ConfirmModal } from '@/components/organisms';
import { Button } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import { orderLocalFiltersAtom, initialOrderLocalFilters } from '@/atoms';
import type { OrderFilterParams, OrderWithRelations } from '@/types';

export default function OrdersListPage() {
  const { setBreadcrumb } = useBreadcrumb();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumb([{ label: 'Danh sách' }]);
  }, [setBreadcrumb]);

  const {
    filters: queryFilters,
    setFilters: setQueryFilters,
    resetFilters: resetQueryFilters,
  } = useQueryFilters<{
    page?: number;
    pageSize?: number;
    keyword?: string;
  }>({
    page: 1,
    pageSize: 10,
    keyword: '',
  });

  const [localFilters, setLocalFilters] = useAtom(orderLocalFiltersAtom);

  const filters: OrderFilterParams = useMemo(
    () => ({
      page: queryFilters.page ?? 1,
      pageSize: queryFilters.pageSize ?? 10,
      keyword: queryFilters.keyword ?? '',
      platformId: localFilters.platformId,
      statusId: localFilters.statusId,
    }),
    [queryFilters, localFilters.platformId, localFilters.statusId],
  );

  const handleFilterChange = useCallback(
    (newFilters: Partial<OrderFilterParams>) => {
      setLocalFilters((prev) => {
        let updated = prev;
        if ('platformId' in newFilters && newFilters.platformId !== prev.platformId) {
          updated = { ...updated, platformId: newFilters.platformId };
        }
        if ('statusId' in newFilters && newFilters.statusId !== prev.statusId) {
          updated = { ...updated, statusId: newFilters.statusId };
        }
        return updated;
      });

      const queryUpdates: { page?: number; pageSize?: number; keyword?: string } = {};
      if ('page' in newFilters) queryUpdates.page = newFilters.page;
      if ('pageSize' in newFilters) queryUpdates.pageSize = newFilters.pageSize;
      if ('keyword' in newFilters) queryUpdates.keyword = newFilters.keyword;

      if (Object.keys(queryUpdates).length > 0) {
        setQueryFilters(queryUpdates);
      }
    },
    [setLocalFilters, setQueryFilters],
  );

  const handleResetFilters = useCallback(() => {
    setLocalFilters(initialOrderLocalFilters);
    resetQueryFilters();
  }, [setLocalFilters, resetQueryFilters]);

  const { data, isLoading } = useOrders(filters);
  const { data: lookups } = useOrderLookups();
  const { mutateAsync: deleteOrder, isPending: isDeleting } = useDeleteOrder();

  const [orderToDelete, setOrderToDelete] = useState<OrderWithRelations | null>(null);

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;
    setErrorMessage(null);
    try {
      await deleteOrder({
        id: orderToDelete.id,
        updatedAt: String(orderToDelete.updatedAt),
      });
      setOrderToDelete(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Xóa đơn hàng thất bại');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Danh sách Đơn Hàng
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Xem, tạo mới, chỉnh sửa và quản lý danh mục toàn bộ đơn hàng đa kênh thương mại điện tử.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/orders/new" className="inline-flex shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={
                <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              }
            >
              Đơn hàng mới
            </Button>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Filter Bar */}
      <OrderFilterBar
        filters={filters}
        lookups={lookups}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Table */}
      <OrderTable
        orders={data?.items || []}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => handleFilterChange({ page })}
        onPageSizeChange={(pageSize) => handleFilterChange({ pageSize, page: 1 })}
        onDeleteClick={(order) => setOrderToDelete(order)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(orderToDelete)}
        title="Xác nhận xóa đơn hàng"
        description={
          <span>
            Bạn có chắc chắn muốn xóa đơn hàng <strong>#{orderToDelete?.platformOrderId}</strong>?
            Hành động này sẽ ẩn đơn hàng khỏi hệ thống.
          </span>
        }
        confirmLabel="Xác nhận xóa"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setOrderToDelete(null)}
      />
    </div>
  );
}
