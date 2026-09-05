'use client';

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAtom } from 'jotai';
import {
  useBreadcrumb,
  useQueryFilters,
  useOrders,
  useOrderLookups,
  useDeleteOrder,
} from '@/hooks';
import { OrderFilterBar, OrderTable, ConfirmModal, SyncRunModal, SyncResultSummary } from '@/components/organisms';
import { Button } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import { orderLocalFiltersAtom, initialOrderLocalFilters } from '@/atoms';
import type { OrderFilterParams, OrderWithRelations, SyncResult } from '@/types';

function OrdersListFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-surface-lifted" />
      <div className="h-14 rounded-xl bg-surface-lifted" />
      <div className="h-96 rounded-xl bg-surface-lifted" />
    </div>
  );
}

function OrdersListContent() {
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
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSyncModalOpen(true)}
            icon={
              <svg aria-hidden="true" className="size-3.5 text-status-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
          >
            Đồng bộ Lazada
          </Button>

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

      {syncResult && (
        <SyncResultSummary
          result={syncResult}
          onDismiss={() => setSyncResult(null)}
        />
      )}

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

      {/* Lazada Batch Sync Modal */}
      <SyncRunModal
        open={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={(res) => setSyncResult(res)}
      />
    </div>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense fallback={<OrdersListFallback />}>
      <OrdersListContent />
    </Suspense>
  );
}
