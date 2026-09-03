'use client';

import Link from 'next/link';
import { useCustomer } from '@/hooks';
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
import { CustomerDetailContent, type CustomerTabKey } from './CustomerDetailContent';

export type CustomerQuickViewModalProps = {
  readonly open: boolean;
  readonly customerId: number | null;
  readonly onClose: () => void;
  readonly initialTab?: CustomerTabKey;
};

export function CustomerQuickViewModal({
  open,
  customerId,
  onClose,
  initialTab = 'metrics',
}: CustomerQuickViewModalProps) {
  const {
    data: customer,
    isLoading,
    error,
    refetch,
  } = useCustomer(open && customerId ? customerId : null);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        hideCloseButton
        className="flex max-h-[90vh] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0"
      >
        {/* Modal Header */}
        <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-hairline bg-surface-lifted px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-foreground">
                  Hồ sơ khách hàng 360°
                </DialogTitle>
                {customer && (
                  <>
                    <Badge variant="secondary" size="xs">
                      {customer.platform.name}
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-primary">
                      {customer.platformBuyerId}
                    </span>
                  </>
                )}
              </div>
              <DialogDescription className="text-[11px] text-muted">
                Xem nhanh thông tin chi tiết, chỉ số RFM, lịch sử đơn hàng và chứng cứ AI
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customer && (
              <Link
                href={`/customers/${customer.id}`}
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
          {isLoading && <CustomerModalSkeleton />}

          {(error || (!isLoading && !customer)) && (
            <div className="m-4">
              <ErrorBanner
                message={`Không thể tải thông tin khách hàng.${error?.message ? ` ${error.message}` : ''}`}
                onRetry={() => void refetch()}
              />
            </div>
          )}

          {customer && (
            <CustomerDetailContent
              key={customer.id}
              customer={customer}
              hideBackLink
              isModal
              initialTab={initialTab}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerModalSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-xl bg-surface-lifted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-20 rounded-xl bg-surface-lifted" />
        <div className="h-20 rounded-xl bg-surface-lifted" />
        <div className="h-20 rounded-xl bg-surface-lifted" />
        <div className="h-20 rounded-xl bg-surface-lifted" />
      </div>
      <div className="h-56 rounded-xl bg-surface-lifted" />
    </div>
  );
}
