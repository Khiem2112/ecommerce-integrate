'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Badge, Button } from '@/components/atoms';
import { useRetrySelectedOrders } from '@/hooks';
import type { SyncOrderListItem } from '@/types';

type SyncOrderErrorRowProps = {
  readonly batchId: number;
  readonly order: SyncOrderListItem;
  readonly onSelect: (order: SyncOrderListItem) => void;
};

export function SyncOrderErrorRow({ batchId, order, onSelect }: SyncOrderErrorRowProps) {
  const t = useTranslations('integrations.batchDetail');
  const router = useRouter();
  const retryMutation = useRetrySelectedOrders();

  const handleRetry = async () => {
    const result = await retryMutation.mutateAsync({ batchId, externalOrderIds: [order.externalOrderId] });
    router.push(`/settings/integrations/lazada/syncs/${encodeURIComponent(result.batchCode)}`);
  };

  return (
    <div className="grid gap-2 border-b border-hairline px-3 py-3 last:border-b-0 md:grid-cols-[minmax(150px,0.7fr)_minmax(260px,1.5fr)_auto] md:items-center">
      <button type="button" onClick={() => onSelect(order)} className="text-left font-mono text-xs font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {order.externalOrderId}
      </button>
      <div className="min-w-0">
        <Badge variant={order.retryEligible ? 'warning' : 'error'} size="xs">{t(`errorCategories.${order.errorCategory ?? 'unknown'}`)}</Badge>
        <p className="mt-1 truncate text-[11px] text-muted" title={order.errorMessage ?? undefined}>{order.errorMessage}</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Badge variant={order.retryEligible ? 'success' : 'secondary'} size="xs">
          {order.retryEligible ? t('eligibleForRetry') : t('manualHandling')}
        </Badge>
        {order.retryEligible && <Button size="xs" onClick={handleRetry} isLoading={retryMutation.isPending}>{t('retryOrder')}</Button>}
      </div>
      {retryMutation.error && <p role="alert" className="text-[10px] text-semantic-error md:col-span-3">{retryMutation.error.message}</p>}
    </div>
  );
}
