'use client';

/**
 * Global Synchronization Indicator Component.
 * Placed in top App Header or bottom floating widget to show ongoing sync jobs across the entire application.
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
        className="flex items-center gap-2 rounded-full border border-badge-teal/30 bg-badge-teal/10 px-3 py-1 text-xs font-medium text-badge-teal-text hover:bg-badge-teal/20 transition-all cursor-pointer shadow-xs animate-in fade-in select-none"
        title="Click to view sync progress"
      >
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-badge-teal opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-badge-teal" />
        </span>

        <span className="font-semibold">Lazada:</span>

        <span>
          {isRunning
            ? `Syncing (${activeBatch.processedOrders}/${activeBatch.totalOrders})`
            : 'Preparing…'}
        </span>

        <span className="font-mono text-xs font-bold text-badge-teal-text">
          {activeBatch.progressPercentage}%
        </span>
      </button>

      {/* Slide-over Right Drawer mounted and controlled via Jotai global state */}
      <SyncProgressDrawer />
    </>
  );
}
