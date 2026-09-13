'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/atoms';
import { SyncBatchListScreen } from '@/components/organisms';
import { useBreadcrumb } from '@/hooks';

export default function LazadaSyncBatchListPage() {
  const { setBreadcrumb } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumb([
      { label: 'Cài đặt' },
      { label: 'Kênh tích hợp', href: '/settings/integrations' },
      { label: 'Lazada Open Platform', href: '/settings/integrations/lazada' },
      { label: 'Lịch sử đồng bộ' },
    ]);
  }, [setBreadcrumb]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <p className="text-caption-uppercase text-status-info">Vận hành tích hợp</p>
          <h1 className="mt-1 text-display-sm text-foreground">Lịch sử đồng bộ đơn hàng</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted">Theo dõi tiến trình bền vững, đối soát kết quả và phục hồi riêng các đơn lỗi đủ điều kiện.</p>
        </div>
        <Link href="/settings/integrations/lazada">
          <Button variant="outline" size="sm">Quay lại Lazada</Button>
        </Link>
      </header>
      <SyncBatchListScreen />
    </div>
  );
}
