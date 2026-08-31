'use client';

import { IconButton } from '@/components/atoms';
import { EvidenceFactList, OrderSummaryCard, VipTierBadge } from '@/components/molecules';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';
import { useCustomerContext } from '@/hooks/useCustomerContext';

type CustomerContextPanelProps = {
  readonly conversationId: number | null;
  readonly onCollapse: () => void;
  readonly headerHidden?: boolean;
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
  headerHidden = false,
}: CustomerContextPanelProps) {
  const { data: context, isLoading, error, refetch } = useCustomerContext(conversationId);

  if (conversationId === null) {
    return (
      <div className="grid h-full min-h-96 place-items-center px-6 text-center">
        <p className="text-sm text-muted">
          Customer context appears when a conversation is selected.
        </p>
      </div>
    );
  }

  if (isLoading) return <ContextSkeleton />;
  if (error || !context) {
    return (
      <div className="m-4">
        <ErrorBanner
          message={`Unable to load customer context.${error?.message ? ` ${error.message}` : ''}`}
          onRetry={() => void refetch()}
        />
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
    <div className="custom-scrollbar flex h-full min-h-0 flex-col overflow-y-auto bg-surface-lifted">
      {!headerHidden && (
        <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-hairline bg-surface-lifted px-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Customer context</h2>
            <p className="mt-0.5 text-xs text-muted">Evidence-backed customer intel</p>
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
      )}
      <div className="space-y-4 p-3.5">
        <section className="rounded-2xl border border-hairline bg-white p-3.5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Customer ID
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                {customer.platformBuyerId}
              </p>
            </div>
            <VipTierBadge code={customer.vipTier.code} name={customer.vipTier.name} />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {customer.vipScore.toFixed(1)}
            </span>
            <span className="text-xs text-muted">VIP score / 100</span>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Customer metrics
            </h3>
            <span className="text-[10px] text-muted">
              {totalConversationCount} cases · {unresolvedConversationCount} open
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-hairline bg-white p-2.5 shadow-xs"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {metric.label}
                </p>
                <p
                  className="mt-0.5 truncate text-xs font-semibold text-foreground"
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
      className="space-y-4 p-3.5 animate-pulse bg-surface-lifted"
      aria-label="Loading customer context"
    >
      <div className="h-28 rounded-2xl border border-hairline bg-white" />
      <div className="grid grid-cols-2 gap-1.5">
        <div className="h-16 rounded-2xl border border-hairline bg-white" />
        <div className="h-16 rounded-2xl border border-hairline bg-white" />
        <div className="h-16 rounded-2xl border border-hairline bg-white" />
        <div className="h-16 rounded-2xl border border-hairline bg-white" />
      </div>
      <div className="h-36 rounded-2xl border border-hairline bg-white" />
    </div>
  );
}
