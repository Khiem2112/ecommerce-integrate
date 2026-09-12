'use client';

import { useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import { activeDetailTabAtom, selectedSyncOrderIdAtom } from '@/atoms';
import { useSyncBatchDetailProgress } from '@/hooks';
import type { SyncBatchDetail, SyncOrderChangeType, SyncOrderListItem } from '@/types';
import { SyncBatchDetailHeader } from './SyncBatchDetailHeader';
import { SyncBatchProgressBar } from './SyncBatchProgressBar';
import { SyncBatchResultSummaryCards } from './SyncBatchResultSummaryCards';
import { SyncBatchSidePanel } from './SyncBatchSidePanel';
import { SyncOrderDiffPanel } from './SyncOrderDiffPanel';
import { SyncOrderTabContent } from './SyncOrderTabContent';
import { SyncOrderTabs } from './SyncOrderTabs';

function getDefaultTab(detail: SyncBatchDetail): SyncOrderChangeType {
  if (detail.updatedCount > 0) return 'updated';
  if (detail.createdCount > 0) return 'created';
  if (detail.unchangedCount > 0) return 'unchanged';
  return detail.failedCount > 0 ? 'failed' : 'updated';
}

type SyncBatchDetailScreenProps = { readonly detail: SyncBatchDetail };

export function SyncBatchDetailScreen({ detail }: SyncBatchDetailScreenProps) {
  const [activeTab, setActiveTab] = useAtom(activeDetailTabAtom);
  const [selectedOrderId, setSelectedOrderId] = useAtom(selectedSyncOrderIdAtom);
  const progress = useSyncBatchDetailProgress(detail.id, detail.status === 'queued' || detail.status === 'running');

  useEffect(() => {
    setActiveTab(getDefaultTab(detail));
    setSelectedOrderId(null);
    return () => setSelectedOrderId(null);
  }, [detail, setActiveTab, setSelectedOrderId]);

  const handleSelect = useCallback((order: SyncOrderListItem) => {
    setActiveTab(order.changeType);
    setSelectedOrderId(order.externalOrderId);
  }, [setActiveTab, setSelectedOrderId]);
  const handleTabChange = useCallback((tab: SyncOrderChangeType) => setActiveTab(tab), [setActiveTab]);
  const isRunning = progress.data?.status === 'running' || progress.data?.status === 'queued';
  const liveDetail = progress.data ? { ...detail, ...progress.data } : detail;

  return (
    <div className="space-y-5">
      <SyncBatchDetailHeader detail={detail} />
      {isRunning && progress.data && <SyncBatchProgressBar progress={progress.data} />}
      {progress.error && <p role="alert" className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3 text-xs text-semantic-error">Không thể cập nhật tiến trình trực tiếp. Dữ liệu đã ghi vẫn được bảo toàn.</p>}
      {detail.status === 'cancelled' && <p className="rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-status-warning">Đợt đã bị hủy an toàn. Danh sách chỉ gồm những đơn đã xử lý xong trước khi dừng.</p>}
      <SyncBatchResultSummaryCards detail={liveDetail} progress={progress.data} />
      <div className="flex items-start gap-4">
        <SyncBatchSidePanel currentBatch={liveDetail} />
        <main className="min-w-0 flex-1">
          <SyncOrderTabs detail={liveDetail} activeTab={activeTab} onChange={handleTabChange} />
          <SyncOrderTabContent key={activeTab} batchId={detail.id} activeTab={activeTab} onSelect={handleSelect} />
        </main>
      </div>
      <SyncOrderDiffPanel batchId={detail.id} selectedOrderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
