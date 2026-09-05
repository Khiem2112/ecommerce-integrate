'use client';

/**
 * Modal to configure and execute batch synchronization of orders from Lazada.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Select,
} from '@/components/atoms';
import { useSyncLazadaOrders, useMockSeeds } from '@/hooks';
import type { FetchOrdersParams, SyncResult } from '@/types';

export type SyncRunModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSyncComplete?: (result: SyncResult) => void;
};

export function SyncRunModal({ open, onClose, onSyncComplete }: SyncRunModalProps) {
  const [status, setStatus] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(50);
  const [seed, setSeed] = useState<string>('default');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: seeds } = useMockSeeds();
  const { mutateAsync: syncOrders, isPending: isSyncing } = useSyncLazadaOrders();

  const handleStartSync = async () => {
    setErrorMsg(null);
    try {
      const params: FetchOrdersParams = {
        pageSize,
        ...(status ? { status } : {}),
        ...(seed ? { seed } : {}),
      };

      const result = await syncOrders(params);
      if (onSyncComplete) {
        onSyncComplete(result);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Đồng bộ thất bại');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md p-6 space-y-5">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex size-7 items-center justify-center rounded-lg bg-surface-lifted border border-hairline text-foreground">
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <DialogTitle>Đồng Bộ Đơn Hàng Lazada</DialogTitle>
          </div>
          <DialogDescription>
            Kéo dữ liệu đơn hàng từ máy chủ Lazada / Mock Server và đồng bộ vào kho dữ liệu hệ thống.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-lg bg-semantic-error/10 border border-semantic-error/20 p-3 text-xs text-semantic-error">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Mock Seed Dataset Selector */}
          {seeds && seeds.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="seed-select" className="font-semibold text-foreground flex items-center justify-between">
                <span>Bộ dữ liệu Mock Test (Seed)</span>
                <span className="text-[10px] text-muted font-normal">Chế độ Mock Server</span>
              </label>
              <Select
                id="seed-select"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              >
                {seeds.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name} ({s.orderCount} đơn) — {s.description}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label htmlFor="status-select" className="font-semibold text-foreground">
              Lọc theo trạng thái đơn sàn
            </label>
            <Select
              id="status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="unpaid">Chờ thanh toán (Unpaid)</option>
              <option value="ready_to_ship">Sẵn sàng giao (Ready to Ship)</option>
              <option value="shipped">Đang giao hàng (Shipped)</option>
              <option value="delivered">Đã giao thành công (Delivered)</option>
              <option value="canceled">Đã hủy (Canceled)</option>
              <option value="returned">Đổi trả / Hoàn tiền (Returned)</option>
            </Select>
          </div>

          {/* Page Limit */}
          <div className="space-y-1.5">
            <label htmlFor="limit-select" className="font-semibold text-foreground">
              Số lượng đơn tối đa mỗi đợt
            </label>
            <Select
              id="limit-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={20}>20 đơn hàng</option>
              <option value={50}>50 đơn hàng (Khuyến nghị)</option>
              <option value={100}>100 đơn hàng</option>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-hairline">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSyncing}
          >
            Hủy bỏ
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSyncing}
            onClick={handleStartSync}
            icon={
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
          >
            {isSyncing ? 'Đang đồng bộ...' : 'Bắt đầu đồng bộ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
