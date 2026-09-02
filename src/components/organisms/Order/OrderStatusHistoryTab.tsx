'use client';

import { Badge, Button } from '@/components/atoms';
import { formatDateTime, getStatusBadgeVariant } from '@/utils';
import type { OrderWithHistory } from '@/types';

export type OrderStatusHistoryTabProps = {
  readonly order: OrderWithHistory;
  readonly onOpenUpdateStatusModal: () => void;
};

export function OrderStatusHistoryTab({
  order,
  onOpenUpdateStatusModal,
}: OrderStatusHistoryTabProps) {
  const history = order.statusHistory || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Lịch sử chuyển trạng thái đơn hàng
          </h4>
          <p className="text-xs text-muted">Toàn bộ các bước thay đổi trạng thái và ghi chú kiểm toán.</p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onOpenUpdateStatusModal}
          className="h-8 text-xs"
        >
          <svg aria-hidden="true" className="mr-1.5 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Chuyển trạng thái mới
        </Button>
      </div>

      <div className="rounded-xl border border-hairline bg-surface-card p-6 shadow-card">
        {history.length === 0 ? (
          <p className="text-xs text-muted">Chưa ghi nhận lịch sử thay đổi trạng thái nào.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-hairline">
            {history.map((h) => {
              const statusInfo = getStatusBadgeVariant(h.status.code);
              return (
                <div key={h.id} className="relative group">
                  {/* Dot */}
                  <div className="absolute -left-6 top-1 size-3 rounded-full border-2 border-surface-card bg-primary shadow-xs" />

                  <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface-lifted/30 p-3.5 transition hover:border-hairline-strong">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusInfo.variant} size="sm">
                          {h.status.name}
                        </Badge>
                        <span className="text-xs text-muted">
                          Bởi: <strong className="text-foreground">{h.changedBy || 'Hệ thống'}</strong>
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted">
                        {formatDateTime(h.changedAt)}
                      </span>
                    </div>

                    {h.note && (
                      <p className="mt-1 text-xs text-foreground/80 leading-relaxed bg-surface-card/60 p-2 rounded border border-hairline/60">
                        {h.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
