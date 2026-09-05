'use client';

/**
 * Integration Card for Marketplace Platform Overview (Lazada, Shopify, TikTok Shop).
 */

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@/components/atoms';
import { ConnectionStatus } from './ConnectionStatus';
import { SyncRunModal } from './SyncRunModal';
import { useCheckConnectionHealth } from '@/hooks';
import type { IntegrationSummary, SyncResult } from '@/types';

export type IntegrationCardProps = {
  readonly summary: IntegrationSummary;
  readonly onSyncComplete?: (result: SyncResult) => void;
};

export function IntegrationCard({ summary, onSyncComplete }: IntegrationCardProps) {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const { mutateAsync: checkHealth, isPending: isCheckingHealth } = useCheckConnectionHealth(summary.platform);

  const handleProbeHealth = async () => {
    try {
      await checkHealth();
    } catch {
      // Handled by hook error state
    }
  };

  const isMock = summary.environment === 'mock';

  return (
    <>
      <div className="rounded-2xl border border-hairline bg-surface-card p-5 sm:p-6 shadow-card transition-all hover:border-hairline-strong hover:shadow-soft flex flex-col justify-between gap-5">
        {/* Header: Platform & Health */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-channel-lazada-soft border border-channel-lazada-border text-channel-lazada font-bold text-sm shadow-xs">
              <span className="tracking-tight">LAZ</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  Lazada Việt Nam
                </h3>
                <Badge
                  variant={isMock ? 'teal' : 'primary'}
                  size="xs"
                >
                  {summary.environment.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {summary.shopName || 'Lazada Mall Official Store'}
              </p>
            </div>
          </div>

          <ConnectionStatus
            status={summary.status}
            latencyMs={summary.latencyMs}
          />
        </div>

        {/* Status Metrics Box */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl bg-surface-lifted border border-hairline p-3 text-xs">
          <div>
            <span className="text-muted block text-[11px] mb-0.5">Kiểm tra kết nối</span>
            <span className="font-medium text-foreground">
              {summary.lastCheckedAt
                ? new Date(summary.lastCheckedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Chưa kiểm tra'}
            </span>
          </div>

          <div>
            <span className="text-muted block text-[11px] mb-0.5">Đồng bộ gần nhất</span>
            <span className="font-medium text-foreground">
              {summary.lastSyncedAt
                ? new Date(summary.lastSyncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                : 'Chưa đồng bộ'}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-muted block text-[11px] mb-0.5">Đơn hàng / Lỗi</span>
            <span className="font-medium text-foreground">
              <strong className="text-foreground">{summary.totalOrders ?? 0}</strong> đơn ·{' '}
              <span className={summary.failedRecords ? 'text-semantic-error font-semibold' : 'text-muted'}>
                {summary.failedRecords ?? 0} lỗi
              </span>
            </span>
          </div>
        </div>

        {/* Error alert if any */}
        {summary.errorMessage && summary.status === 'error' && (
          <div className="rounded-lg bg-semantic-error/10 border border-semantic-error/20 px-3 py-2 text-xs text-semantic-error flex items-center gap-2">
            <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span className="truncate">{summary.errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-hairline">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              isLoading={isCheckingHealth}
              onClick={handleProbeHealth}
              icon={
                <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                </svg>
              }
            >
              Kiểm tra kết nối
            </Button>

            <Button
              variant="secondary"
              size="xs"
              onClick={() => setIsSyncModalOpen(true)}
              icon={
                <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              }
            >
              Đồng bộ ngay
            </Button>
          </div>

          <Link href="/settings/integrations/lazada" className="inline-flex">
            <Button variant="ghost" size="xs" rightIcon={
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            }>
              Cấu hình & Nhật ký
            </Button>
          </Link>
        </div>
      </div>

      <SyncRunModal
        open={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={onSyncComplete}
      />
    </>
  );
}
