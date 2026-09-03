'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOrder, useOrderLookups, useBreadcrumb } from '@/hooks';
import { Button } from '@/components/atoms';
import { OrderDetailContent } from '@/components/organisms';

export default function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.id);

  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: lookups } = useOrderLookups();

  // Dynamic Breadcrumb
  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: 'Danh sách', href: '/orders' },
      {
        label: order?.platformOrderId
          ? `Đơn hàng #${order.platformOrderId}`
          : `Đơn hàng #${orderId}`,
      },
    ]);
  }, [order?.platformOrderId, orderId, setBreadcrumb]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 w-1/3 rounded-lg bg-surface-lifted" />
        <div className="h-64 rounded-xl bg-surface-lifted" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <h3 className="text-base font-semibold text-foreground">Không tìm thấy đơn hàng</h3>
        <p className="mt-1 text-xs text-muted">
          Đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.
        </p>
        <Link href="/orders" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Quay lại danh sách
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <OrderDetailContent
      order={order}
      lookups={lookups}
      onOrderDeleted={() => router.push('/orders')}
    />
  );
}

