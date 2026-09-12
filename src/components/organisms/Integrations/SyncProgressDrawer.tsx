'use client';

/**
 * Sync Progress Right-Side Drawer (Slide-over Sheet).
 * Displays real-time synchronization progress, live recent orders feed with line items,
 * and quick navigation/cancel controls without interrupting the user's current workflow.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAtom } from 'jotai';
import { Badge, Button, ProgressBar, Chip, StatusBadge } from '@/components/atoms';
import { syncDrawerAtom } from '@/atoms';
import { formatVND } from '@/utils';
import { cn } from '@/lib/cn';
import { useSyncBatchProgress, useCancelSyncBatch } from '@/hooks';

export type SyncProgressDrawerProps = {
  readonly isOpen?: boolean;
  readonly onClose?: () => void;
  readonly batchCode?: string | null;
  readonly platformName?: string;
};

export function SyncProgressDrawer({
  isOpen: propIsOpen,
  onClose: propOnClose,
  batchCode: propBatchCode,
  platformName: propPlatformName,
}: SyncProgressDrawerProps = {}) {
  const [globalDrawer, setGlobalDrawer] = useAtom(syncDrawerAtom);

  const isOpen = propIsOpen !== undefined ? propIsOpen : globalDrawer.isOpen;
  const onClose = propOnClose ?? (() => setGlobalDrawer((prev) => ({ ...prev, isOpen: false })));
  const batchCode = propBatchCode !== undefined ? propBatchCode : globalDrawer.batchCode;
  const platformName = propPlatformName ?? globalDrawer.platformName ?? 'Lazada Open Platform';
  const { data: progress, isLoading } = useSyncBatchProgress(batchCode, isOpen);
  const { mutateAsync: cancelBatch, isPending: isCancelling } = useCancelSyncBatch();
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleCancel = async () => {
    if (!batchCode) return;
    try {
      await cancelBatch(batchCode);
    } catch {
      // Handled in mutation
    }
  };

  const isRunning = progress?.status === 'running' || progress?.status === 'queued';
  const recentOrders = progress?.recentOrders ?? [];

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-canvas-deep/50 backdrop-blur-xs transition-opacity duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby="sync-drawer-description"
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-hairline bg-surface-card shadow-elevated transition-transform duration-300 ease-in-out outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline p-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-channel-lazada-soft border border-channel-lazada-border text-channel-lazada font-bold text-xs">
                LAZ
              </div>
              <div>
                <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                  {platformName}
                </DialogPrimitive.Title>
                <p id="sync-drawer-description" className="text-[11px] font-mono text-muted">
                  {batchCode ? `#${batchCode.slice(-14)}` : 'Tiến trình đồng bộ'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={progress?.status} />
              <DialogPrimitive.Close
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-lifted hover:text-foreground transition-colors cursor-pointer"
              >
                <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Progress Metrics Panel */}
          <div className="border-b border-hairline bg-surface-lifted/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                {isRunning ? 'Đang nạp đơn hàng...' : progress?.status === 'completed' ? 'Đã hoàn tất đồng bộ' : 'Tiến trình'}
              </span>
              <Badge variant="outline" size="sm" className="font-mono font-bold">
                {progress?.processedOrders ?? 0} / {progress?.totalOrders ?? 0} ({progress?.progressPercentage ?? 0}%)
              </Badge>
            </div>

            {/* Progress Bar */}
            <ProgressBar
              value={progress?.progressPercentage ?? 0}
              status={progress?.status}
            />

            {/* 4 Mini Stat Chips */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Chip
                label="Mới"
                prefix="+"
                value={progress?.createdCount ?? 0}
                variant="success"
              />
              <Chip
                label="Cập nhật"
                prefix="~"
                value={progress?.updatedCount ?? 0}
                variant="warning"
              />
              <Chip
                label="Giữ nguyên"
                prefix="="
                value={progress?.unchangedCount ?? 0}
                variant="muted"
              />
              <Chip
                label="Lỗi"
                prefix="!"
                value={progress?.failedCount ?? 0}
                variant="error"
              />
            </div>

            {isRunning && (
              <p className="text-[11px] text-muted text-center italic">
                Tiến trình đang chạy ngầm an toàn. Bạn có thể đóng cửa sổ này bất cứ lúc nào.
              </p>
            )}
          </div>

          {/* Live Recent Orders Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Đơn hàng vừa đồng bộ ({recentOrders.length})
              </span>
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted font-medium">
                  <span className="size-1.5 rounded-full bg-status-success animate-ping" />
                  Đang ghi dữ liệu...
                </span>
              )}
            </div>

            {isLoading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-16 rounded-xl bg-surface-lifted" />
                <div className="h-16 rounded-xl bg-surface-lifted" />
                <div className="h-16 rounded-xl bg-surface-lifted" />
              </div>
            )}

            {!isLoading && recentOrders.length === 0 && (
              <div className="rounded-xl border border-hairline bg-surface-lifted/30 p-8 text-center text-xs text-muted">
                {isRunning
                  ? 'Đang kết nối sàn Lazada để nạp các đơn hàng đầu tiên...'
                  : 'Chưa có đơn hàng nào được ghi nhận trong đợt này.'}
              </div>
            )}

            {recentOrders.map((order) => {
              const isExpanded = Boolean(expandedOrders[order.externalOrderId]);

              return (
                <div
                  key={order.externalOrderId}
                  className="rounded-xl border border-hairline bg-surface p-3 space-y-2 text-xs shadow-xs transition hover:border-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">
                          {order.orderNumber}
                        </span>
                        <OutcomeBadge outcome={order.outcome} />
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {order.buyerName} · Trạng thái: <span className="capitalize">{order.status}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-foreground">
                        {formatVND(order.totalAmount)}
                      </span>
                      <p className="text-[10px] text-muted mt-0.5">
                        {new Date(order.processedAt).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  {/* Line Items Expansion */}
                  {order.items.length > 0 && (
                    <div className="border-t border-hairline pt-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(order.externalOrderId)}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-focus cursor-pointer font-medium"
                      >
                        <span>
                          {isExpanded ? 'Thu gọn' : `Xem ${order.items.length} sản phẩm`}
                        </span>
                        <svg
                          aria-hidden="true"
                          className={cn('size-3 transition-transform', isExpanded && 'rotate-180')}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 rounded-lg bg-surface-lifted/50 p-2.5">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                              <span className="truncate max-w-[220px] text-foreground" title={it.name}>
                                • {it.name}
                              </span>
                              <div className="shrink-0 font-mono text-muted text-right">
                                x{it.quantity} · {formatVND(it.unitPrice)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-hairline p-4 bg-surface-card">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                isLoading={isCancelling}
                className="text-xs text-semantic-error border-semantic-error/30 hover:bg-semantic-error/10"
              >
                Hủy đợt đồng bộ
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Đóng
              </Button>
            )}

            <Link href="/settings/integrations/lazada" onClick={onClose}>
              <Button variant="primary" size="sm" className="text-xs gap-1">
                <span>Chi tiết đồng bộ</span>
                <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}


function OutcomeBadge({ outcome }: { readonly outcome: 'created' | 'updated' | 'unchanged' | 'failed' }) {
  switch (outcome) {
    case 'created':
      return <Badge variant="success" size="xs">+ Mới</Badge>;
    case 'updated':
      return <Badge variant="warning" size="xs">~ Cập nhật</Badge>;
    case 'unchanged':
      return <Badge variant="secondary" size="xs">= Không đổi</Badge>;
    case 'failed':
      return <Badge variant="error" size="xs">! Lỗi</Badge>;
  }
}
