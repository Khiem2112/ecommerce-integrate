'use client';

import { Button } from '@/components/atoms';
import { formatVND, formatDate } from '@/utils';
import type { OrderWithHistory } from '@/types';

export type OrderShippingFinancialTabProps = {
  readonly order: OrderWithHistory;
  readonly onEditShipping: () => void;
};

export function OrderShippingFinancialTab({
  order,
  onEditShipping,
}: OrderShippingFinancialTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Financial & Shipping Summary */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Tài chính & Phí vận chuyển
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditShipping}
            className="h-7 px-2.5 text-xs"
          >
            Chỉnh sửa
          </Button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">Tổng thanh toán đơn:</span>
            <span className="font-mono font-semibold text-sm text-foreground">
              {formatVND(order.totalValue)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">Phí vận chuyển:</span>
            <span className="font-mono text-foreground">{formatVND(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">Tổng giảm giá / Voucher:</span>
            <span className="font-mono text-semantic-error">
              -{formatVND(order.discountAmount)}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted">Loại tiền tệ:</span>
            <span className="font-mono font-medium text-foreground">{order.currency}</span>
          </div>
        </div>
      </div>

      {/* Fulfillment Milestones & Cancellation */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Mốc thời gian xử lý & Hủy đơn
          </h4>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">Thời điểm thanh toán (Paid At):</span>
            <span className="text-foreground">{formatDate(order.paidAt, 'Chưa cập nhật')}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">Thời điểm giao thành công (Fulfilled At):</span>
            <span className="text-foreground">{formatDate(order.fulfilledAt, 'Chưa cập nhật')}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">Thời điểm hủy đơn (Cancelled At):</span>
            <span className="text-foreground">{formatDate(order.cancelledAt, 'Chưa cập nhật')}</span>
          </div>

          {order.cancelReturnInitiator && (
            <div className="rounded-lg bg-surface-lifted p-3 mt-2">
              <span className="text-muted">Bên yêu cầu hủy: </span>
              <strong className="text-foreground uppercase">
                {order.cancelReturnInitiator}
              </strong>
              {order.cancellationReason && (
                <p className="mt-1 text-muted italic">
                  &ldquo;{order.cancellationReason}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
