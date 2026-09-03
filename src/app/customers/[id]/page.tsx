'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useCustomer, useBreadcrumb } from '@/hooks';
import { Button } from '@/components/atoms';
import { CustomerDetailContent } from '@/components/organisms';

export default function CustomerDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const resolvedParams = use(params);
  const customerId = Number(resolvedParams.id);

  const { data: customer, isLoading, error } = useCustomer(customerId);

  const isValidId = !Number.isNaN(customerId) && customerId > 0;

  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: 'Khách hàng', href: '/customers' },
      {
        label: customer?.platformBuyerId
          ? `Hồ sơ ${customer.platformBuyerId}`
          : isValidId
          ? `Khách hàng #${customerId}`
          : 'Hồ sơ khách hàng',
      },
    ]);
  }, [customer?.platformBuyerId, customerId, isValidId, setBreadcrumb]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-xl bg-surface-lifted" />
        <div className="grid grid-cols-4 gap-3">
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
          <div className="h-24 rounded-xl bg-surface-lifted" />
        </div>
        <div className="h-64 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">Không tìm thấy khách hàng</h3>
        <p className="mt-1 text-xs text-muted">
          Hồ sơ khách hàng không tồn tại hoặc đã bị vô hiệu hóa khỏi hệ thống.
        </p>
        <Link href="/customers" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Quay lại danh sách khách hàng
          </Button>
        </Link>
      </div>
    );
  }

  return <CustomerDetailContent customer={customer} />;
}
