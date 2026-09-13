'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('orders.generalTab');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* General & Platform Information */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('title')}
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditGeneral}
            className="h-7 px-2.5 text-xs"
          >
            {t('edit')}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted">{t('platformOrderId')}</span>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {order.platformOrderId}
            </p>
          </div>
          <div>
            <span className="text-muted">{t('platform')}</span>
            <p className="mt-0.5 font-medium text-foreground">
              <Badge variant="secondary" size="sm">
                {order.platform.name}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-muted">{t('currentStatus')}</span>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="info" size="sm">
                {order.currentStatus.name}
              </Badge>
              <button
                type="button"
                onClick={onEditStatus}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                {t('changeStatus')}
              </button>
            </div>
          </div>
          <div>
            <span className="text-muted">{t('currency')}</span>
            <p className="mt-0.5 font-medium text-foreground">{order.currency}</p>
          </div>
          <div>
            <span className="text-muted">{t('createdAt')}</span>
            <p className="mt-0.5 text-foreground">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <span className="text-muted">{t('updatedAt')}</span>
            <p className="mt-0.5 text-foreground">{formatDate(order.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Customer Profile Summary */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('customerTitle')}
          </h4>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted">{t('buyerId')}</span>
            <p className="mt-0.5 font-mono font-semibold text-foreground">
              {order.customer?.platformBuyerId ?? 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-muted">{t('vipTier')}</span>
            <p className="mt-0.5">
              <Badge variant={getVipBadgeVariant(order.customer?.vipTier?.code)} size="sm">
                {order.customer?.vipTier?.name ?? t('standardTier')}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-muted">{t('vipScore')}</span>
            <p className="mt-0.5 font-mono font-medium text-foreground">
              {order.customer?.vipScore ?? 0} / 100
            </p>
          </div>
          <div>
            <span className="text-muted">{t('totalSpend')}</span>
            <p className="mt-0.5 font-medium text-foreground">
              {formatVND(order.customer?.totalSpend ?? 0)}
            </p>
          </div>
          <div>
            <span className="text-muted">{t('orderCount')}</span>
            <p className="mt-0.5 font-medium text-foreground">
              {t('orderCountValue', { count: order.customer?.orderCount ?? 0 })}
            </p>
          </div>
          <div>
            <span className="text-muted">{t('consent')}</span>
            <p className="mt-0.5 font-medium text-foreground">
              {order.customer?.consentStatus === 'granted' ? t('consentGranted') : t('consentRevoked')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
