import { Badge } from '@/components/atoms';
import type { SyncOrderListItem } from '@/types';
import { formatSyncFieldValue, SYNC_FIELD_LABELS } from '@/utils';

type SyncOrderListRowProps = {
  readonly order: SyncOrderListItem;
  readonly onSelect: (order: SyncOrderListItem) => void;
};

const SUMMARY_FIELDS = ['status', 'totalValue', 'shippingFee', 'discountAmount'] as const;

function getCurrentFieldValue(order: SyncOrderListItem, field: (typeof SUMMARY_FIELDS)[number]) {
  if (field === 'status') return order.currentStatus;
  return order[field];
}

export function SyncOrderListRow({ order, onSelect }: SyncOrderListRowProps) {
  const visibleFields = order.changedOrderFields.slice(0, 4);
  const remaining = order.changedOrderFields.length - visibleFields.length;
  const diffByField = new Map(order.orderFields.map((field) => [field.fieldName, field]));
  return (
    <button
      type="button"
      onClick={() => onSelect(order)}
      className="grid min-h-14 w-full gap-3 border-b border-hairline px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary lg:grid-cols-[minmax(150px,0.65fr)_minmax(300px,1.7fr)_minmax(150px,0.55fr)] lg:items-center"
    >
      <span className="font-mono text-xs font-semibold text-foreground">{order.externalOrderId}</span>
      <span className="grid gap-1.5 sm:grid-cols-2">
        {SUMMARY_FIELDS.map((field) => {
          const diff = diffByField.get(field);
          const currentValue = getCurrentFieldValue(order, field);
          return (
            <span key={field} className="min-w-0 rounded-lg border border-hairline bg-surface-card px-2 py-1">
              <span className="block text-[10px] font-semibold text-muted">{SYNC_FIELD_LABELS[field]}</span>
              <span className="mt-0.5 flex min-h-5 min-w-0 flex-wrap items-center gap-1 text-[11px] text-foreground">
                {diff ? (
                  <>
                    <span className="min-w-0 text-muted line-through decoration-muted/40">{formatSyncFieldValue(field, diff.before)}</span>
                    <span className="text-muted">→</span>
                    <span className="min-w-0 font-semibold text-status-success">{formatSyncFieldValue(field, diff.after)}</span>
                  </>
                ) : (
                  <span className="min-w-0 font-semibold">{formatSyncFieldValue(field, currentValue)}</span>
                )}
              </span>
            </span>
          );
        })}
        {remaining > 0 && <Badge variant="secondary" size="xs">+{remaining} trường khác</Badge>}
        {visibleFields.some((field) => !SUMMARY_FIELDS.includes(field as (typeof SUMMARY_FIELDS)[number])) && (
          <span className="flex flex-wrap gap-1">
            {visibleFields
              .filter((field) => !SUMMARY_FIELDS.includes(field as (typeof SUMMARY_FIELDS)[number]))
              .map((field) => <Badge key={field} variant="outline" size="xs">{field}</Badge>)}
          </span>
        )}
      </span>
      <span className="text-[11px] text-muted md:text-right">
        {order.changedItemCount > 0 ? `${order.changedItemCount} items thay đổi` : new Date(order.syncedAt).toLocaleTimeString('vi-VN')}
      </span>
    </button>
  );
}
