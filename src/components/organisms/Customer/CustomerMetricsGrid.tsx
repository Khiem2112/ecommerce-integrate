'use client';

import { Badge } from '@/components/atoms';
import { formatVND, parseCategoryList } from '@/utils';
import type { CustomerFullDetail } from '@/types';
import { cn } from '@/lib/cn';

export type CustomerMetricsGridProps = {
  readonly customer: CustomerFullDetail;
};

export function CustomerMetricsGrid({ customer }: CustomerMetricsGridProps) {
  const categories = parseCategoryList(customer.frequentCategories);

  const metrics = [
    {
      label: 'Tổng chi tiêu tích lũy (LTV)',
      value: formatVND(customer.totalSpend),
      subtext: 'Giá trị vòng đời khách hàng',
      highlight: true,
      icon: (
        <svg aria-hidden="true" className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Tổng số đơn hàng',
      value: `${customer.orderCount} đơn`,
      subtext: 'Đã hoàn tất trên hệ thống',
      icon: (
        <svg aria-hidden="true" className="size-4 text-status-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      ),
    },
    {
      label: 'Giá trị đơn trung bình (AOV)',
      value: formatVND(customer.avgOrderValue),
      subtext: 'Mức chi trả trung bình/đơn',
      icon: (
        <svg aria-hidden="true" className="size-4 text-status-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
        </svg>
      ),
    },
    {
      label: 'Thời gian kể từ đơn gần nhất',
      value:
        customer.daysSinceLastOrder !== null && customer.daysSinceLastOrder !== undefined
          ? `${customer.daysSinceLastOrder} ngày`
          : '—',
      subtext: 'Chỉ số Recency trong RFM',
      icon: (
        <svg aria-hidden="true" className="size-4 text-status-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Tỷ lệ hủy đơn hàng',
      value: `${(customer.cancellationRate * 100).toFixed(1)}%`,
      subtext: 'Tỷ lệ hủy từ người mua hoặc sàn',
      alert: customer.cancellationRate > 0.1,
      icon: (
        <svg aria-hidden="true" className="size-4 text-semantic-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Tỷ lệ hoàn tiền / Khiếu nại',
      value: `${(customer.refundRate * 100).toFixed(1)}%`,
      subtext: 'Yêu cầu đổi trả & hoàn tiền',
      alert: customer.refundRate > 0.05,
      icon: (
        <svg aria-hidden="true" className="size-4 text-semantic-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.75a3 3 0 0 0-3-3h-9a3 3 0 0 0-3 3v13.5a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3V4.5Z" />
        </svg>
      ),
    },
    {
      label: 'Chu kỳ mua lại trung bình',
      value:
        customer.repeatPurchaseInterval !== null && customer.repeatPurchaseInterval !== undefined
          ? `${customer.repeatPurchaseInterval.toFixed(0)} ngày`
          : '—',
      subtext: 'Khoảng cách giữa 2 lần mua',
      icon: (
        <svg aria-hidden="true" className="size-4 text-badge-purple-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
    },
    {
      label: 'Độ nhạy mã giảm giá (Voucher)',
      value: `${(customer.voucherSensitivity * 100).toFixed(0)}%`,
      subtext: 'Tỷ lệ đơn hàng sử dụng mã',
      icon: (
        <svg aria-hidden="true" className="size-4 text-badge-pink-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={cn(
              'flex flex-col justify-between rounded-xl border p-4 shadow-xs transition',
              m.highlight
                ? 'border-primary/30 bg-primary/5'
                : m.alert
                ? 'border-semantic-error/20 bg-semantic-error/5'
                : 'border-hairline bg-surface-card',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                {m.label}
              </span>
              <div className="rounded-lg bg-surface-lifted border border-hairline p-1.5 shadow-xs">
                {m.icon}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-lg font-bold tracking-tight text-foreground font-mono">
                {m.value}
              </div>
              <p className="mt-0.5 text-[11px] text-muted">{m.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Frequent Categories and Preferences Panel */}
      <div className="rounded-xl border border-hairline bg-surface-card p-4 shadow-card">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          Sở thích & Ngành hàng thường mua sắm (Frequent Categories)
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {categories.length > 0 ? (
            categories.map((cat) => (
              <Badge key={cat} variant="info" size="sm">
                <span className="font-mono">{cat}</span>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted">Chưa ghi nhận danh mục mua sắm đặc trưng.</span>
          )}
        </div>
      </div>
    </div>
  );
}
