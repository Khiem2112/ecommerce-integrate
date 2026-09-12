'use client';

/**
 * Global Synchronization Indicator Component.
 * Placed in top App Header to show ongoing sync jobs across the entire application.
 * Clicking the indicator opens the Right-Side SyncProgressDrawer.
 */

import React from 'react';
import { useSetAtom } from 'jotai';
import { openSyncDrawerAtom } from '@/atoms';
import { useActiveSyncBatch } from '@/hooks';
import { SyncProgressDrawer } from '@/components/organisms/Integrations/SyncProgressDrawer';

export function GlobalSyncIndicator() {
  const { data: activeBatch } = useActiveSyncBatch('lazada');
  const openSyncDrawer = useSetAtom(openSyncDrawerAtom);

  // If no active batch, don't render anything
  if (!activeBatch || (activeBatch.status !== 'running' && activeBatch.status !== 'queued')) {
    return null;
  }

  const isRunning = activeBatch.status === 'running';

  const handleClick = () => {
    openSyncDrawer({
      batchCode: activeBatch.batchCode,
      platformName: 'Lazada Open Platform',
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-all cursor-pointer shadow-xs animate-in fade-in"
        title="Nhấn để xem chi tiết tiến trình đồng bộ đơn hàng"
      >
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-teal-500" />
        </span>

        <span className="font-semibold">Lazada:</span>

        <span>
          {isRunning
            ? `Đang nạp (${activeBatch.processedOrders}/${activeBatch.totalOrders})`
            : 'Đang chuẩn bị...'}
        </span>

        <span className="font-mono text-[11px] font-bold text-teal-800 dark:text-teal-200">
          {activeBatch.progressPercentage}%
        </span>
      </button>

      {/* Slide-over Right Drawer mounted and controlled via Jotai global state */}
      <SyncProgressDrawer />
    </>
  );
}
