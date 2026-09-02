import { Badge } from '@/components/atoms';
import { formatVND } from '@/utils';
import type { LinkedOrderContext } from '@/types';

type OrderSummaryCardProps = {
  readonly order: LinkedOrderContext | null;
};

export function OrderSummaryCard({ order }: OrderSummaryCardProps) {
  if (!order) {
    return (
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Linked order
        </h3>
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-card p-3 text-center text-xs text-muted">
          No order is linked to this conversation.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          Linked order
        </h3>
        <Badge
          variant="info"
          size="xs"
          label={order.currentStatus.name}
        />
      </div>
      <div className="rounded-2xl border border-hairline bg-surface-card p-3.5 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-mono text-xs font-semibold text-foreground">
            #{order.platformOrderId}
          </p>
          <p className="shrink-0 text-xs font-bold text-foreground">
            {formatVND(order.totalValue)}
          </p>
        </div>
        {order.items.length > 0 && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">
            {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}
          </p>
        )}
        {order.statusHistory.length > 0 && (
          <ol className="mt-3 space-y-2 border-l border-hairline pl-3">
            {order.statusHistory.slice(-4).map((item) => (
              <li key={item.id} className="relative text-xs text-muted">
                <span className="absolute -left-4 top-1 size-2 rounded-full border-2 border-surface-card bg-foreground" />
                <span className="font-semibold text-foreground">{item.status.name}</span>
                <span className="ml-1 text-muted">
                  {new Intl.DateTimeFormat('vi-VN', { month: 'short', day: 'numeric' }).format(
                    new Date(item.changedAt),
                  )}
                </span>
                {item.note && <p className="mt-0.5 line-clamp-1 text-muted">{item.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
