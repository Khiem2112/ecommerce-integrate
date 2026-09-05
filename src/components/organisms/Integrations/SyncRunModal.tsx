'use client';

/**
 * Modal to configure and execute batch synchronization of orders from Lazada by Date Range.
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Select,
  DateRangePicker,
  Badge,
} from '@/components/atoms';
import { useSyncLazadaOrders, usePreflightLazadaSync, useDebounce } from '@/hooks';
import type { FetchOrdersParams, SyncResult } from '@/types';

export type SyncRunModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSyncComplete?: (result: SyncResult) => void;
};

const formatDateToInput = (d: Date): string => d.toISOString().split('T')[0];

const getInitialDates = (days: number) => {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return {
    from: formatDateToInput(start),
    to: formatDateToInput(end),
  };
};

export function SyncRunModal({ open, onClose, onSyncComplete }: SyncRunModalProps) {
  const initialRange = getInitialDates(30);
  const [fromDate, setFromDate] = useState<string>(initialRange.from);
  const [toDate, setToDate] = useState<string>(initialRange.to);
  const [status, setStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounced params for preflight discovery count
  const syncParams = useMemo<FetchOrdersParams>(() => ({
    createdAfter: fromDate ? new Date(`${fromDate}T00:00:00Z`) : undefined,
    createdBefore: toDate ? new Date(`${toDate}T23:59:59.999Z`) : undefined,
    ...(status ? { status } : {}),
  }), [fromDate, toDate, status]);

  const debouncedParams = useDebounce(syncParams, 400);

  const { data: preflightData, isLoading: isPreflightLoading } = usePreflightLazadaSync(debouncedParams, open);
  const { mutateAsync: syncOrders, isPending: isSyncing } = useSyncLazadaOrders();

  const handleStartSync = async () => {
    setErrorMsg(null);
    if (!fromDate || !toDate) {
      setErrorMsg('Vui lòng chọn khoảng thời gian hợp lệ.');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setErrorMsg('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    try {
      const params: FetchOrdersParams = {
        createdAfter: new Date(`${fromDate}T00:00:00Z`),
        createdBefore: new Date(`${toDate}T23:59:59.999Z`),
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
      <DialogContent className="max-w-md p-6 space-y-5">
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
          {/* Date Range Picker */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">
              Khoảng thời gian đồng bộ
            </label>
            <DateRangePicker
              from={fromDate}
              to={toDate}
              onChange={({ from, to }) => {
                setFromDate(from);
                setToDate(to);
              }}
              placeholder="Chọn khoảng thời gian…"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label htmlFor="status-select" className="font-semibold text-foreground">
              Lọc theo trạng thái đơn hàng
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

