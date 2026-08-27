import type { LinkedOrderContext } from '@/types';

type OrderSummaryCardProps = {
  readonly order: LinkedOrderContext | null;
};

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

export function OrderSummaryCard({ order }: OrderSummaryCardProps) {
  if (!order) {
    return (
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Linked order</h3>
        <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">No order is linked to this conversation.</div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Linked order</h3>
        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">{order.currentStatus.name}</span>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/55 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-mono text-xs font-semibold text-slate-200">#{order.platformOrderId}</p>
          <p className="shrink-0 text-xs font-semibold text-slate-300">{formatVnd(order.totalValue)}</p>
        </div>
        {order.items.length > 0 && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</p>}
        {order.statusHistory.length > 0 && (
          <ol className="mt-4 space-y-2 border-l border-slate-700 pl-3">
            {order.statusHistory.slice(-4).map((item) => (
              <li key={item.id} className="relative text-[11px] text-slate-400">
                <span className="absolute -left-[17px] top-1 size-2 rounded-full border-2 border-slate-900 bg-violet-400" />
                <span className="font-medium text-slate-300">{item.status.name}</span>
                <span className="ml-1 text-slate-600">{new Intl.DateTimeFormat('vi-VN', { month: 'short', day: 'numeric' }).format(new Date(item.changedAt))}</span>
                {item.note && <p className="mt-0.5 line-clamp-1 text-slate-500">{item.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
