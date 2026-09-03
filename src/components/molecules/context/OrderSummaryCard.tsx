import { Badge, IconButton } from '@/components/atoms';
import { formatVND } from '@/utils';
import { cn } from '@/lib/cn';
import type { LinkedOrderContext } from '@/types';

type OrderSummaryCardProps = {
  readonly order: LinkedOrderContext | null;
  readonly onViewDetail?: (orderId: number) => void;
};

export function OrderSummaryCard({ order, onViewDetail }: OrderSummaryCardProps) {
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
        <div className="flex items-center gap-1.5">
          <Badge
            variant="info"
            size="xs"
            label={order.currentStatus.name}
          />
          {onViewDetail && (
            <IconButton
              size="xs"
              variant="ghost"
              ariaLabel="Xem chi tiết đơn hàng"
              tooltip="Xem chi tiết đơn hàng"
              onClick={() => onViewDetail(order.id)}
              className="text-muted hover:text-primary"
              icon={
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              }
            />
          )}
        </div>
      </div>
      <div
        role={onViewDetail ? 'button' : undefined}
        tabIndex={onViewDetail ? 0 : undefined}
        onClick={onViewDetail ? () => onViewDetail(order.id) : undefined}
        onKeyDown={
          onViewDetail
            ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onViewDetail(order.id);
              }
            }
            : undefined
        }
        className={cn(
          'group relative rounded-2xl border border-hairline bg-surface-card p-3.5 shadow-xs transition text-left',
          onViewDetail && 'cursor-pointer hover:border-primary/40 hover:bg-surface-lifted/40',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="truncate font-mono text-xs font-semibold text-foreground group-hover:text-primary">
              #{order.platformOrderId}
            </p>
            {onViewDetail && (
              <span className="shrink-0 text-[10px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
                Xem chi tiết ↗
              </span>
            )}
          </div>
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
