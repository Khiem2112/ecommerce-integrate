'use client';

/**
 * Modal to configure and execute batch synchronization of orders from Lazada by Date Range.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  DateTimePicker,
  Badge,
} from '@/components/atoms';
import { OrderStatusFilter } from '@/components/molecules';
import { useSyncLazadaOrders, usePreflightLazadaSync, useDebounce } from '@/hooks';
import type { FetchOrdersParams, SyncResult } from '@/types';

export type SyncRunModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSyncComplete?: (result: SyncResult) => void;
};

const getInitialDateRange = () => {
  const end = new Date();
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

export function SyncRunModal({ open, onClose, onSyncComplete }: SyncRunModalProps) {
  const initialRange = useMemo(() => getInitialDateRange(), []);
  const [createdAfter, setCreatedAfter] = useState<Date | undefined>(initialRange.start);
  const [createdBefore, setCreatedBefore] = useState<Date | undefined>(initialRange.end);
  const [status, setStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyPreset = useCallback((days: number) => {
    const end = new Date();
    if (days === 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      setCreatedAfter(start);
      setCreatedBefore(end);
    } else {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      setCreatedAfter(start);
      setCreatedBefore(end);
    }
  }, []);

  // Debounced params for preflight discovery count
  const syncParams = useMemo<FetchOrdersParams>(() => ({
    createdAfter,
    createdBefore,
    ...(status ? { status } : {}),
  }), [createdAfter, createdBefore, status]);

  const debouncedParams = useDebounce(syncParams, 400);

  const { data: preflightData, isLoading: isPreflightLoading } = usePreflightLazadaSync(debouncedParams, open);
  const { mutateAsync: syncOrders, isPending: isSyncing } = useSyncLazadaOrders();

  const handleStartSync = async () => {
    setErrorMsg(null);
    if (!createdAfter || !createdBefore) {
      setErrorMsg('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.');
      return;
    }

    if (createdAfter > createdBefore) {
      setErrorMsg('Thời gian bắt đầu (created_after) không được lớn hơn thời gian kết thúc (created_before).');
      return;
    }

    try {
      const params: FetchOrdersParams = {
        createdAfter,
        createdBefore,
        ...(status ? { status } : {}),
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
      <DialogContent className="max-w-lg p-6 space-y-5">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex size-7 items-center justify-center rounded-lg bg-channel-lazada-soft border border-channel-lazada-border text-channel-lazada font-bold text-xs shadow-xs">
              <span>LAZ</span>
            </div>
            <DialogTitle>Đồng Bộ Đơn Hàng Lazada</DialogTitle>
          </div>
          <DialogDescription>
            Đồng bộ đơn hàng từ Lazada vào kho dữ liệu hệ thống theo khoảng thời gian được chọn.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-lg bg-semantic-error/10 border border-semantic-error/20 p-3 text-xs text-semantic-error">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Quick Range Presets */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground block">
              Chọn nhanh khoảng thời gian
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleApplyPreset(0)}
              >
                Hôm nay
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleApplyPreset(7)}
              >
                7 ngày qua
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleApplyPreset(30)}
              >
                30 ngày qua
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => handleApplyPreset(90)}
              >
                90 ngày qua
              </Button>
            </div>
          </div>

          {/* 2 DateTimePickers (created_after & created_before) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateTimePicker
              label="Từ thời điểm (created_after)"
              value={createdAfter}
              onChange={(d) => setCreatedAfter(d)}
              placeholder="Chọn ngày & giờ bắt đầu…"
              maxDate={createdBefore}
              size="md"
            />
            <DateTimePicker
              label="Đến thời điểm (created_before)"
              value={createdBefore}
              onChange={(d) => setCreatedBefore(d)}
              placeholder="Chọn ngày & giờ kết thúc…"
              minDate={createdAfter}
              size="md"
            />
          </div>

          {/* Packaged Status Filter Component */}
          <OrderStatusFilter
            value={status}
            onChange={setStatus}
            label="Lọc theo trạng thái đơn hàng"
            size="md"
          />

          {/* Preflight Discovery Banner */}
          <div className="rounded-xl border border-hairline bg-surface-lifted/60 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted">Ước tính số đơn trên sàn:</span>
              {isPreflightLoading ? (
                <span className="text-xs text-muted animate-pulse font-medium">Đang kiểm tra...</span>
              ) : (
                <span className="text-xs font-bold font-mono text-foreground">
                  ~{preflightData?.totalCount ?? 0} đơn hàng
                </span>
              )}
            </div>
            <Badge variant="teal" size="xs">
              Khám phá tự động
            </Badge>
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
