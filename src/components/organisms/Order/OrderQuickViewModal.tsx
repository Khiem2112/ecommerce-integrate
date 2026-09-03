'use client';

import Link from 'next/link';
import { useOrder, useOrderLookups } from '@/hooks';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Badge,
  IconButton,
  Button,
} from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import { OrderDetailContent, type OrderTabKey } from './OrderDetailContent';

export type OrderQuickViewModalProps = {
  readonly open: boolean;
  readonly orderId: number | null;
  readonly onClose: () => void;
  readonly initialTab?: OrderTabKey;
};

export function OrderQuickViewModal({
  open,
  orderId,
  onClose,
  initialTab = 'general',
}: OrderQuickViewModalProps) {
  const {
    data: order,
    isLoading,
    error,
    refetch,
  } = useOrder(open && orderId ? orderId : null);

  const { data: lookups } = useOrderLookups();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        hideCloseButton
        className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0"
      >
        {/* Modal Header */}
        <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-hairline bg-surface-lifted px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-status-info/10 text-status-info">
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-foreground">
                  Chi tiết đơn hàng
                </DialogTitle>
                {order && (
                  <>
                    <span className="font-mono text-xs font-semibold text-primary">
                      #{order.platformOrderId}
                    </span>
                    <Badge variant="secondary" size="xs">
                      {order.platform.name}
                    </Badge>
                  </>
                )}
              </div>
              <DialogDescription className="text-[11px] text-muted">
                Xem nhanh các dòng sản phẩm, dòng tiền, lịch sử chuyển trạng thái đơn
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <Link
                href={`/orders/${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex"
              >
                <Button type="button" variant="outline" size="xs">
                  <span className="mr-1">Mở trang đầy đủ</span>
                  <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </Button>
              </Link>
            )}

            <IconButton
              variant="ghost"
              size="sm"
              ariaLabel="Đóng modal"
              tooltip="Đóng"
              onClick={onClose}
              className="text-muted hover:text-foreground"
              icon={
                <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              }
            />
          </div>
        </header>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {isLoading && <OrderModalSkeleton />}

          {(error || (!isLoading && !order)) && (
            <div className="m-4">
              <ErrorBanner
                message={`Không thể tải thông tin đơn hàng.${error?.message ? ` ${error.message}` : ''}`}
                onRetry={() => void refetch()}
              />
            </div>
          )}

          {order && (
            <OrderDetailContent
              key={order.id}
              order={order}
              lookups={lookups}
              isModal
              initialTab={initialTab}
              onOrderDeleted={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderModalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 rounded-xl bg-surface-lifted" />
      <div className="h-64 rounded-xl bg-surface-lifted" />
    </div>
  );
}
