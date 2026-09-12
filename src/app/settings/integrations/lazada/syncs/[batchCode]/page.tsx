'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/atoms';
import { SyncBatchDetailScreen } from '@/components/organisms';
import { useBreadcrumb, useSyncBatchDetail } from '@/hooks';

export default function LazadaSyncBatchDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly batchCode: string }>;
}) {
  const resolvedParams = use(params);
  const batchCode = decodeURIComponent(resolvedParams.batchCode);
  const { setBreadcrumb } = useBreadcrumb();
  const detailQuery = useSyncBatchDetail(batchCode);

  useEffect(() => {
    const detail = detailQuery.data;
    setBreadcrumb([
      { label: 'Cài đặt' },
      { label: 'Kênh tích hợp', href: '/settings/integrations' },
      { label: 'Lazada Open Platform', href: '/settings/integrations/lazada' },
      { label: 'Lịch sử đồng bộ', href: '/settings/integrations/lazada/syncs' },
      ...(detail?.parentBatchCode
        ? [{ label: detail.parentBatchCode, href: `/settings/integrations/lazada/syncs/${encodeURIComponent(detail.parentBatchCode)}` }]
        : []),
      { label: detail?.parentBatchCode ? `Thử lại ${batchCode}` : batchCode },
    ]);
  }, [batchCode, detailQuery.data, setBreadcrumb]);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-5 motion-safe:animate-pulse" aria-busy="true" aria-label="Đang tải chi tiết đợt đồng bộ">
        <div className="h-20 rounded-2xl bg-surface-strong" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 rounded-xl bg-surface-strong" />)}
        </div>
        <div className="h-96 rounded-2xl bg-surface-strong" />
      </div>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <div className="rounded-2xl border border-semantic-error/30 bg-surface-card p-10 text-center shadow-card" role="alert">
        <h1 className="text-base font-semibold text-foreground">Không thể mở đợt đồng bộ</h1>
        <p className="mt-1 text-xs text-muted">{detailQuery.error?.message ?? `Không tìm thấy đợt ${batchCode}.`}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" onClick={() => detailQuery.refetch()}>Thử tải lại</Button>
          <Link href="/settings/integrations/lazada/syncs"><Button variant="outline" size="sm">Quay lại lịch sử</Button></Link>
        </div>
      </div>
    );
  }

  return <SyncBatchDetailScreen detail={detailQuery.data} />;
}
