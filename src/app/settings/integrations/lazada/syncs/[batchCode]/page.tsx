'use client';

/**
 * Dedicated Page: Detailed Changes for a SyncBatch (/settings/integrations/lazada/syncs/[batchCode])
 * Displays the authoritative diff tree (Order Header -> Items before → after).
 */

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useBreadcrumb, useSyncChangeSummary } from '@/hooks';
import { Button, Badge } from '@/components/atoms';
import { SyncBatchDetailView } from '@/components/organisms';

export default function LazadaSyncBatchDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly batchCode: string }>;
}) {
  const resolvedParams = use(params);
  const batchCode = decodeURIComponent(resolvedParams.batchCode);

  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: 'Cài đặt' },
      { label: 'Kênh tích hợp', href: '/settings/integrations' },
      { label: 'Lazada Open Platform', href: '/settings/integrations/lazada' },
      { label: `Đợt #${batchCode}` },
    ]);
  }, [batchCode, setBreadcrumb]);

  const {
    data: summary,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useSyncChangeSummary(batchCode);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between border-b border-hairline pb-5">
          <div className="space-y-2">
            <div className="h-6 w-64 bg-surface-lifted rounded-lg" />
            <div className="h-4 w-96 bg-surface-lifted rounded-md" />
          </div>
          <div className="h-9 w-32 bg-surface-lifted rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-lifted rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-surface-lifted rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card space-y-4">
        <div className="size-12 rounded-full bg-semantic-error/10 text-semantic-error flex items-center justify-center mx-auto">
          <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Không tìm thấy đợt đồng bộ</h3>
          <p className="text-xs text-muted mt-1">
            {error instanceof Error ? error.message : `Mã đợt [${batchCode}] không tồn tại trong hệ thống.`}
          </p>
        </div>
        <div className="pt-2">
          <Link href="/settings/integrations/lazada">
            <Button variant="outline" size="sm">
              Quay lại danh sách nhật ký
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-channel-lazada-soft border border-channel-lazada-border text-channel-lazada font-bold text-sm shadow-xs">
            <span>LAZ</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-foreground font-mono">
                {summary.batchCode}
              </h1>
              <Badge variant="teal" size="sm">
                Lazada Sync Run
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Bắt đầu: {new Date(summary.startedAt).toLocaleString('vi-VN')}
              {summary.durationMs ? ` · Thời lượng: ${summary.durationMs}ms` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings/integrations/lazada">
            <Button variant="outline" size="sm">
              Quay lại danh sách
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Diff Tree Component */}
      <SyncBatchDetailView
        summary={summary}
        onRefresh={() => refetch()}
        isRefreshing={isRefetching}
      />
    </div>
  );
}
