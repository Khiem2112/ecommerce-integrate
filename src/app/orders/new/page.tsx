'use client';

import { useEffect } from 'react';
import { useBreadcrumb, useOrderLookups } from '@/hooks';
import { OrderForm } from '@/components/organisms';

export default function NewOrderPage() {
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: 'Danh sách', href: '/orders' },
      { label: 'Tạo đơn hàng mới' },
    ]);
  }, [setBreadcrumb]);

  const { data: lookups } = useOrderLookups();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <OrderForm mode="NEW" lookups={lookups} />
    </div>
  );
}
