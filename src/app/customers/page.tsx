'use client';

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useAtom } from 'jotai';
import {
  useBreadcrumb,
  useQueryFilters,
  useCustomers,
  useCustomerLookups,
} from '@/hooks';
import {
  CustomerFilterBar,
  CustomerTable,
  UpdateCustomerModal,
} from '@/components/organisms';
import { ErrorBanner } from '@/components/molecules';
import { customerLocalFiltersAtom, initialCustomerLocalFilters } from '@/atoms';
import type { CustomerFilterParams, CustomerWithRelations } from '@/types';

function CustomersListFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-surface-lifted" />
      <div className="h-14 rounded-xl bg-surface-lifted" />
      <div className="h-96 rounded-xl bg-surface-lifted" />
    </div>
  );
}

function CustomersListContent() {
  const { setBreadcrumb } = useBreadcrumb();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerWithRelations | null>(null);

  useEffect(() => {
    setBreadcrumb([{ label: 'Khách hàng' }]);
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

  const [localFilters, setLocalFilters] = useAtom(customerLocalFiltersAtom);

  const filters: CustomerFilterParams = useMemo(
    () => ({
      page: queryFilters.page ?? 1,
      pageSize: queryFilters.pageSize ?? 10,
      keyword: queryFilters.keyword ?? '',
      platformId: localFilters.platformId,
      vipTierId: localFilters.vipTierId,
      minVipScore: localFilters.minVipScore,
      maxVipScore: localFilters.maxVipScore,
      sortBy: localFilters.sortBy,
      sortOrder: localFilters.sortOrder,
    }),
    [
      queryFilters,
      localFilters.platformId,
      localFilters.vipTierId,
      localFilters.minVipScore,
      localFilters.maxVipScore,
      localFilters.sortBy,
      localFilters.sortOrder,
    ],
  );

  const handleFilterChange = useCallback(
    (newFilters: Partial<CustomerFilterParams>) => {
      setLocalFilters((prev) => {
        let updated = prev;
        if ('platformId' in newFilters && newFilters.platformId !== prev.platformId) {
          updated = { ...updated, platformId: newFilters.platformId };
        }
        if ('vipTierId' in newFilters && newFilters.vipTierId !== prev.vipTierId) {
          updated = { ...updated, vipTierId: newFilters.vipTierId };
        }
        if ('minVipScore' in newFilters && newFilters.minVipScore !== prev.minVipScore) {
          updated = { ...updated, minVipScore: newFilters.minVipScore };
        }
        if ('maxVipScore' in newFilters && newFilters.maxVipScore !== prev.maxVipScore) {
          updated = { ...updated, maxVipScore: newFilters.maxVipScore };
        }
        if ('sortBy' in newFilters && newFilters.sortBy !== prev.sortBy) {
          updated = { ...updated, sortBy: newFilters.sortBy };
        }
        if ('sortOrder' in newFilters && newFilters.sortOrder !== prev.sortOrder) {
          updated = { ...updated, sortOrder: newFilters.sortOrder };
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
    setLocalFilters(initialCustomerLocalFilters);
    resetQueryFilters();
  }, [setLocalFilters, resetQueryFilters]);

  const { data, isLoading, error } = useCustomers(filters);
  const { data: lookups } = useCustomerLookups();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Danh bạ & Hồ Sơ Khách Hàng 360°
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Tra cứu, phân khúc RFM, theo dõi LTV và quản lý hồ sơ 360 độ khách hàng VIP trên toàn sàn.
          </p>
        </div>
      </div>

      {(errorMessage || error) && (
        <ErrorBanner
          message={errorMessage || error?.message || 'Có lỗi xảy ra khi tải dữ liệu'}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Filter Bar */}
      <CustomerFilterBar
        filters={filters}
        lookups={lookups}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Customer Table */}
      <CustomerTable
        customers={data?.items || []}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => handleFilterChange({ page })}
        onPageSizeChange={(pageSize) => handleFilterChange({ pageSize, page: 1 })}
        onQuickEdit={(customer) => setCustomerToEdit(customer)}
      />

      {/* In-place Edit Modal */}
      {customerToEdit && (
        <UpdateCustomerModal
          open={Boolean(customerToEdit)}
          customer={customerToEdit}
          onClose={() => setCustomerToEdit(null)}
          onSaveSuccess={() => setCustomerToEdit(null)}
        />
      )}
    </div>
  );
}

export default function CustomersListPage() {
  return (
    <Suspense fallback={<CustomersListFallback />}>
      <CustomersListContent />
    </Suspense>
  );
}
