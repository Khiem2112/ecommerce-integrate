'use client';

import { IconButton } from '@/components/atoms';
import { EvidenceFactList } from '@/components/context/EvidenceFactList';
import { OrderSummaryCard } from '@/components/context/OrderSummaryCard';
import { VipTierBadge } from '@/components/context/VipTierBadge';
import { useCustomerContext } from '@/hooks/useCustomerContext';

type CustomerContextPanelProps = {
  readonly conversationId: number | null;
  readonly onCollapse: () => void;
};

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CustomerContextPanel({
  conversationId,
  onCollapse,
}: CustomerContextPanelProps) {
  const { data: context, isLoading, error } = useCustomerContext(conversationId);

  if (conversationId === null) {
    return (
      <div className="grid h-full min-h-96 place-items-center px-6 text-center">
        <p className="text-sm text-slate-500">
          Customer context appears when a conversation is selected.
        </p>
      </div>
    );
  }

  if (isLoading) return <ContextSkeleton />;
  if (error || !context) {
    return (
      <div className="m-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
        Unable to load customer context. {error?.message}
      </div>
    );
  }

  const { customer, unresolvedConversationCount, totalConversationCount } =
    context.dossier;
  const metrics = [
    { label: 'Total spend', value: formatVnd(customer.totalSpend) },
    { label: 'Orders', value: String(customer.orderCount) },
    { label: 'Avg. order', value: formatVnd(customer.avgOrderValue) },
    {
      label: 'Last order',
      value:
        customer.daysSinceLastOrder === null
          ? '—'
          : `${customer.daysSinceLastOrder}d ago`,
    },
  ];

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Customer context</h2>
          <p className="mt-0.5 text-xs text-slate-500">Evidence-backed customer intel</p>
        </div>
        <IconButton
          size="sm"
          variant="ghost"
          ariaLabel="Collapse customer context"
          tooltip="Collapse customer context"
          onClick={onCollapse}
          icon={
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
              <path d="m11 9-3 3 3 3" />
            </svg>
          }
        />
      </header>
      <div className="space-y-5 p-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Customer ID
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                {customer.platformBuyerId}
              </p>
            </div>
            <VipTierBadge code={customer.vipTier.code} name={customer.vipTier.name} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-white">
              {customer.vipScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500">VIP score / 100</span>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer metrics
            </h3>
            <span className="text-[10px] text-slate-600">
              {totalConversationCount} cases · {unresolvedConversationCount} open
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-slate-800 bg-slate-900/55 p-3"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {metric.label}
                </p>
                <p
                  className="mt-1 truncate text-sm font-semibold text-slate-200"
                  title={metric.value}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <OrderSummaryCard order={context.turn.linkedOrder} />
        <EvidenceFactList
          facts={context.evidence.facts}
          highConfidenceFactCount={context.evidence.highConfidenceFactCount}
        />
      </div>
    </div>
  );
}

function ContextSkeleton() {
  return (
    <div
      className="space-y-5 p-4 animate-pulse"
      aria-label="Loading customer context"
    >
      <div className="h-36 rounded-xl border border-slate-800 bg-slate-900" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-20 rounded-lg bg-slate-900" />
        <div className="h-20 rounded-lg bg-slate-900" />
        <div className="h-20 rounded-lg bg-slate-900" />
        <div className="h-20 rounded-lg bg-slate-900" />
      </div>
      <div className="h-40 rounded-xl border border-slate-800 bg-slate-900" />
    </div>
  );
}
