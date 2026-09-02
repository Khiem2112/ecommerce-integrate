'use client';

import { Badge, Button } from '@/components/atoms';
import { formatVND, formatDate, getVipBadgeVariant } from '@/utils';
import type { OrderWithHistory } from '@/types';

export type OrderGeneralTabProps = {
  readonly order: OrderWithHistory;
  readonly onEditGeneral: () => void;
  readonly onEditStatus: () => void;
};

export function OrderGeneralTab({
  order,
  onEditGeneral,
  onEditStatus,
}: OrderGeneralTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* General & Platform Information */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Thông tin đơn hàng & sàn
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditGeneral}
            className="h-7 px-2.5 text-xs"
          >
            Chỉnh sửa
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted">Mã đơn hàng sàn:</span>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {order.platformOrderId}
            </p>
          </div>
          <div>
            <span className="text-muted">Sàn thương mại:</span>
            <p className="mt-0.5 font-medium text-foreground">
              <Badge variant="secondary" size="sm">
                {order.platform.name}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-muted">Trạng thái hiện tại:</span>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="info" size="sm">
                {order.currentStatus.name}
              </Badge>
              <button
                type="button"
                onClick={onEditStatus}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Đổi trạng thái
              </button>
            </div>
          </div>
          <div>
            <span className="text-muted">Tiền tệ:</span>
            <p className="mt-0.5 font-medium text-foreground">{order.currency}</p>
          </div>
          <div>
            <span className="text-muted">Thời gian tạo:</span>
            <p className="mt-0.5 text-foreground">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <span className="text-muted">Cập nhật lần cuối:</span>
            <p className="mt-0.5 text-foreground">{formatDate(order.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Customer Profile Summary */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Hồ sơ khách hàng liên kết
          </h4>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted">Buyer ID (Sàn):</span>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {order.customer?.platformBuyerId ?? 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-muted">Hạng thành viên (VIP Tier):</span>
            <p className="mt-0.5">
              <Badge variant={getVipBadgeVariant(order.customer?.vipTier?.code)} size="sm">
                {order.customer?.vipTier?.name ?? 'Standard'}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-muted">Điểm VIP Score:</span>
            <p className="mt-0.5 font-mono font-medium text-foreground">
              {order.customer?.vipScore ?? 0} / 100
            </p>
          </div>
          <div>
            <span className="text-muted">Tổng chi tiêu:</span>
            <p className="mt-0.5 font-medium text-foreground">
              {formatVND(order.customer?.totalSpend ?? 0)}
            </p>
          </div>
          <div>
            <span className="text-muted">Tổng số đơn đã mua:</span>
            <p className="mt-0.5 font-medium text-foreground">
              {order.customer?.orderCount ?? 0} đơn hàng
            </p>
          </div>
          <div>
            <span className="text-muted">Trạng thái đồng thuận:</span>
            <p className="mt-0.5 font-medium text-foreground">
              {order.customer?.consentStatus === 'granted' ? 'Đã cho phép' : 'Chưa cấp quyền'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
