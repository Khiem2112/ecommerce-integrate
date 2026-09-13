'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('orders.shippingTab');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Financial & Shipping Summary */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('title')}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditShipping}
            className="h-7 px-2.5 text-xs"
          >
            {t('edit')}
          </Button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">{t('totalValue')}</span>
            <span className="font-mono font-semibold text-sm text-foreground">
              {formatVND(order.totalValue)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">{t('shippingFee')}</span>
            <span className="font-mono text-foreground">{formatVND(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">{t('discountAmount')}</span>
            <span className="font-mono text-semantic-error">
              -{formatVND(order.discountAmount)}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted">{t('currency')}</span>
            <span className="font-mono font-medium text-foreground">{order.currency}</span>
          </div>
        </div>
      </div>

      {/* Fulfillment Milestones & Cancellation */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('milestonesTitle')}
          </h4>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">{t('paidAt')}</span>
            <span className="text-foreground">{formatDate(order.paidAt, t('notUpdated'))}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">{t('fulfilledAt')}</span>
            <span className="text-foreground">{formatDate(order.fulfilledAt, t('notUpdated'))}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-hairline/60">
            <span className="text-muted">{t('cancelledAt')}</span>
            <span className="text-foreground">{formatDate(order.cancelledAt, t('notUpdated'))}</span>
          </div>

          {order.cancelReturnInitiator && (
            <div className="rounded-lg bg-surface-lifted p-3 mt-2">
              <span className="text-muted">{t('cancelInitiator')}</span>
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
